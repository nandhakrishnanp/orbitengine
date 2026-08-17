import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  MonitorError,
  getConversationSandbox,
  readSandboxFile,
} from "@/lib/sandbox";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const requestedPath = new URL(request.url).searchParams.get("path");
  if (!requestedPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const sandbox = await getConversationSandbox(id, session.user.id);
    const file = await readSandboxFile(sandbox, requestedPath);
    return NextResponse.json(file);
  } catch (err) {
    if (err instanceof MonitorError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
