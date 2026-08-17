import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  MonitorError,
  getConversationSandbox,
  walkSandboxTree,
} from "@/lib/sandbox";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const sandbox = await getConversationSandbox(id, session.user.id);
    const tree = await walkSandboxTree(sandbox);
    return NextResponse.json(tree);
  } catch (err) {
    if (err instanceof MonitorError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
