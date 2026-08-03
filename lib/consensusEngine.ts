import { getLLM, type SimpleObjectSchema } from "@/lib/llm";
import type { PersonaScores, PersonaSimulationResult } from "@/lib/personaSimulator";

export interface ClusterBreakdownEntry {
  trait: string;
  count: number;
  avgScores: PersonaScores;
}

export interface DimensionExtreme {
  dimension: keyof PersonaScores;
  value: number;
}

export interface ClusterExtreme {
  trait: string;
  mean: number;
}

/** Data-derived patterns (no LLM) surfaced to the UI. */
export interface AudiencePatterns {
  strongestDimension: DimensionExtreme;
  weakestDimension: DimensionExtreme;
  bestCluster: ClusterExtreme | null;
  worstCluster: ClusterExtreme | null;
  /** Std-dev of persona mean scores - how divided the audience is. */
  polarization: number;
}

export interface ConsensusResult {
  overallScores: PersonaScores;
  standoutQuotes: string[];
  insightSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  clusterBreakdown: ClusterBreakdownEntry[];
  patterns: AudiencePatterns;
}

/** A simulated persona paired with the population weight of its bucket. */
export interface WeightedResponse {
  result: PersonaSimulationResult;
  /** Number of the 1000 personas this response represents. */
  weight: number;
}

const DIMENSIONS = [
  "attention",
  "trust",
  "engagement",
  "likelihoodToAct",
] as const;

