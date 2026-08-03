import {
  RateLimitError,
  type LLMProvider,
  type MultimodalJSONParams,
  type TextParams,
} from "./types";

/**
 * Chains providers: tries the primary, and on a RateLimitError falls through
 * to the next one. Any non-rate-limit error propagates immediately (a bad
 * request shouldn't silently hit the backup and burn its quota too).
 */
export class FallbackProvider implements LLMProvider {
  readonly id: string;
  readonly model: string;

  constructor(private readonly providers: LLMProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackProvider needs at least one provider");
    }
    this.id = providers.map((p) => p.id).join(">");
    this.model = providers[0].model;
  }

  private async run<T>(fn: (p: LLMProvider) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const provider of this.providers) {
      try {
        return await fn(provider);
      } catch (err) {
        lastErr = err;
        if (err instanceof RateLimitError) {
          // eslint-disable-next-line no-console
          console.warn(
            `[llm] ${provider.id} rate-limited; falling through to next provider`,
          );
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  generateMultimodalJSON(p: MultimodalJSONParams): Promise<string> {
    return this.run((provider) => provider.generateMultimodalJSON(p));
  }

  generateText(p: TextParams): Promise<string> {
    return this.run((provider) => provider.generateText(p));
  }
}
