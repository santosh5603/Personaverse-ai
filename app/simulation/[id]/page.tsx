import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSimulationBundle } from "@/lib/pipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PersonaGraph, { type GraphPersona } from "@/components/PersonaGraph";
import RadarChart from "@/components/RadarChart";
import ScoreDistribution from "@/components/ScoreDistribution";
import PopulationMatrix from "@/components/PopulationMatrix";
import ViewProjection from "@/components/ViewProjection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIMENSIONS = [
  { key: "attention", label: "Attention" },
  { key: "trust", label: "Trust" },
  { key: "engagement", label: "Engagement" },
  { key: "likelihoodToAct", label: "Likelihood to Act" },
] as const;

const DIM_LABEL: Record<string, string> = {
  attention: "Attention",
  trust: "Trust",
  engagement: "Engagement",
  likelihoodToAct: "Likelihood to Act",
};

function scoreClasses(v: number): string {
  if (v >= 67) return "text-green-600 dark:text-green-400";
  if (v >= 34) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-500";
}

function mean4(s: {
  attention?: number | null;
  trust?: number | null;
  engagement?: number | null;
  likelihoodToAct?: number | null;
}): number {
  return (
    ((s.attention ?? 0) + (s.trust ?? 0) + (s.engagement ?? 0) + (s.likelihoodToAct ?? 0)) / 4
  );
}

