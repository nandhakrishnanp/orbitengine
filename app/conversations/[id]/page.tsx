import { notFound, redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import SandboxStatus from "./sandbox-status";
import StreamingChat from "./streaming-chat";

type Message = {
  role: string;
  content: string;
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
  const { conversation, messages } = (await res.json()) as {
    conversation: {
      id: string;
      status: string;
      attachedRepository: string | null;
      sandboxId: string | null;
    };
    messages: Message[];
  };

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {conversation.id.slice(0, 8)}
          </span>
          <SandboxStatus
            conversationId={conversation.id}
            status={conversation.status}
            sandboxId={conversation.sandboxId}
          />
        </div>
        {conversation.attachedRepository && (
          <a
            href={`https://github.com/${conversation.attachedRepository}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {conversation.attachedRepository}
          </a>
        )}
      </header>

      <StreamingChat
        conversationId={conversation.id}
        initialMessages={chatMessages}
      />
    </div>
  );
}
