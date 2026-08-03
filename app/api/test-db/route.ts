import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Simulation from "@/models/Simulation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    // 1. Insert
    const created = await Simulation.create({
      userId: "test-db-route",
      contentType: "image",
      imageBase64: "dGVzdA==",
      contextText: "round-trip smoke test",
      status: "pending",
    });

    // 2. Read back
    const readBack = await Simulation.findById(created._id).lean();

    // 3. Delete
    const { deletedCount } = await Simulation.deleteOne({ _id: created._id });

    // 4. Prove the delete actually landed
    const afterDelete = await Simulation.findById(created._id).lean();

    return NextResponse.json({
      ok: true,
      insertedId: created._id,
      readBack,
      deletedCount,
      existsAfterDelete: afterDelete !== null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
