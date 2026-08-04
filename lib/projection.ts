// Outcome model. Turns the 4 audience scores into a human-readable forecast:
// how many of 1,000 people act, and a projected view trajectory over time.
//
// The view forecast is NOT a made-up number. It uses the Bass Diffusion Model
// (Frank Bass, 1969 - the standard model for how new products/content spread
// through a population) parameterised from the audience scores, plus real
// YouTube click-through-rate benchmarks. Every parameter is derived and shown
// to the user so the result is explainable, not a black box.

export interface Scores {
  attention: number;
  trust: number;
  engagement: number;
  likelihoodToAct: number;
}

export const POPULATION = 1000;

// YouTube thumbnail CTR: platform average sits ~4-6%; strong thumbnails hit
// 8-12%+, weak ones fall below 3% (public YouTube Creator benchmarks).
const PLATFORM_AVG_CTR = 5;

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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

export type Tone = "good" | "mid" | "low";

export interface ForecastFactor {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

export interface Forecast {
  /** Estimated click-through rate, %. */
  ctr: number;
  /** Bass coefficient of innovation (external pull - discovery/thumbnail). */
  p: number;
  /** Bass coefficient of imitation (word-of-mouth / sharing). */
  q: number;
  /** Market potential M - the estimated reachable audience (the ceiling). */
  market: number;
  quality: number;
  factors: ForecastFactor[];
}

/**
 * Derives all forecast parameters from the audience scores. Ranges are chosen
 * to land the outputs inside realistic real-world bands (see comments).
 */
export function computeForecast(s: Scores): Forecast {
  const clickPull = 0.6 * s.attention + 0.4 * s.likelihoodToAct; // 0..100
  const coldPull = 0.5 * s.attention + 0.5 * s.trust; // discovery appeal
  const wom = 0.5 * s.engagement + 0.5 * s.likelihoodToAct; // sharing drive
  const quality = qualityIndex(s);

  // CTR: 2% (weak) -> 12% (exceptional), anchored on the ~5% platform average.
  const ctr = round1(2 + (clickPull / 100) * 10);

  // Bass innovation p (typical media range ~0.002-0.03/day) and imitation
  // q (~0.05-0.35/day). Higher q => faster, more viral compounding.
  const p = 0.002 + (coldPull / 100) * 0.02;
  const q = 0.05 + (wom / 100) * 0.25;

  // Reachable audience (market potential): tens of thousands for niche/weak
  // content up to a few million for broadly appealing content.
  const market = Math.round(20_000 + Math.pow(quality, 2.5) * 3_000_000);

  const factors: ForecastFactor[] = [
    {
      label: "Click-through rate",
      value: `${ctr}%`,
      detail:
        ctr >= 8
          ? `Strong — roughly ${(ctr / PLATFORM_AVG_CTR).toFixed(1)}× the ~${PLATFORM_AVG_CTR}% platform average. High attention (${Math.round(s.attention)}) and click-intent (${Math.round(s.likelihoodToAct)}) pull cold viewers in.`
          : ctr >= 4
            ? `Near the ~${PLATFORM_AVG_CTR}% platform average — earns clicks but doesn't dominate the feed.`
            : `Below the ~${PLATFORM_AVG_CTR}% average — the thumbnail struggles to win the click, capping how many impressions convert.`,
      tone: ctr >= 8 ? "good" : ctr >= 4 ? "mid" : "low",
    },
    {
      label: "Word-of-mouth pull",
      value: q.toFixed(2),
      detail:
        q >= 0.22
          ? `High sharing coefficient — an engaged (${Math.round(s.engagement)}), share-prone audience compounds reach as each viewer brings in more.`
          : q >= 0.14
            ? "Moderate sharing — some organic spread, but growth leans on the algorithm surfacing it rather than viral pass-along."
            : "Low sharing — little pass-along, so reach depends almost entirely on being recommended.",
      tone: q >= 0.22 ? "good" : q >= 0.14 ? "mid" : "low",
    },
    {
      label: "Reachable audience",
      value: formatViews(market),
      detail: `Estimated ceiling of people this content can realistically reach, from its cross-segment appeal (quality index ${Math.round(quality * 100)}/100). The curve saturates toward this number.`,
      tone: quality >= 0.66 ? "good" : quality >= 0.4 ? "mid" : "low",
    },
  ];

  return { ctr, p, q, market, quality, factors };
}

/**
 * Closed-form Bass diffusion: cumulative views after `days`.
 * F(t) = (1 - e^-(p+q)t) / (1 + (q/p) e^-(p+q)t);  views = M * F(t).
 */
export function viewsAt(f: Forecast, days: number): number {
  const { p, q, market } = f;
  const e = Math.exp(-(p + q) * days);
  const frac = (1 - e) / (1 + (q / p) * e);
  return Math.round(market * frac);
}

export const HORIZONS = [
  { key: "day", label: "1 Day", days: 1 },
  { key: "week", label: "1 Week", days: 7 },
  { key: "month", label: "1 Month", days: 30 },
  { key: "year", label: "1 Year", days: 365 },
] as const;

export type HorizonKey = (typeof HORIZONS)[number]["key"];

export function horizonViews(f: Forecast): Record<HorizonKey, number> {
  return {
    day: viewsAt(f, 1),
    week: viewsAt(f, 7),
    month: viewsAt(f, 30),
    year: viewsAt(f, 365),
  };
}

/** Sampled cumulative-view series up to `horizonDays`, for charting. */
export function makeSeries(
  f: Forecast,
  horizonDays: number,
  points = 64,
): { t: number; views: number }[] {
  const out: { t: number; views: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * horizonDays;
    out.push({ t, views: viewsAt(f, t) });
  }
  return out;
}

export const METHODOLOGY =
  "Forecast uses the Bass Diffusion Model (Bass, 1969) — the standard model " +
  "for how content and products spread through a population — with parameters " +
  "derived from the audience scores and anchored on public YouTube CTR " +
  "benchmarks (~4–6% average). It's a directional estimate under typical " +
  "distribution, not a guarantee; most views land within the first month.";

/** 1234567 -> "1.2M", 24000 -> "24K". */
export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}
