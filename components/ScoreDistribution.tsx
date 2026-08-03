interface Point {
  personaId: number;
  label: string;
  mean: number;
}

// Dependency-free strip plot: each persona's mean score on a 0-100 axis.
// Reveals whether the audience is unified or polarized.
export default function ScoreDistribution({
  points,
  average,
}: {
  points: Point[];
  average: number;
}) {
  const W = 100; // percentage-based coordinate space via viewBox
  const bandColor = (v: number) =>
    v >= 67 ? "#22c55e" : v >= 34 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      <div className="relative h-24 w-full rounded-lg border bg-muted/20">
        <svg viewBox={`0 0 ${W} 40`} preserveAspectRatio="none" className="h-full w-full">
          {/* axis gridlines at 25/50/75 */}
          {[25, 50, 75].map((g) => (
            <line
              key={g}
              x1={g}
              y1={2}
              x2={g}
              y2={38}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={0.3}
            />
          ))}
          {/* average marker */}
          <line
            x1={average}
            y1={0}
            x2={average}
            y2={40}
            stroke="hsl(var(--primary))"
            strokeWidth={0.6}
            strokeDasharray="1.5 1.5"
          />
          {/* persona dots (jittered vertically for visibility) */}
          {points.map((p, i) => {
            const jitter = 8 + ((i * 37) % 24);
            return (
              <circle
                key={p.personaId}
                cx={Math.max(1.5, Math.min(98.5, p.mean))}
                cy={jitter}
                r={1.6}
                fill={bandColor(p.mean)}
                fillOpacity={0.85}
              />
            );
          })}
        </svg>
        <span className="pointer-events-none absolute bottom-1 left-2 text-[10px] text-muted-foreground">
          0
        </span>
        <span className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-muted-foreground">
          100
        </span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#ef4444" }} />
          0–33
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} />
          34–66
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />
          67–100
        </span>
        <span className="ml-auto">
          Dashed line = audience average ({Math.round(average)})
        </span>
      </div>
    </div>
  );
}
