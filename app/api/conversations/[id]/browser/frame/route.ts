import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MonitorError, getConversationSandbox } from "@/lib/sandbox";
import { browserRun, BrowserError, browserSessionActive } from "@/lib/browser";

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
    if (!(await browserSessionActive(sandbox))) {
      return NextResponse.json({ idle: true });
    }
    // Capture to a temp file in the sandbox, then read it back as base64 —
    // agent-browser's screenshot writes to disk rather than stdout.
    const shotPath = "/tmp/oe-browser-frame.jpg";
    const capture = await browserRun(sandbox, ["screenshot", shotPath], 15_000);
    if (!capture.ok) {
      return NextResponse.json({ error: capture.output }, { status: 500 });
    }
    const read = await sandbox.runCommand("base64", ["-w", "0", shotPath], {
      timeoutMs: 15_000,
    });
    if (read.exitCode !== 0) {
      return NextResponse.json({ error: "Failed to read frame" }, { status: 500 });
    }
    const b64 = (await read.stdout()).replace(/\n/g, "");
    const urlCmd = await sandbox.runCommand(
      "agent-browser",
      ["get", "url"],
      { timeoutMs: 10_000 }
    );
    const url = urlCmd.exitCode === 0 ? (await urlCmd.stdout()).trim() : null;
    return NextResponse.json({
      image: `data:image/jpeg;base64,${b64}`,
      url,
      timestamp: new Date().toISOString(),
    });
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
    return NextResponse.json({ error: "Failed to capture frame" }, { status: 500 });
  }
}
