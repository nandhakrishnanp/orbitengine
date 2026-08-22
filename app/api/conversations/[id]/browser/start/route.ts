import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MonitorError, getConversationSandbox } from "@/lib/sandbox";
import {
  BrowserError,
  browserSessionActive,
  browserStartSession,
} from "@/lib/browser";

export async function POST(
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
    if (await browserSessionActive(sandbox)) {
      return NextResponse.json({ started: true, alreadyActive: true });
    }
    const result = await browserStartSession(sandbox);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to start browser session" },
        { status: 500 }
      );
    }
    return NextResponse.json({ started: true });
  } catch (err) {
    if (err instanceof MonitorError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof BrowserError) {
      return NextResponse.json(
        { error: err.message, detail: err.detail },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to start browser session" },
      { status: 500 }
    );
  }
}
