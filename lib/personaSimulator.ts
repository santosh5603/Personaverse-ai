import {
  getProviderPool,
  RateLimitError,
  type LLMProvider,
  type SimpleObjectSchema,
} from "@/lib/llm";
import type { Persona } from "@/lib/personaGenerator";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PersonaScores {
  attention: number;
  trust: number;
  engagement: number;
  likelihoodToAct: number;
}

export interface PersonaSimulationResult {
  personaId: number;
  traits: {
    age: string;
    profession: string;
    personality: string;
    commStyle: string;
  };
  scores: PersonaScores | null;
  reasoning: string;
}

const RESPONSE_SCHEMA: SimpleObjectSchema = {
  fields: {
    attention: "integer",
    trust: "integer",
    engagement: "integer",
    likelihoodToAct: "integer",
    reasoning: "string",
  },
  required: ["attention", "trust", "engagement", "likelihoodToAct", "reasoning"],
};

function buildSystemPrompt(persona: Persona): string {
  return [
    "You are a synthetic audience member reacting to a piece of visual content",
    "(a video thumbnail or an image ad). Stay fully in character.",
    "",
    "Your profile:",
    `- Age bracket: ${persona.age}`,
    `- Profession: ${persona.profession}`,
    `- Personality: ${persona.personality}`,
    `- Communication style: ${persona.commStyle}`,
    "",
    "React as THIS person would - their age, job, temperament and how they",
    "consume media all shape what grabs them and what they distrust.",
    "",
    "Score each dimension from 0 to 100 (integers):",
    "- attention: how strongly the visual stops your scroll and holds your eye",
    "- trust: how credible and non-scammy it feels to you",
    "- engagement: how much you'd want to watch, read, comment or explore further",
    "- likelihoodToAct: how likely you are to click, buy, subscribe or share",
    "",
    "Then give one or two sentences of reasoning IN THIS PERSONA'S VOICE",
    "explaining the scores. Be specific to what you see in the image.",
  ].join("\n");
}

