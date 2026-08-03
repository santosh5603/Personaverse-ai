import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { getSimulationBundle } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid simulation id" }, { status: 400 });
  }

  const bundle = await getSimulationBundle(params.id);
  if (!bundle) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  // Owners only - a signed-in user can't read someone else's simulation.
  if (bundle.simulation.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(bundle);
}
