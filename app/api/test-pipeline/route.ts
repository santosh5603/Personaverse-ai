import { NextResponse, type NextRequest } from "next/server";
import { runSimulationPipeline, getSimulationBundle } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TEST_USER = "test-pipeline-user";

/**
 * Headless end-to-end proof of Step 7. The real POST /api/simulations is
 * Clerk-gated (verified via the browser in Step 8); this route runs the exact
 * same pipeline + persistence with a stub userId so it can be curled, then
 * reads all three collections back to confirm the writes landed.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const youtubeUrl =
      url.searchParams.get("youtubeUrl") ??
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    const started = Date.now();
    const run = await runSimulationPipeline({
      userId: TEST_USER,
      contentType: "youtube",
      youtubeUrl,
      contextText: "A music video thumbnail.",
    });
    const elapsedMs = Date.now() - started;

    const bundle = await getSimulationBundle(run.simulationId);

    return NextResponse.json({
      ok: true,
      elapsedMs,
      run,
      counts: {
        simulation: bundle?.simulation ? 1 : 0,
        personaResponses: bundle?.personaResponses.length ?? 0,
        consensusReport: bundle?.consensusReport ? 1 : 0,
      },
      bundle,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