function isValidScores(obj: unknown): obj is PersonaScores {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (["attention", "trust", "engagement", "likelihoodToAct"] as const).every(
    (k) => typeof o[k] === "number" && o[k]! >= 0 && o[k]! <= 100,
  );
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function callLLM(
  provider: LLMProvider,
  systemInstruction: string,
  imageBase64: string,
  mimeType: string,
  userText: string,
): Promise<string> {
  return provider.generateMultimodalJSON({
    system: systemInstruction,
    image: { base64: imageBase64, mimeType },
    userText,
    schema: RESPONSE_SCHEMA,
    temperature: 0.9,
  });
}

function parseResult(raw: string): {
  scores: PersonaScores;
  reasoning: string;
} | null {
  let text = raw.trim();
  // Strip markdown fences if the model wrapped the JSON despite instructions.
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  try {
    const parsed: Record<string, unknown> = JSON.parse(text);
    const reasoning = parsed.reasoning;
    if (!isValidScores(parsed)) return null;
    return {
      scores: {
        attention: clamp(parsed.attention),
        trust: clamp(parsed.trust),
        engagement: clamp(parsed.engagement),
        likelihoodToAct: clamp(parsed.likelihoodToAct),
      },
      reasoning:
        typeof reasoning === "string" && reasoning.trim().length > 0
          ? reasoning.trim()
          : "(no reasoning provided)",
    };
  } catch {
    return null;
  }
}

/**
 * Runs one persona through the given provider against the supplied image.
 * Retries once with a stricter instruction on parse failure and backs off on
 * rate limits, then returns a fallback object (scores: null) rather than
 * throwing, so one bad call can't sink the batch.
 */
export async function simulatePersonaWith(
  provider: LLMProvider,
  persona: Persona,
  imageBase64: string,
  mimeType: string,
  contextText?: string,
  deadline = Infinity,
): Promise<PersonaSimulationResult> {
  const system = buildSystemPrompt(persona);
  const baseUser = contextText
    ? `Additional context about this content: ${contextText}\n\nReact to the image.`
    : "React to the image.";

  const traits = {
    age: persona.age,
    profession: persona.profession,
    personality: persona.personality,
    commStyle: persona.commStyle,
  };

  const fallback = (reasoning: string): PersonaSimulationResult => ({
    personaId: persona.personaId,
    traits,
    scores: null,
    reasoning,
  });

  // Bounded retries. Free-tier quotas are tiny (Gemini ~20 req/window), so
  // rate-limit backoff is short and capped by the overall pipeline deadline -
  // a hung bucket must never stall the whole run.
  const MAX_RATE_RETRIES = 3;
  let parseRetried = false;
  let rateRetries = 0;

  while (true) {
    if (Date.now() >= deadline) return fallback("simulation skipped: time budget exceeded");

    const userText = parseRetried
      ? `${baseUser}\n\nReturn ONLY valid JSON matching the required fields. No markdown, no code fences, no commentary.`
      : baseUser;

    try {
      const raw = await callLLM(provider, system, imageBase64, mimeType, userText);
      const parsed = parseResult(raw);
      if (parsed) return { personaId: persona.personaId, traits, ...parsed };

      if (!parseRetried) {
        parseRetried = true;
        continue;
      }
      return fallback("simulation failed: invalid JSON after retry");
    } catch (err) {
      if (err instanceof RateLimitError && rateRetries < MAX_RATE_RETRIES) {
        // 2s, 4s, 8s (+ jitter), but never past the deadline.
        const waitMs = 2000 * 2 ** rateRetries + Math.random() * 500;
        rateRetries++;
        if (Date.now() + waitMs >= deadline) {
          return fallback("simulation failed: rate limited (no time to retry)");
        }
        await sleep(waitMs);
        continue;
      }
      return fallback(
        err instanceof RateLimitError
          ? "simulation failed: rate limited (retries exhausted)"
          : `simulation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Runs a small pool of async tasks with bounded concurrency. Free-tier Gemini
 * keys throttle around 10 RPM, so firing all ~24 buckets at once returns 429s.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export interface SimulateAllOutcome {
  succeeded: PersonaSimulationResult[];
  failedCount: number;
  rateLimitedCount: number;
  /** How many personas each provider was assigned, e.g. { gemini: 12, openrouter: 12 }. */
  providerSplit: Record<string, number>;
}

/**
 * Simulates every sampled persona, splitting the load across all configured
 * providers in parallel (round-robin). With two free-tier keys each provider
 * handles ~half the buckets, halving the per-provider request rate so both
 * quotas are used without either being hammered into 429s. Each provider's
 * share runs with its own bounded concurrency + per-call 429 backoff.
 */
export async function simulateAllPersonasDetailed(
  personas: Persona[],
  imageBase64: string,
  mimeType: string,
  contextText?: string,
  concurrencyPerProvider = 3,
  primaryWeight = Number(process.env.SIM_PRIMARY_WEIGHT ?? "3"),
  budgetMs = Number(process.env.SIM_BUDGET_MS ?? "50000"),
): Promise<SimulateAllOutcome> {
  const pool = getProviderPool();
  const deadline = Date.now() + budgetMs;

  // Weighted round-robin: the primary (first, most reliable) provider takes
  // `primaryWeight` shares to each other provider's one. With weight 2 and a
  // [gemini, openrouter] pool, Gemini gets ~2/3 of the buckets.
  const weights = pool.map((_, i) => (i === 0 ? Math.max(1, primaryWeight) : 1));
  const sequence: number[] = [];
  weights.forEach((w, i) => {
    for (let k = 0; k < w; k++) sequence.push(i);
  });

  const groups: Persona[][] = pool.map(() => []);
  personas.forEach((p, i) => {
    groups[sequence[i % sequence.length]].push(p);
  });

  const providerSplit: Record<string, number> = {};
  pool.forEach((provider, i) => {
    providerSplit[provider.id] = groups[i].length;
  });

  // Run each provider's share in parallel, each internally concurrency-limited.
  const perProvider = await Promise.all(
    pool.map((provider, i) =>
      mapWithConcurrency(groups[i], concurrencyPerProvider, (p) =>
        simulatePersonaWith(provider, p, imageBase64, mimeType, contextText, deadline),
      ),
    ),
  );

  const all = perProvider.flat();
  const succeeded = all.filter((r) => r.scores !== null);
  const failed = all.filter((r) => r.scores === null);
  const rateLimitedCount = failed.filter((r) =>
    r.reasoning.includes("rate limited"),
  ).length;

  return {
    succeeded,
    failedCount: failed.length,
    rateLimitedCount,
    providerSplit,
  };
}

/**
 * Convenience wrapper preserving the original signature: just the scored ones.
 */
export async function simulateAllPersonas(
  personas: Persona[],
  imageBase64: string,
  mimeType: string,
  contextText?: string,
  concurrencyPerProvider = 3,
): Promise<PersonaSimulationResult[]> {
  const { succeeded } = await simulateAllPersonasDetailed(
    personas,
    imageBase64,
    mimeType,
    contextText,
    concurrencyPerProvider,
  );
  return succeeded;
}

/**
 * Single-persona entry point using the primary provider. Kept for the Step 5
 * test route; the bulk path uses simulatePersonaWith across the pool.
 */
export async function simulatePersona(
  persona: Persona,
  imageBase64: string,
  mimeType: string,
  contextText?: string,
): Promise<PersonaSimulationResult> {
  const [primary] = getProviderPool();
  return simulatePersonaWith(primary, persona, imageBase64, mimeType, contextText);
}
