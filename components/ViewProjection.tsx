"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HORIZONS,
  type HorizonKey,
  computeForecast,
  horizonViews,
  makeSeries,
  viewsAt,
  formatViews,
  METHODOLOGY,
  type Scores,
  type Tone,
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
      const pr = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - pr, 3);
      setValue(from + (target - from) * eased);
      if (pr < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    // Safety net: rAF is paused in hidden/background tabs, so guarantee the
    // value still lands on target (setTimeout fires even when hidden).
    const fallback = setTimeout(() => {
      setValue(target);
      fromRef.current = target;
    }, duration + 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
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

const toneDot: Record<Tone, string> = {
  good: "bg-green-500",
  mid: "bg-amber-500",
  low: "bg-red-500",
};

export default function ViewProjection({ scores }: { scores: Scores }) {
  const [horizon, setHorizon] = useState<HorizonKey>("month");
  const spec = HORIZONS.find((h) => h.key === horizon)!;

  const forecast = useMemo(() => computeForecast(scores), [scores]);
  const totals = useMemo(() => horizonViews(forecast), [forecast]);
  const headline = useCountUp(totals[horizon]);
  const ctrShown = useCountUp(forecast.ctr);

  const series = useMemo(
    () => makeSeries(forecast, spec.days, 64),
    [forecast, spec.days],
  );
  const yMax = Math.max(viewsAt(forecast, spec.days), 1);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const sx = (t: number) => PAD.l + (t / spec.days) * plotW;
  const sy = (v: number) => PAD.t + plotH - (v / yMax) * plotH;

  const linePath = series
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${sx(pt.t).toFixed(1)} ${sy(pt.views).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${sx(spec.days).toFixed(1)} ${sy(0)} L ${sx(0).toFixed(1)} ${sy(0)} Z`;
  const end = series[series.length - 1];

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fr) => ({
    v: yMax * fr,
    y: sy(yMax * fr),
  }));

  const shareOfCeiling = Math.round((totals[horizon] / forecast.market) * 100);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tabular-nums tracking-tight text-primary">
              {formatViews(headline)}
            </span>
            <span className="text-lg text-muted-foreground">projected views</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            in the first {spec.label.toLowerCase()} · {shareOfCeiling}% of the
            estimated {formatViews(forecast.market)} reachable audience
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

      {/* Why this forecast — the derivation, shown so it isn't a black box */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">Why this forecast?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {forecast.factors.map((f) => (
            <div key={f.label} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <span className={`h-2 w-2 rounded-full ${toneDot[f.tone]}`} />
              </div>
              <div className="mt-0.5 text-xl font-bold tabular-nums">
                {f.label === "Click-through rate" ? `${ctrShown.toFixed(1)}%` : f.value}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {f.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{METHODOLOGY}</p>
    </div>
  );
}
