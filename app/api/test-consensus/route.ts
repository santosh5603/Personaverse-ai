import { NextResponse } from "next/server";
import { buildConsensus, type WeightedResponse } from "@/lib/consensusEngine";
import type { PersonaSimulationResult } from "@/lib/personaSimulator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function mock(
  personaId: number,
  personality: string,
  scores: [number, number, number, number],
  reasoning: string,
): PersonaSimulationResult {
  return {
    personaId,
    traits: { age: "25-34", profession: "Teacher", personality, commStyle: "Direct" },
    scores: {
      attention: scores[0],
      trust: scores[1],
      engagement: scores[2],
      likelihoodToAct: scores[3],
    },
    reasoning,
  };
}

// Hardcoded weighted responses. Weights sum to exactly 1000 for easy checking.
const MOCK: WeightedResponse[] = [
  { weight: 100, result: mock(1, "Analytical", [80, 60, 70, 50], "The data layout is clear and I can verify the claims.") },
  { weight: 200, result: mock(2, "Skeptical", [40, 80, 30, 20], "Looks legit but I'm not convinced I need this right now.") },
  { weight: 150, result: mock(3, "Trend-Driven", [90, 50, 85, 75], "This is everywhere right now, I have to check it out.") },
  { weight: 50, result: mock(4, "Analytical", [60, 70, 60, 40], "Reasonable presentation, though I'd want more detail.") },
  { weight: 300, result: mock(5, "Pragmatic", [20, 40, 25, 15], "Doesn't solve a problem I actually have. Passing.") },
  { weight: 200, result: mock(6, "Optimistic", [100, 90, 95, 90], "Absolutely love this, exactly what I've been looking for!") },
];

export async function GET() {
  const consensus = await buildConsensus(MOCK);

  // Independently recomputed expected weighted averages for verification.
  const weightSum = MOCK.reduce((a, w) => a + w.weight, 0);
  const dims = ["attention", "trust", "engagement", "likelihoodToAct"] as const;
  const expectedOverall: Record<string, number> = {};
  for (const d of dims) {
    const total = MOCK.reduce((a, w) => a + w.result.scores![d] * w.weight, 0);
    expectedOverall[d] = Math.round((total / weightSum) * 10) / 10;
  }

  return NextResponse.json({
    weightSum,
    expectedOverall,
    consensus,
  });
}
