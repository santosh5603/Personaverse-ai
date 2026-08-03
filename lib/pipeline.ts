import connectToDatabase from "@/lib/mongodb";
import Simulation from "@/models/Simulation";
import PersonaResponse from "@/models/PersonaResponse";
import ConsensusReport from "@/models/ConsensusReport";
import {
  fetchYoutubeThumbnail,
  processUploadedImage,
  type IngestedImage,
} from "@/lib/contentIngestion";
import { generatePopulation, stratifySample } from "@/lib/personaGenerator";
import { simulateAllPersonasDetailed } from "@/lib/personaSimulator";
import { buildConsensus, type WeightedResponse } from "@/lib/consensusEngine";

const SIM_CONCURRENCY = Number(process.env.SIM_CONCURRENCY ?? "3");
// Cap how many segments actually hit the LLM. The largest segments by
// population are sampled first, so a low cap still covers most of the 1000
// people while keeping the run inside Vercel's 60s function limit.
const SIM_SAMPLE_BUCKETS = Number(process.env.SIM_SAMPLE_BUCKETS ?? "12");

export interface PipelineInput {
  userId: string;
  contentType: "youtube" | "image";
  youtubeUrl?: string;
  imageFile?: File;
  contextText?: string;
}

export interface PipelineOutput {
  simulationId: string;
  /** Total distinct audience segments in the 1000-person population. */
  totalSegments: number;
  /** How many of those segments were actually sent to the LLM. */
  sampledSegments: number;
  /** Of the sampled segments, how many returned valid scores. */
  simulatedCount: number;
  failedCount: number;
  rateLimitedCount: number;
  /** People represented by the sampled segments, out of 1000. */
  coveredPopulation: number;
  providerSplit: Record<string, number>;
}

/**
 * Runs the full simulation pipeline and persists all three collections.
 * ingest -> generate 1000 -> stratify -> simulate reps -> consensus -> save.
 *
 * The Simulation doc is created early with status "processing" so a partial
 * failure still leaves a "failed" record rather than nothing.
 */
export async function runSimulationPipeline(
  input: PipelineInput,
): Promise<PipelineOutput> {
  await connectToDatabase();

  // 1. Ingest content -> base64 image.
  let image: IngestedImage;
  if (input.contentType === "youtube") {
    if (!input.youtubeUrl) throw new Error("youtubeUrl is required for contentType 'youtube'");
    image = await fetchYoutubeThumbnail(input.youtubeUrl);
  } else {
    if (!input.imageFile) throw new Error("imageFile is required for contentType 'image'");
    image = await processUploadedImage(input.imageFile);
  }

  const sim = await Simulation.create({
    userId: input.userId,
    contentType: input.contentType,
    sourceUrl: input.youtubeUrl,
    imageBase64: image.base64,
    contextText: input.contextText,
    status: "processing",
  });

  try {
    // 2 + 3. Generate the population and elect one representative per bucket.
    const population = generatePopulation(1000);
    const allBuckets = stratifySample(population);

    // Sample the largest segments first, capped for runtime.
    const buckets = [...allBuckets]
      .sort((a, b) => b.count - a.count)
      .slice(0, SIM_SAMPLE_BUCKETS);
    const representatives = buckets.map((b) => b.representative);
    const coveredPopulation = buckets.reduce((sum, b) => sum + b.count, 0);

    // 4. Run every representative through the LLM (load-split across providers).
    const { succeeded: results, failedCount, rateLimitedCount, providerSplit } =
      await simulateAllPersonasDetailed(
        representatives,
        image.base64,
        image.mimeType,
        input.contextText,
        SIM_CONCURRENCY,
      );

    if (results.length === 0) {
      throw new Error("All persona simulations failed (no scored responses)");
    }

    // 5. Weight each response by its bucket's population count, then build consensus.
    const weightByPersonaId = new Map(
      buckets.map((b) => [b.representative.personaId, b.count]),
    );
    const weighted: WeightedResponse[] = results.map((r) => ({
      result: r,
      weight: weightByPersonaId.get(r.personaId) ?? 0,
    }));
    const consensus = await buildConsensus(weighted, {
      base64: image.base64,
      mimeType: image.mimeType,
    });

    // Persist persona responses + consensus report.
    await PersonaResponse.insertMany(
      results.map((r) => ({
        simulationId: sim._id,
        personaId: r.personaId,
        traits: r.traits,
        scores: r.scores,
        reasoning: r.reasoning,
      })),
    );

    await ConsensusReport.create({
      simulationId: sim._id,
      overallScores: consensus.overallScores,
      standoutQuotes: consensus.standoutQuotes,
      insightSummary: consensus.insightSummary,
      strengths: consensus.strengths,
      weaknesses: consensus.weaknesses,
      recommendations: consensus.recommendations,
      clusterBreakdown: consensus.clusterBreakdown,
      patterns: consensus.patterns,
    });

    sim.status = "complete";
    await sim.save();

    return {
      simulationId: String(sim._id),
      totalSegments: allBuckets.length,
      sampledSegments: buckets.length,
      simulatedCount: results.length,
      failedCount,
      rateLimitedCount,
      coveredPopulation,
      providerSplit,
    };
  } catch (err) {
    sim.status = "failed";
    await sim.save();
    throw err;
  }
}

/**
 * Fetches a Simulation with its persona responses and consensus report.
 * Returns null if the simulation doesn't exist.
 */
export async function getSimulationBundle(simulationId: string) {
  await connectToDatabase();

  const simulation = await Simulation.findById(simulationId).lean();
  if (!simulation) return null;

  const [personaResponses, consensusReport] = await Promise.all([
    PersonaResponse.find({ simulationId }).lean(),
    ConsensusReport.findOne({ simulationId }).lean(),
  ]);

  return { simulation, personaResponses, consensusReport };
}