function emptyScores(): PersonaScores {
  return { attention: 0, trust: 0, engagement: 0, likelihoodToAct: 0 };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Weighted mean per dimension: sum(score * bucketWeight) / sum(bucketWeight).
 *
 * Dividing by the live weight sum rather than a hardcoded 1000 keeps the
 * average correct even when a bucket's simulation dropped out - the surviving
 * buckets still average honestly among themselves.
 */
function weightedAverage(weighted: WeightedResponse[]): PersonaScores {
  const totals = emptyScores();
  let weightSum = 0;

  for (const { result, weight } of weighted) {
    if (!result.scores) continue;
    weightSum += weight;
    for (const dim of DIMENSIONS) {
      totals[dim] += result.scores[dim] * weight;
    }
  }

  if (weightSum === 0) return emptyScores();

  const avg = emptyScores();
  for (const dim of DIMENSIONS) {
    avg[dim] = round(totals[dim] / weightSum);
  }
  return avg;
}

function meanOfScores(overall: PersonaScores): number {
  return (
    DIMENSIONS.reduce((acc, dim) => acc + overall[dim], 0) / DIMENSIONS.length
  );
}

function personaMean(scores: PersonaScores): number {
  return DIMENSIONS.reduce((acc, dim) => acc + scores[dim], 0) / DIMENSIONS.length;
}

/**
 * Picks 3-5 reasoning strings that stand out: the most positive, the most
 * negative, and the one furthest from the population mean in either direction.
 */
function pickStandoutQuotes(
  results: PersonaSimulationResult[],
  overall: PersonaScores,
): string[] {
  const scored = results
    .filter((r) => r.scores && r.reasoning.trim().length > 0)
    .map((r) => ({
      reasoning: r.reasoning.trim(),
      mean: personaMean(r.scores!),
    }));

  if (scored.length === 0) return [];

  const overallMean = meanOfScores(overall);
  const byMean = [...scored].sort((a, b) => a.mean - b.mean);
  const mostNegative = byMean[0];
  const mostPositive = byMean[byMean.length - 1];
  const mostDivergent = [...scored].sort(
    (a, b) => Math.abs(b.mean - overallMean) - Math.abs(a.mean - overallMean),
  )[0];

  // Dedupe by text while preserving order, cap at 5.
  const ordered = [mostPositive, mostNegative, mostDivergent, ...byMean];
  const seen = new Set<string>();
  const quotes: string[] = [];
  for (const item of ordered) {
    if (!seen.has(item.reasoning)) {
      seen.add(item.reasoning);
      quotes.push(item.reasoning);
    }
    if (quotes.length >= 5) break;
  }
  return quotes.slice(0, Math.max(3, Math.min(5, quotes.length)));
}

/**
 * Groups responses by their dominant trait (personality) and averages each
 * group's scores. Uses a simple (unweighted) mean within the cluster.
 */
function buildClusterBreakdown(
  results: PersonaSimulationResult[],
): ClusterBreakdownEntry[] {
  const groups = new Map<string, PersonaSimulationResult[]>();

  for (const r of results) {
    if (!r.scores) continue;
    const trait = r.traits.personality;
    const existing = groups.get(trait);
    if (existing) existing.push(r);
    else groups.set(trait, [r]);
  }

  const breakdown: ClusterBreakdownEntry[] = [];
  for (const [trait, members] of groups) {
    const avg = emptyScores();
    for (const m of members) {
      for (const dim of DIMENSIONS) avg[dim] += m.scores![dim];
    }
    for (const dim of DIMENSIONS) avg[dim] = round(avg[dim] / members.length);
    breakdown.push({ trait, count: members.length, avgScores: avg });
  }

  breakdown.sort((a, b) => b.count - a.count);
  return breakdown;
}

interface Narrative {
  insightSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

const NARRATIVE_SCHEMA: SimpleObjectSchema = {
  fields: {
    insightSummary: "string",
    strengths: "string_array",
    weaknesses: "string_array",
    recommendations: "string_array",
  },
  required: ["insightSummary", "strengths", "weaknesses", "recommendations"],
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  if (typeof v === "string")
    return v
      .split(/\n+/)
      .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);
  return [];
}

/**
 * A single image-aware LLM call that produces the plain-language summary,
 * strengths, weaknesses, and concrete input-improvement recommendations.
 * Seeing the actual image lets it suggest specific visual fixes. Folded into
 * one call to stay quota-efficient. Falls back to a template on failure.
 */
async function generateNarrative(
  overall: PersonaScores,
  sampleReasonings: string[],
  patterns: AudiencePatterns,
  image?: { base64: string; mimeType: string },
): Promise<Narrative> {
  const system =
    "You are an audience-insights analyst reviewing how a piece of visual " +
    "content (a video thumbnail or image ad) performed with a simulated " +
    "audience. Be concrete, specific to what is visible in the image, and " +
    "actionable. Recommendations must be concrete edits the creator can make " +
    "to the image/thumbnail to raise the weakest scores.";

  const userText = [
    `Weighted audience scores (0-100): attention ${overall.attention}, trust ${overall.trust}, engagement ${overall.engagement}, likelihood to act ${overall.likelihoodToAct}.`,
    `Strongest dimension: ${patterns.strongestDimension.dimension} (${patterns.strongestDimension.value}). Weakest: ${patterns.weakestDimension.dimension} (${patterns.weakestDimension.value}).`,
    "",
    "Representative audience reactions:",
    ...sampleReasonings.slice(0, 8).map((r, i) => `${i + 1}. ${r}`),
    "",
    "Return JSON with: insightSummary (2-3 sentences), strengths (2-4 bullets), " +
      "weaknesses (2-4 bullets), recommendations (3-5 concrete edits to improve the content).",
  ].join("\n");

  try {
    const raw = image
      ? await getLLM().generateMultimodalJSON({
          system,
          image,
          userText,
          schema: NARRATIVE_SCHEMA,
          temperature: 0.7,
        })
      : await getLLM().generateText({ prompt: `${system}\n\n${userText}`, temperature: 0.7 });

    let text = raw.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }
    const parsed = JSON.parse(text);
    const summary =
      typeof parsed.insightSummary === "string" && parsed.insightSummary.trim()
        ? parsed.insightSummary.trim()
        : "";
    if (summary) {
      return {
        insightSummary: summary,
        strengths: asStringArray(parsed.strengths),
        weaknesses: asStringArray(parsed.weaknesses),
        recommendations: asStringArray(parsed.recommendations),
      };
    }
  } catch {
    // fall through to template
  }

  // Data-derived fallback so the report is never bare when the LLM call fails
  // (e.g. the narrative call rate-limited on a free tier).
  return templateNarrative(overall, patterns);
}

const DIM_ADVICE: Record<keyof PersonaScores, string> = {
  attention:
    "Sharpen the focal point - bolder framing, a clearer subject, or higher contrast - so it stops the scroll faster.",
  trust:
    "Add credibility cues (a recognizable face, brand mark, or 'official' label) and remove anything that reads as clickbait.",
  engagement:
    "Give viewers a reason to lean in - a question, a surprising detail, or a hook that hints at a payoff.",
  likelihoodToAct:
    "Make the next step obvious and low-friction - a clear call to action and an explicit benefit for acting now.",
};

