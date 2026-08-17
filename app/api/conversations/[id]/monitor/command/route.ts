import { auth } from "@/auth";
import { MonitorError, getConversationSandbox } from "@/lib/sandbox";

const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const { command } = (await request.json()) as { command?: string };
  const trimmed = String(command ?? "").trim();
  if (!trimmed) {
    return new Response(
      JSON.stringify({ error: "Empty command" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let sandbox;
  try {
    sandbox = await getConversationSandbox(id, session.user.id);
  } catch (err) {
    const status = err instanceof MonitorError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Failed";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const run = await sandbox.runCommand({
          cmd: "sh",
          args: ["-c", trimmed],
          cwd: sandbox.cwd,
          detached: true,
          timeoutMs: COMMAND_TIMEOUT_MS,
        });

        for await (const log of run.logs()) {
          send("output", { stream: log.stream, data: log.data });
        }

        const finished = await run.wait();
        send("exit", { exitCode: finished.exitCode });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Command failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
