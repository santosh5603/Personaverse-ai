// Deterministic outcome model. Turns the 4 audience scores into a
// human-readable forecast: how many of 1,000 people act, and a projected
// view curve out of 1,000,000 over time. Heuristic, not a guarantee - but
// stable and monotonic so the story is consistent.

export interface Scores {
  attention: number;
  trust: number;
  engagement: number;
  likelihoodToAct: number;
}

export const VIEW_CEILING = 1_000_000;
export const POPULATION = 1000;

export interface MatrixCounts {
  see: number;
  engage: number;
  trust: number;
  click: number;
}

/** Expected people (out of 1,000) per behaviour = weighted score share x 1,000. */
export function computeMatrix(s: Scores): MatrixCounts {
  return {
    see: Math.round((s.attention / 100) * POPULATION),
    engage: Math.round((s.engagement / 100) * POPULATION),
    trust: Math.round((s.trust / 100) * POPULATION),
    click: Math.round((s.likelihoodToAct / 100) * POPULATION),
  };
}

/** 0..1 overall quality index, weighted toward attention + engagement. */
export function qualityIndex(s: Scores): number {
  return (
    (0.35 * s.attention +
      0.3 * s.engagement +
      0.2 * s.likelihoodToAct +
      0.15 * s.trust) /
    100
  );
}

/** Saturation ceiling of the view curve (out of 1,000,000). */
export function viewCeiling(s: Scores): number {
  const q = qualityIndex(s);
  // Nonlinear: strong content vastly outperforms mediocre content.
  return VIEW_CEILING * Math.pow(q, 2.2);
}

/** Per-day growth constant - virality (engagement + action) speeds saturation. */
function growthRate(s: Scores): number {
  const virality = (s.engagement + s.likelihoodToAct) / 200; // 0..1
  return 0.02 + 0.16 * virality;
}

/** Cumulative predicted views after `days`. */
export function viewsAt(s: Scores, days: number): number {
  const ceiling = viewCeiling(s);
  const k = growthRate(s);
  return Math.round(ceiling * (1 - Math.exp(-k * days)));
}

export const HORIZONS = [
  { key: "day", label: "1 Day", days: 1 },
  { key: "week", label: "1 Week", days: 7 },
  { key: "month", label: "1 Month", days: 30 },
  { key: "year", label: "1 Year", days: 365 },
] as const;

export type HorizonKey = (typeof HORIZONS)[number]["key"];

export function horizonViews(s: Scores): Record<HorizonKey, number> {
  return {
    day: viewsAt(s, 1),
    week: viewsAt(s, 7),
    month: viewsAt(s, 30),
    year: viewsAt(s, 365),
  };
}

/** Sampled cumulative-view series up to `horizonDays`, for charting. */
export function makeSeries(
  s: Scores,
  horizonDays: number,
  points = 60,
): { t: number; views: number }[] {
  const out: { t: number; views: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * horizonDays;
    out.push({ t, views: viewsAt(s, t) });
  }
  return out;
}

/** 1234567 -> "1.2M", 24000 -> "24K". */
export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}
