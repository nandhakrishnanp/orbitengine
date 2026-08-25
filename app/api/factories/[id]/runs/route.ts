import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFactory, listRuns, listRunSteps } from "@/lib/factories";

// Runs for a factory, each with its step graph (the dashboard stage table).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const factory = await getFactory(id, session.user.id);
  if (!factory) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const runs = await listRuns(id, session.user.id);
  const steps = await Promise.all(runs.map((r) => listRunSteps(r.id)));

  return NextResponse.json({
    runs: runs.map((run, i) => ({ ...run, steps: steps[i] })),
  });
}
