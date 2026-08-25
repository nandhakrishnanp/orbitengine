import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRun, cancelRun } from "@/lib/factories";

export async function POST(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; runId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await params; // factoryId — ownership is checked through the run's factory
  const { runId } = await params;

  const run = await getRun(runId, session.user.id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cancelled = await cancelRun(runId, session.user.id);
  if (!cancelled) {
    return NextResponse.json(
      { error: "Only queued runs can be cancelled" },
      { status: 400 }
    );
  }
  return NextResponse.json({ run: cancelled });
}