const DIM_LABEL: Record<keyof PersonaScores, string> = {
  attention: "attention",
  trust: "trust",
  engagement: "engagement",
  likelihoodToAct: "likelihood to act",
};

function templateNarrative(
  overall: PersonaScores,
  patterns: AudiencePatterns,
): Narrative {
  const strong = patterns.strongestDimension.dimension;
  const weak = patterns.weakestDimension.dimension;

  return {
    insightSummary:
      `Across the simulated audience, attention averaged ${overall.attention} and trust ${overall.trust}, ` +
      `with engagement at ${overall.engagement} and likelihood to act at ${overall.likelihoodToAct}. ` +
      `The content performs best on ${DIM_LABEL[strong]} and is weakest on ${DIM_LABEL[weak]}.`,
    strengths: [
      `Strong ${DIM_LABEL[strong]} (${Math.round(patterns.strongestDimension.value)}/100) - the content's biggest asset.`,
      patterns.bestCluster
        ? `Resonates most with the ${patterns.bestCluster.trait} segment (${Math.round(patterns.bestCluster.mean ?? 0)}/100).`
        : "Clear appeal within its strongest audience segment.",
    ],
    weaknesses: [
      `Weakest on ${DIM_LABEL[weak]} (${Math.round(patterns.weakestDimension.value)}/100).`,
      patterns.worstCluster
        ? `The ${patterns.worstCluster.trait} segment is hardest to win over (${Math.round(patterns.worstCluster.mean ?? 0)}/100).`
        : "Some segments remain unconvinced.",
    ],
    recommendations: [
      DIM_ADVICE[weak],
      patterns.polarization > 15
        ? "Reactions are polarized - consider tailoring variants to the segments that respond very differently."
        : "Reinforce what already works while lifting the weakest dimension above.",
    ],
  };
}

function computePatterns(
  overall: PersonaScores,
  results: PersonaSimulationResult[],
  clusters: ClusterBreakdownEntry[],
): AudiencePatterns {
  const dims = DIMENSIONS.map((d) => ({ dimension: d, value: overall[d] }));
  const sortedDims = [...dims].sort((a, b) => b.value - a.value);

  const clusterMeans = clusters.map((c) => ({
    trait: c.trait,
    mean:
      DIMENSIONS.reduce((acc, d) => acc + c.avgScores[d], 0) / DIMENSIONS.length,
  }));
  const sortedClusters = [...clusterMeans].sort((a, b) => b.mean - a.mean);

  const means = results
    .filter((r) => r.scores)
    .map((r) => personaMean(r.scores!));
  const avg = means.reduce((a, b) => a + b, 0) / (means.length || 1);
  const variance =
    means.reduce((a, b) => a + (b - avg) ** 2, 0) / (means.length || 1);

  return {
    strongestDimension: sortedDims[0],
    weakestDimension: sortedDims[sortedDims.length - 1],
    bestCluster: sortedClusters[0] ?? null,
    worstCluster: sortedClusters[sortedClusters.length - 1] ?? null,
    polarization: round(Math.sqrt(variance)),
  };
}

/**
 * Builds the full consensus report from the weighted persona responses.
 * Passing the image enables concrete, visual improvement recommendations.
 */
export async function buildConsensus(
  weighted: WeightedResponse[],
  image?: { base64: string; mimeType: string },
): Promise<ConsensusResult> {
  const results = weighted.map((w) => w.result).filter((r) => r.scores !== null);

  const overallScores = weightedAverage(weighted);
  const standoutQuotes = pickStandoutQuotes(results, overallScores);
  const clusterBreakdown = buildClusterBreakdown(results);
  const patterns = computePatterns(overallScores, results, clusterBreakdown);
  const narrative = await generateNarrative(
    overallScores,
    results.map((r) => r.reasoning),
    patterns,
    image,
  );

  return {
    overallScores,
    standoutQuotes,
    insightSummary: narrative.insightSummary,
    strengths: narrative.strengths,
    weaknesses: narrative.weaknesses,
    recommendations: narrative.recommendations,
    clusterBreakdown,
    patterns,
  };
}
