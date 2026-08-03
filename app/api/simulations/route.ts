import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { runSimulationPipeline, type PipelineInput } from "@/lib/pipeline";
import connectToDatabase from "@/lib/mongodb";
import Simulation from "@/models/Simulation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/simulations - the signed-in user's past simulations, newest first.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const simulations = await Simulation.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("contentType sourceUrl contextText status createdAt")
    .lean();

  return NextResponse.json({
    simulations: simulations.map((s) => ({
      id: String(s._id),
      contentType: s.contentType,
      sourceUrl: s.sourceUrl ?? null,
      contextText: s.contextText ?? null,
      status: s.status,
      createdAt: s.createdAt,
    })),
  });
}

const youtubeSchema = z.object({
  contentType: z.literal("youtube"),
  youtubeUrl: z.string().url(),
  contextText: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let input: PipelineInput;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("imageFile") ?? form.get("file");
      const contextText = form.get("contextText");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Expected an 'imageFile' upload in the form data" },
          { status: 400 },
        );
      }

      input = {
        userId,
        contentType: "image",
        imageFile: file,
        contextText: typeof contextText === "string" ? contextText : undefined,
      };
    } else {
      const parsed = youtubeSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      input = { userId, ...parsed.data };
    }

    const result = await runSimulationPipeline(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
