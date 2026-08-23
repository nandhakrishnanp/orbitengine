import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GlobeIcon, MessageSquare, MonitorIcon, Activity } from "lucide-react";
import type { UIMessage } from "ai";
import { apiFetch } from "@/lib/api";
import SandboxStatus from "./sandbox-status";
import StreamingChat from "./streaming-chat";

type Message = {
  id: string;
  role: string;
  content: string;
  parts: UIMessage["parts"] | null;
  phase: string | null;
  createdAt: string;
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await apiFetch(`/api/conversations/${id}`);
  if (res.status === 401) redirect("/");
  if (res.status === 404) notFound();

  const data = (await res.json().catch(() => null)) as {
    conversation: {
      id: string;
      status: string;
      sandboxId: string | null;
      provider: string | null;
      model: string | null;
      mode?: "plan" | "build" | null;
    };
    messages: Message[];
  } | null;
  if (!data?.conversation) notFound();
  const { conversation, messages } = data;

  const settingsRes = await apiFetch("/api/settings");
  const settingsData = (await settingsRes.json().catch(() => null)) as {
    settings?: { model?: { provider: string; id: string } | null };
    keys?: { provider: string }[];
  } | null;
  const configuredProviders = Array.from(
    new Set((settingsData?.keys ?? []).map((k) => k.provider))
  );
  const defaultModel = settingsData?.settings?.model ?? null;

  const chatMessages: UIMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts:
      m.parts && m.parts.length > 0
        ? m.parts
        : ([{ type: "text", text: m.content }] as UIMessage["parts"]),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4 text-zinc-500 dark:text-zinc-400" />
          {conversation.id.slice(0, 8)}
        </span>
        <SandboxStatus
          conversationId={conversation.id}
          status={conversation.status}
          sandboxId={conversation.sandboxId}
        />
        {conversation.sandboxId && conversation.status === "open" && (
          <>
            <Link
              href={`/conversations/${conversation.id}/browser`}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <GlobeIcon className="size-4" />
              Browser
            </Link>
            <Link
              href={`/conversations/${conversation.id}/monitor`}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <MonitorIcon className="size-4" />
              Monitor
            </Link>
          </>
        )}
        <Link
          href={`/conversations/${conversation.id}/traces`}
          className={`flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 ${
            conversation.sandboxId ? "" : "ml-auto"
          }`}
        >
          <Activity className="size-4" />
          Traces
        </Link>
      </header>

      <StreamingChat
        conversationId={conversation.id}
        initialMessages={chatMessages}
        initialMode={conversation.mode ?? "build"}
        defaultModel={defaultModel}
        configuredProviders={configuredProviders}
      />
    </div>
  );
}
