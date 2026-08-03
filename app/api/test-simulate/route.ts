import { NextResponse } from "next/server";
import { fetchYoutubeThumbnail } from "@/lib/contentIngestion";
import { simulatePersona } from "@/lib/personaSimulator";
import type { Persona } from "@/lib/personaGenerator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEST_PERSONAS: Persona[] = [
  {
    personaId: 1,
    age: "18-24",
    profession: "Student",
    personality: "Trend-Driven",
    commStyle: "Humorous",
  },
  {
    personaId: 2,
    age: "35-44",
    profession: "Small Business Owner",
    personality: "Skeptical",
    commStyle: "Direct",
  },
  {
    personaId: 3,
    age: "55+",
    profession: "Retired",
    personality: "Analytical",
    commStyle: "Formal",
  },
];

export async function GET() {
  try {
    // Real thumbnail so the multimodal input is genuine.
    const image = await fetchYoutubeThumbnail(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    const results = await Promise.all(
      TEST_PERSONAS.map((p) =>
        simulatePersona(
          p,
          image.base64,
          image.mimeType,
          "A music video thumbnail.",
        ),
      ),
    );

    const anyFailed = results.some((r) => r.scores === null);

    return NextResponse.json({
      ok: !anyFailed,
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      imageBytes: image.byteLength,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
