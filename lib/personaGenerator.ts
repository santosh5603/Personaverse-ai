export interface Persona {
  personaId: number;
  age: string;
  profession: string;
  personality: string;
  commStyle: string;
}

export interface PersonaBucket {
  segmentKey: string;
  ageBracket: string;
  mindset: string;
  /** How many of the 1000 personas fall in this bucket. Used to weight consensus. */
  count: number;
  representative: Persona;
}

export const AGE_BRACKETS = [
  "13-17",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55+",
] as const;

export const PROFESSIONS = [
  "Student",
  "Software Engineer",
  "Small Business Owner",
  "Healthcare Worker",
  "Teacher",
  "Marketing Professional",
  "Skilled Tradesperson",
  "Retired",
] as const;

export const PERSONALITIES = [
  "Analytical",
  "Skeptical",
  "Pragmatic",
  "Impulsive",
  "Trend-Driven",
  "Optimistic",
  "Community-Minded",
] as const;

export const COMM_STYLES = [
  "Direct",
  "Storytelling",
  "Data-Driven",
  "Humorous",
  "Formal",
  "Casual",
] as const;

/**
 * Professions are drawn from an age-appropriate pool rather than the full list.
 *
 * Sampling all 4 traits independently produces incoherent personas - a 13-17
 * year old "Retired" persona, a 55+ "Student" - and those get rendered verbatim
 * into the Gemini system prompt in Step 5, where they yield nonsense reasoning
 * that then feeds the weighted consensus. The master PROFESSIONS list is still
 * 8 long; each age bracket just draws from a plausible subset of it.
 */
export const AGE_PROFESSION_POOL: Record<string, readonly string[]> = {
  "13-17": ["Student"],
  "18-24": [
    "Student",
    "Software Engineer",
    "Marketing Professional",
    "Skilled Tradesperson",
    "Healthcare Worker",
    "Teacher",
  ],
  "25-34": [
    "Software Engineer",
    "Small Business Owner",
    "Healthcare Worker",
    "Teacher",
    "Marketing Professional",
    "Skilled Tradesperson",
  ],
  "35-44": [
    "Software Engineer",
    "Small Business Owner",
    "Healthcare Worker",
    "Teacher",
    "Marketing Professional",
    "Skilled Tradesperson",
  ],
  "45-54": [
    "Software Engineer",
    "Small Business Owner",
    "Healthcare Worker",
    "Teacher",
    "Marketing Professional",
    "Skilled Tradesperson",
  ],
  "55+": [
    "Retired",
    "Small Business Owner",
    "Teacher",
    "Healthcare Worker",
    "Skilled Tradesperson",
  ],
};

/**
 * Stratification happens on age x mindset rather than on the full 4-trait tuple.
 *
 * The full tuple has 6 x 8 x 7 x 6 = 2016 combinations, so bucketing 1000
 * personas that way produces ~800 near-singleton buckets - useless for
 * weighting, and one LLM call per bucket would be ~800 calls. Collapsing the 7
 * personalities onto 4 buying mindsets gives 6 x 4 = 24 dense buckets while
 * every representative persona still carries its own full trait set.
 */
const PERSONALITY_TO_MINDSET: Record<string, string> = {
  Analytical: "Evidence Seeker",
  Skeptical: "Evidence Seeker",
  Pragmatic: "Value Calculator",
  Impulsive: "Impulse Responder",
  "Trend-Driven": "Impulse Responder",
  Optimistic: "Enthusiastic Sharer",
  "Community-Minded": "Enthusiastic Sharer",
};

export function mindsetOf(personality: string): string {
  return PERSONALITY_TO_MINDSET[personality] ?? "Value Calculator";
}

/**
 * mulberry32 - small, fast, seedable PRNG. Using a seeded generator instead of
 * Math.random keeps generatePopulation deterministic, so the same seed always
 * yields the same 1000 personas and results stay reproducible across runs.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Builds a population of algorithmic personas. Pure computation - no API calls,
 * no I/O, no randomness beyond the seeded PRNG.
 */
export function generatePopulation(size = 1000, seed = 20260724): Persona[] {
  const rand = mulberry32(seed);
  const population: Persona[] = [];

  for (let i = 0; i < size; i++) {
    const age = pick(AGE_BRACKETS, rand);
    population.push({
      personaId: i,
      age,
      profession: pick(AGE_PROFESSION_POOL[age] ?? PROFESSIONS, rand),
      personality: pick(PERSONALITIES, rand),
      commStyle: pick(COMM_STYLES, rand),
    });
  }

  return population;
}

function modeOf(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  let best = values[0];
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Groups the population into audience segments and elects one representative
 * persona per segment. The representative is the member whose profession and
 * comm style are the segment's most common values, so it genuinely typifies
 * its bucket rather than being an arbitrary first-match.
 */
export function stratifySample(population: Persona[]): PersonaBucket[] {
  const groups = new Map<string, Persona[]>();

  for (const persona of population) {
    const key = `${persona.age} | ${mindsetOf(persona.personality)}`;
    const existing = groups.get(key);
    if (existing) existing.push(persona);
    else groups.set(key, [persona]);
  }

  const buckets: PersonaBucket[] = [];

  for (const [segmentKey, members] of groups) {
    const modalProfession = modeOf(members.map((m) => m.profession));
    const modalCommStyle = modeOf(members.map((m) => m.commStyle));

    const representative =
      members.find(
        (m) => m.profession === modalProfession && m.commStyle === modalCommStyle,
      ) ??
      members.find((m) => m.profession === modalProfession) ??
      members[0];

    buckets.push({
      segmentKey,
      ageBracket: representative.age,
      mindset: mindsetOf(representative.personality),
      count: members.length,
      representative,
    });
  }

  // Stable ordering so runs are comparable.
  buckets.sort((a, b) => a.segmentKey.localeCompare(b.segmentKey));

  return buckets;
}
