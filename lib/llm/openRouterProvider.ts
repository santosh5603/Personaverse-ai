import {
  RateLimitError,
  type LLMProvider,
  type MultimodalJSONParams,
  type SimpleObjectSchema,
  type TextParams,
} from "./types";

// OpenRouter speaks the OpenAI Chat Completions API and proxies hundreds of
// models (Google, Meta/NVIDIA-hosted Llama, Mistral, DeepSeek, many with free
// tiers). One integration here covers "OpenRouter or NVIDIA or any other".

/**
 * Free OpenRouter models are unreliable with strict json_schema, so we use the
 * lenient json_object mode and spell out the required shape in the prompt.
 * The caller's parseResult tolerates fences / stray text.
 */
function describeSchema(schema: SimpleObjectSchema): string {
  const parts = Object.entries(schema.fields).map(([key, type]) =>
    type === "string_array"
      ? `"${key}" (array of strings)`
      : `"${key}" (${type})`,
  );
  return parts.join(", ");
}

export class OpenRouterProvider implements LLMProvider {
  readonly id = "openrouter";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    model: string,
    baseUrl = "https://openrouter.ai/api/v1",
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  private async chat(body: Record<string, unknown>): Promise<string> {
    // Free OpenRouter models can hang in a queue for minutes. Abort slow calls
    // so one laggard doesn't block the whole batch past the serverless budget.
    const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS ?? "20000");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          // Optional attribution headers OpenRouter recommends.
          "HTTP-Referer": "https://personaverse.local",
          "X-Title": "PersonaVerse AI",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (res.status === 429) {
        throw new RateLimitError(await res.text(), this.id);
      }
      if (!res.ok) {
        throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timer);
    }
  }

  async generateMultimodalJSON(p: MultimodalJSONParams): Promise<string> {
    const jsonInstruction = `Respond with a single JSON object containing exactly these fields: ${describeSchema(
      p.schema,
    )}. Output only the JSON object, no markdown.`;

    return this.chat({
      model: this.model,
      messages: [
        { role: "system", content: `${p.system}\n\n${jsonInstruction}` },
        {
          role: "user",
          content: [
            { type: "text", text: p.userText },
            {
              type: "image_url",
              image_url: {
                url: `data:${p.image.mimeType};base64,${p.image.base64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: p.temperature ?? 0.9,
    });
  }

  async generateText(p: TextParams): Promise<string> {
    return this.chat({
      model: this.model,
      messages: [{ role: "user", content: p.prompt }],
      temperature: p.temperature ?? 0.7,
    });
  }
}