export default async function SimulationPage({
  params,
}: {
  params: { id: string };
}) {
  const { userId } = await auth();
  const bundle = await getSimulationBundle(params.id);

  if (!bundle || bundle.simulation.userId !== userId) notFound();

  const { simulation, personaResponses, consensusReport } = bundle;

  if (simulation.status === "failed" || !consensusReport) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Simulation didn&apos;t complete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This run ended with status “{simulation.status}”. Try running it again.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </main>
    );
  }

  const overall = consensusReport.overallScores;
  const clusters = consensusReport.clusterBreakdown ?? [];
  const quotes = consensusReport.standoutQuotes ?? [];
  const strengths = consensusReport.strengths ?? [];
  const weaknesses = consensusReport.weaknesses ?? [];
  const recommendations = consensusReport.recommendations ?? [];
  const patterns = consensusReport.patterns;

  // Normalize persona responses to plain props for the client graph.
  const graphPersonas: GraphPersona[] = personaResponses
    .filter((r) => r.scores && r.traits)
    .map((r) => ({
      personaId: r.personaId,
      traits: {
        age: r.traits?.age ?? "",
        profession: r.traits?.profession ?? "",
        personality: r.traits?.personality ?? "",
        commStyle: r.traits?.commStyle ?? "",
      },
      scores: {
        attention: r.scores?.attention ?? 0,
        trust: r.scores?.trust ?? 0,
        engagement: r.scores?.engagement ?? 0,
        likelihoodToAct: r.scores?.likelihoodToAct ?? 0,
      },
      reasoning: r.reasoning ?? "",
    }));

  const segmentCount = clusters.length;

  const distributionPoints = graphPersonas.map((p) => ({
    personaId: p.personaId,
    label: `${p.traits.age} ${p.traits.profession}`,
    mean: mean4(p.scores),
  }));
  const overallMean = mean4(overall ?? {});

  const radarData = DIMENSIONS.map((d) => ({
    label: d.label.split(" ")[0],
    value: overall?.[d.key] ?? 0,
  }));

  const scores = {
    attention: overall?.attention ?? 0,
    trust: overall?.trust ?? 0,
    engagement: overall?.engagement ?? 0,
    likelihoodToAct: overall?.likelihoodToAct ?? 0,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {simulation.contentType === "youtube" ? "YouTube thumbnail" : "Uploaded image"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Audience simulation</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">New simulation</Link>
        </Button>
      </div>

      {/* Insight summary */}
      <Card className="mt-6 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Insight</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[15px] leading-relaxed">{consensusReport.insightSummary}</p>
        </CardContent>
      </Card>

      {/* Score cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {DIMENSIONS.map((d) => {
          const v = overall?.[d.key] ?? 0;
          return (
            <Card key={d.key}>
              <CardContent className="pt-6 text-center">
                <div className={`text-4xl font-bold tabular-nums ${scoreClasses(v)}`}>
                  {Math.round(v)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{d.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Predicted reach */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Predicted reach</h2>
        <Card>
          <CardContent className="pt-6">
            <ViewProjection scores={scores} />
          </CardContent>
        </Card>
      </section>

      {/* Population matrix */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Who responds — out of 1,000</h2>
        <Card>
          <CardContent className="pt-6">
            <PopulationMatrix scores={scores} />
          </CardContent>
        </Card>
      </section>

      {/* Recommendations — how to improve the input */}
      {recommendations.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            How to improve this content
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {recommendations.map((rec, i) => (
              <Card key={i} className="border-primary/30">
                <CardContent className="flex gap-3 pt-6">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{rec}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Strengths & weaknesses */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {strengths.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-600 dark:text-green-400">
                  What&apos;s working
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-green-600 dark:text-green-400">+</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {weaknesses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-600 dark:text-red-500">
                  What&apos;s holding it back
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-red-600 dark:text-red-500">−</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Radar + patterns */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Dimension profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto h-64 max-w-xs text-foreground">
              <RadarChart data={radarData} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Patterns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {patterns ? (
              <>
                <PatternRow
                  label="Strongest signal"
                  value={`${DIM_LABEL[patterns.strongestDimension?.dimension ?? ""] ?? "—"} (${Math.round(patterns.strongestDimension?.value ?? 0)})`}
                  tone="good"
                />
                <PatternRow
                  label="Weakest signal"
                  value={`${DIM_LABEL[patterns.weakestDimension?.dimension ?? ""] ?? "—"} (${Math.round(patterns.weakestDimension?.value ?? 0)})`}
                  tone="bad"
                />
                <PatternRow
                  label="Most receptive segment"
                  value={
                    patterns.bestCluster
                      ? `${patterns.bestCluster.trait} (${Math.round(patterns.bestCluster.mean ?? 0)})`
                      : "—"
                  }
                  tone="good"
                />
                <PatternRow
                  label="Toughest segment"
                  value={
                    patterns.worstCluster
                      ? `${patterns.worstCluster.trait} (${Math.round(patterns.worstCluster.mean ?? 0)})`
                      : "—"
                  }
                  tone="bad"
                />
                <PatternRow
                  label="Audience polarization"
                  value={`±${Math.round(patterns.polarization ?? 0)} pts`}
                  tone="neutral"
                />
              </>
            ) : (
              <p className="text-muted-foreground">No pattern data.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Score distribution */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Response distribution</h2>
        <Card>
          <CardContent className="pt-6">
            <ScoreDistribution points={distributionPoints} average={overallMean} />
          </CardContent>
        </Card>
      </section>

      {/* Persona node map */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Persona map</h2>
        <PersonaGraph personas={graphPersonas} />
        <p className="mt-2 text-xs text-muted-foreground">
          Sampled from 1,000 simulated personas across {segmentCount} audience
          segments. Each outer node is a representative persona; hubs are
          personality clusters.
        </p>
      </section>

      {/* Standout quotes */}
      {quotes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Standout reactions</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {quotes.map((q, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <p className="text-sm italic">“{q}”</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Cluster breakdown */}
      {clusters.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">By personality cluster</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {clusters.map((c) => (
                  <div key={c.trait} className="flex items-center gap-3">
                    <div className="flex w-40 items-center gap-2">
                      <span className="text-sm font-medium">{c.trait}</span>
                      <Badge variant="secondary" className="text-xs">
                        {c.count}
                      </Badge>
                    </div>
                    <div className="flex flex-1 gap-2">
                      {DIMENSIONS.map((d) => {
                        const v = c.avgScores?.[d.key] ?? 0;
                        return (
                          <div key={d.key} className="flex-1">
                            <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                              <span>{d.label.split(" ")[0]}</span>
                              <span className="tabular-nums">{Math.round(v)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${v}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}

function PatternRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
}) {
  const dot =
    tone === "good" ? "bg-green-500" : tone === "bad" ? "bg-red-500" : "bg-muted-foreground";
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
