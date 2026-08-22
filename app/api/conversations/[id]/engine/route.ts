import { randomUUID } from "crypto";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  convertToModelMessages,
    type UIMessage,
    type ToolUIPart,
} from "ai";
import { Sandbox } from "@vercel/sandbox";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { createProviderModel } from "@/lib/ai";
import { engineTools, SYSTEM_PROMPT, PLAN_MODE_PROMPT } from "@/lib/engine";
import {
  listConversationMessages,
  toUIMessage,
  upsertAssistantMessage,
  extractText,
} from "@/lib/messages";
import {
  getSettings,
  getProviderKey,
  type Provider,
  type Mode,
} from "@/lib/settings";
import { getInstallationTokenForUser } from "@/lib/github";

const DEFAULT_PROVIDER: Provider = "opencode-go";
const DEFAULT_MODEL = "hy3-free";

async function resolveModel(
  userId: string,
  conversation: { provider: string | null; model: string | null }
) {
  const settings = await getSettings(userId);
  const provider =
    (conversation.provider as Provider | null) ??
    settings.model?.provider ??
    DEFAULT_PROVIDER;
  const modelId =
    conversation.model ?? settings.model?.id ?? DEFAULT_MODEL;

  const storedKey = await getProviderKey(userId, provider);
  if (storedKey) {
    return {
      model: createProviderModel(provider, modelId, storedKey),
      loop: settings.loop,
      mode: settings.mode,
      source: "user-key" as const,
    };
  }
  // Fall back to the platform key (opencode-go only).
  if (process.env.OPENZEN_API_KEY && provider === DEFAULT_PROVIDER) {
    return {
      model: createProviderModel(provider, modelId, process.env.OPENZEN_API_KEY),
      loop: settings.loop,
      mode: settings.mode,
      source: "platform-key" as const,
    };
  }
  return null;
}

const PLAN_TOOLS = ["read_file", "list_files"] as const;

function stepPhase(parts: UIMessage["parts"]): string {
  const toolParts = parts.filter(
    (p): p is ToolUIPart =>
      p.type.startsWith("tool-") && "state" in p && p.state !== undefined
  );
  const last = toolParts[toolParts.length - 1];
  if (
    last &&
    (last.state === "output-available" || last.state === "output-error")
  ) {
    return `tool:${last.type.slice("tool-".length)}`;
  }
  return "responding";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const ownership = await pool.query(
    `SELECT id, "sandboxId", provider, model, mode
     FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, userId]
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

  let githubToken: string;
  try {
    githubToken = await getInstallationTokenForUser(userId);
  } catch {
    return new Response(
      JSON.stringify({ error: "GitHub token unavailable" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("[engine] loading persisted context");

  const history = await listConversationMessages(id);
  const modelMessages = await convertToModelMessages(history.map(toUIMessage));

  const assistantMessageId = randomUUID();

  const resolved = await resolveModel(userId, conversation);
  if (!resolved) {
    return new Response(
      JSON.stringify({
        error: `No API key configured for provider "${conversation.provider ?? "opencode-go"}". Add one in Settings.`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  console.log("[engine] model resolved:", {
    provider: conversation.provider ?? "(default)",
    model: conversation.model ?? "(default)",
    source: resolved.source,
    loop: resolved.loop,
  });

  // Per-conversation mode wins over the user-level default.
  const mode: Mode =
    (conversation.mode as Mode | null) ?? resolved.mode ?? "build";
  const allTools = engineTools(sandbox, githubToken);
  const tools =
    mode === "plan"
      ? Object.fromEntries(
          PLAN_TOOLS.filter((name) => name in allTools).map((name) => [
            name,
            allTools[name],
          ])
        )
      : allTools;
  console.log("[engine] mode:", mode, "tools:", Object.keys(tools));

  const result = streamText({
    model: resolved.model,
    system: mode === "plan" ? `${SYSTEM_PROMPT}\n\n${PLAN_MODE_PROMPT}` : SYSTEM_PROMPT,
    messages: modelMessages,
    tools,
    maxRetries: resolved.loop.maxRetries,
    stopWhen: ({ steps }) => steps.length >= resolved.loop.maxSteps,
    onStepFinish: ({ text, toolCalls, finishReason }) => {
      console.log("[engine] step finished:", {
        text: text?.slice(0, 100),
        toolCalls: toolCalls?.map((tc) => tc.toolName),
        finishReason,
      });
    },
  });

  // Keep generating even if the client disconnects, so per-step
  // persistence below completes and nothing is lost.
  result.consumeStream();

  const persistResponseMessage = async (message: UIMessage) => {
    try {
      const saved = await upsertAssistantMessage(id, assistantMessageId, userId, {
        content: extractText(message.parts),
        parts: message.parts,
        phase: stepPhase(message.parts),
      });
      const prPart = message.parts.find(
        (p) =>
          p.type === "tool-create_pull_request" && "output" in p && p.output
      ) as { output?: { html_url?: string; url?: string } } | undefined;
      if (prPart?.output?.html_url ?? prPart?.output?.url) {
        console.log("[engine] PR URL persisted:", prPart.output.html_url ?? prPart.output.url);
      }
      if (!saved) {
        console.error("[engine] failed to persist engine step");
      }
    } catch (error) {
      console.error("[engine] persistence error:", error);
    }
  };

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendReasoning: true,
        })
      );
    },
    onStepEnd: async ({ responseMessage }) => {
      await persistResponseMessage(responseMessage);
    },
    onEnd: async ({ responseMessage }) => {
      await persistResponseMessage(responseMessage);
    },
  });

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: ({ stream: sse }) => {
      // Drain a tee'd copy of the SSE stream so the pipeline (and its
      // persistence callbacks) survives client disconnects.
      void sse
        .pipeTo(
          new WritableStream({
            write(chunk) {
              if (chunk.includes('"type":"finish"')) {
                console.log("[engine] stream finished");
              }
            },
          })
        )
        .catch(() => {});
    },
  });
}
