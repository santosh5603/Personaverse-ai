"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { computeMatrix, type Scores } from "@/lib/projection";

const METRICS = [
  { key: "see", label: "Would see it", color: "#6366f1", hint: "stops the scroll" },
  { key: "engage", label: "Would engage", color: "#a855f7", hint: "watch / explore" },
  { key: "trust", label: "Would trust it", color: "#10b981", hint: "feels credible" },
  { key: "click", label: "Would click / act", color: "#f43f5e", hint: "click, buy, share" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const COLS = 40;
const ROWS = 25; // 1000 cells

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
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
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

export default function PopulationMatrix({ scores }: { scores: Scores }) {
  const matrix = useMemo(() => computeMatrix(scores), [scores]);
  const [metric, setMetric] = useState<MetricKey>("click");
  const active = METRICS.find((m) => m.key === metric)!;
  const filled = matrix[metric];
  const shown = useCountUp(filled);
  const pct = Math.round((filled / 1000) * 100);

  // Precompute a shuffled cell order so the "filled" dots scatter naturally
  // instead of filling row-by-row.
  const order = useMemo(() => {
    const arr = Array.from({ length: COLS * ROWS }, (_, i) => i);
    let seed = 12345;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // rank[cellIndex] = position in fill order
    const rank = new Array(arr.length);
    arr.forEach((cell, pos) => (rank[cell] = pos));
    return rank as number[];
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-bold tabular-nums tracking-tight transition-colors"
              style={{ color: active.color }}
            >
              {shown.toLocaleString()}
            </span>
            <span className="text-lg text-muted-foreground">/ 1,000</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.label.toLowerCase()} — {pct}% of the audience ({active.hint})
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                metric === m.key
                  ? "text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              style={metric === m.key ? { background: m.color } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-5 grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const isOn = order[i] < filled;
          return (
            <div
              key={i}
              className="aspect-square rounded-[2px] transition-all duration-500"
              style={{
                background: isOn ? active.color : undefined,
                opacity: isOn ? 1 : 0.12,
                backgroundColor: isOn ? active.color : "currentColor",
                transitionDelay: `${(order[i] / 1000) * 500}ms`,
              }}
            />
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Each square represents 1 of 1,000 simulated people. Filled squares =
        those predicted to {active.label.replace("Would ", "").toLowerCase()}.
      </p>
    </div>
  );
}
