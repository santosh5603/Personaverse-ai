import { GeminiProvider } from "./geminiProvider";
import { OpenRouterProvider } from "./openRouterProvider";
import { FallbackProvider } from "./fallbackProvider";
import type { LLMProvider } from "./types";

export { RateLimitError } from "./types";
export type {
  LLMProvider,
  MultimodalJSONParams,
  TextParams,
  SimpleObjectSchema,
} from "./types";

let cached: LLMProvider | null = null;

function buildGemini(): LLMProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GeminiProvider(key, process.env.GEMINI_MODEL ?? "gemini-3.5-flash");
}

function buildOpenRouter(): LLMProvider | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  return new OpenRouterProvider(
    key,
    process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-nano-12b-v2-vl:free",
  );
}

/**
 * The configured providers as an ordered list (primary first), WITHOUT the
 * fallback wrapper. Bulk persona simulation splits load across this pool so
 * both free-tier quotas are used in parallel instead of hammering one.
 */
export function getProviderPool(): LLMProvider[] {
  const primaryName = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
  const gemini = buildGemini();
  const openrouter = buildOpenRouter();
  const chain =
    primaryName === "openrouter" ? [openrouter, gemini] : [gemini, openrouter];
  const pool = chain.filter((p): p is LLMProvider => p !== null);
  if (pool.length === 0) {
    throw new Error(
      "No LLM provider configured. Set GEMINI_API_KEY and/or OPENROUTER_API_KEY in .env.local.",
    );
  }
  return pool;
}

/**
 * Assembles the provider chain from env.
 *
 * LLM_PROVIDER picks the primary ("gemini" default, or "openrouter"). If the
 * OTHER provider's key is also present it's attached as an automatic fallback,
 * so a mid-run 429 transparently rolls over instead of failing the pipeline.
 * Flipping primary is a one-line .env change - no code edits.
 */
function buildProvider(): LLMProvider {
  const primaryName = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
  const gemini = buildGemini();
  const openrouter = buildOpenRouter();

  const chain: LLMProvider[] =
    primaryName === "openrouter"
      ? [openrouter, gemini].filter((p): p is LLMProvider => p !== null)
      : [gemini, openrouter].filter((p): p is LLMProvider => p !== null);

  if (chain.length === 0) {
    throw new Error(
      "No LLM provider configured. Set GEMINI_API_KEY and/or OPENROUTER_API_KEY in .env.local.",
    );
  }

  return chain.length === 1 ? chain[0] : new FallbackProvider(chain);
}

export function getLLM(): LLMProvider {
  if (!cached) cached = buildProvider();
  return cached;
}

/** For diagnostics / test routes: which provider chain is active. */
export function activeProviderId(): string {
  return getLLM().id;
}
