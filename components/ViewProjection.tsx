"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HORIZONS,
  type HorizonKey,
  horizonViews,
  makeSeries,
  viewsAt,
  formatViews,
  type Scores,
} from "@/lib/projection";

const W = 640;
const H = 240;
const PAD = { l: 44, r: 16, t: 18, b: 26 };

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function xTicks(horizonDays: number): { t: number; label: string }[] {
  if (horizonDays <= 1)
    return [0, 6, 12, 18, 24].map((h) => ({ t: h / 24, label: `${h}h` }));
  if (horizonDays <= 7)
    return [0, 1, 2, 3, 4, 5, 6, 7].map((d) => ({ t: d, label: `D${d}` }));
  if (horizonDays <= 30)
    return [0, 7, 14, 21, 30].map((d) => ({ t: d, label: `${d}d` }));
  return [0, 90, 180, 270, 365].map((d) => ({ t: d, label: `${Math.round(d / 30)}mo` }));
}

export default function ViewProjection({ scores }: { scores: Scores }) {
  const [horizon, setHorizon] = useState<HorizonKey>("month");
  const spec = HORIZONS.find((h) => h.key === horizon)!;
  const totals = useMemo(() => horizonViews(scores), [scores]);
  const headline = useCountUp(totals[horizon]);

  const series = useMemo(
    () => makeSeries(scores, spec.days, 64),
    [scores, spec.days],
  );
  const yMax = Math.max(viewsAt(scores, spec.days), 1);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const sx = (t: number) => PAD.l + (t / spec.days) * plotW;
  const sy = (v: number) => PAD.t + plotH - (v / yMax) * plotH;

  const linePath = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.t).toFixed(1)} ${sy(p.views).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${sx(spec.days).toFixed(1)} ${sy(0)} L ${sx(0).toFixed(1)} ${sy(0)} Z`;
  const end = series[series.length - 1];

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    v: yMax * f,
    y: sy(yMax * f),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tabular-nums tracking-tight text-primary">
              {formatViews(headline)}
            </span>
            <span className="text-lg text-muted-foreground">views</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            projected in the first {spec.label.toLowerCase()} · out of a 1,000,000 ceiling
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HORIZONS.map((h) => (
            <button
              key={h.key}
              onClick={() => setHorizon(h.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                horizon === h.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-gradient-to-b from-primary/[0.03] to-transparent">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-foreground">
          <defs>
            <linearGradient id="pv-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* y gridlines + labels */}
          {yTicks.map((tk, i) => (
            <g key={i}>
              <line
                x1={PAD.l}
                y1={tk.y}
                x2={W - PAD.r}
                y2={tk.y}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <text
                x={PAD.l - 6}
                y={tk.y + 3}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
                fillOpacity={0.5}
              >
                {formatViews(tk.v)}
              </text>
            </g>
          ))}

          {/* x labels */}
          {xTicks(spec.days).map((tk, i) => (
            <text
              key={i}
              x={sx(tk.t)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.5}
            >
              {tk.label}
            </text>
          ))}

          {/* animated area + line (key restarts the draw on horizon change) */}
          <g key={horizon}>
            <path
              d={areaPath}
              fill="url(#pv-area)"
              style={{ animation: "pv-fade-up 0.7s ease forwards" }}
            />
            <path
              d={linePath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              style={{ animation: "pv-draw 1s ease forwards" }}
            />
            <circle
              cx={sx(end.t)}
              cy={sy(end.views)}
              r={4}
              fill="hsl(var(--primary))"
              style={{ animation: "pv-pulse 1.8s ease-in-out infinite 1s" }}
            />
          </g>
        </svg>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Heuristic forecast from the audience scores (attention, engagement,
        action, trust) — a directional estimate, not a guarantee.
      </p>
    </div>
  );
}
