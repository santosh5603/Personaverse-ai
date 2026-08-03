import { GoogleGenAI, Type } from "@google/genai";
import {
  RateLimitError,
  type LLMProvider,
  type MultimodalJSONParams,
  type SimpleObjectSchema,
  type TextParams,
} from "./types";

function toGeminiSchema(schema: SimpleObjectSchema) {
  const properties: Record<string, unknown> = {};
  for (const [key, type] of Object.entries(schema.fields)) {
    if (type === "string_array") {
      properties[key] = { type: Type.ARRAY, items: { type: Type.STRING } };
    } else {
      properties[key] = {
        type:
          type === "string"
            ? Type.STRING
            : type === "number"
              ? Type.NUMBER
              : Type.INTEGER,
      };
    }
  }
  return {
    type: Type.OBJECT,
    properties,
    required: schema.required ?? Object.keys(schema.fields),
  };
}

function isRateLimit(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota")
  );
}

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";
  readonly model: string;
  private client: GoogleGenAI;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateMultimodalJSON(p: MultimodalJSONParams): Promise<string> {
    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: p.image.mimeType, data: p.image.base64 } },
              { text: p.userText },
            ],
          },
        ],
        config: {
          systemInstruction: p.system,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(p.schema),
          // 2.5/3.5-flash "think" by default; off keeps ~24 parallel calls fast.
          thinkingConfig: { thinkingBudget: 0 },
          temperature: p.temperature ?? 0.9,
        },
      });
      return res.text ?? "";
    } catch (err) {
      if (isRateLimit(err)) throw new RateLimitError(String(err), this.id);
      throw err;
    }
  }

  async generateText(p: TextParams): Promise<string> {
    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: p.prompt,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          temperature: p.temperature ?? 0.7,
        },
      });
      return res.text ?? "";
    } catch (err) {
      if (isRateLimit(err)) throw new RateLimitError(String(err), this.id);
      throw err;
    }
  }
}
