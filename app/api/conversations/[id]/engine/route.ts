import {
  streamText,
  createUIMessageStreamResponse,
  toUIMessageStream,
  convertToModelMessages,
  UIMessage,
} from "ai";
import { Sandbox } from "@vercel/sandbox";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { openzen } from "@/lib/ai";
import { engineTools, SYSTEM_PROMPT } from "@/lib/engine";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const { messages } = (await request.json()) as {
    messages: UIMessage[];
  };

  if (!messages?.length) {
    return new Response("No messages", { status: 400 });
  }

  const ownership = await pool.query(
    `SELECT id, "sandboxId", "attachedRepository"
     FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (ownership.rowCount === 0) {
    return new Response("Not found", { status: 404 });
  }

  const conversation = ownership.rows[0];
  if (!conversation.sandboxId) {
    return new Response(
      JSON.stringify({ error: "Sandbox not provisioned" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const sandbox = await Sandbox.get({ name: conversation.sandboxId });

  console.log("[engine] calling model with", messages.length, "messages");

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openzen("hy3-free"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: engineTools(sandbox),
    maxRetries: 5,
    stopWhen: ({ steps }) => steps.length >= 10,
    onStepFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
      console.log("[engine] step finished:", {
        text: text?.slice(0, 100),
        toolCalls: toolCalls?.map((tc) => tc.toolName),
        finishReason,
      });
    },
  });

  const stream = toUIMessageStream({
    stream: result.stream,
    sendReasoning: true,
  });

  return createUIMessageStreamResponse({ stream });
}
