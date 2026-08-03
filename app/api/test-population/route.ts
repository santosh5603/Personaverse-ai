import { NextResponse } from "next/server";
import {
  generatePopulation,
  stratifySample,
  AGE_PROFESSION_POOL,
} from "@/lib/personaGenerator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const population = generatePopulation(1000);
  const buckets = stratifySample(population);

  // Same seed must produce an identical population every time.
  const rerun = generatePopulation(1000);
  const isDeterministic = JSON.stringify(population) === JSON.stringify(rerun);

  const countSum = buckets.reduce((acc, b) => acc + b.count, 0);

  // No persona should hold a profession implausible for its age bracket.
  const coherenceViolations = population.filter(
    (p) => !(AGE_PROFESSION_POOL[p.age] ?? []).includes(p.profession),
  ).length;

  return NextResponse.json({
    totalPopulation: population.length,
    bucketCount: buckets.length,
    bucketCountsSumTo: countSum,
    isDeterministic,
    coherenceViolations,
    sampleBuckets: buckets.slice(0, 3),
  });
}
