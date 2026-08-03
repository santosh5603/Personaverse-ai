// Provider-neutral LLM interface. Nothing downstream imports a vendor SDK
// directly - they depend only on these types, so swapping Gemini for
// OpenRouter (or adding NVIDIA, Groq, etc.) is a new file + an env var.

export type FieldType = "integer" | "number" | "string" | "string_array";

export interface SimpleObjectSchema {
  fields: Record<string, FieldType>;
  required?: string[];
}

export interface MultimodalJSONParams {
  system: string;
  image: { base64: string; mimeType: string };
  userText: string;
  schema: SimpleObjectSchema;
  temperature?: number;
}

export interface TextParams {
  prompt: string;
  temperature?: number;
}

/** Thrown when a provider reports quota/rate exhaustion (HTTP 429 etc.). */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface LLMProvider {
  /** Stable identifier, e.g. "gemini" or "openrouter". */
  readonly id: string;
  /** The concrete model id in use. */
  readonly model: string;
  /** Multimodal (image + text) call that must return raw JSON text. */
  generateMultimodalJSON(params: MultimodalJSONParams): Promise<string>;
  /** Text-only completion. */
  generateText(params: TextParams): Promise<string>;
}
