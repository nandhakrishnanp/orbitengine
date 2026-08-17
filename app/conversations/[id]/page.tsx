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
      <header className="flex items-center gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold">
          {conversation.id.slice(0, 8)}
        </span>
        <SandboxStatus
          conversationId={conversation.id}
          status={conversation.status}
          sandboxId={conversation.sandboxId}
        />
      </header>

      <StreamingChat
        conversationId={conversation.id}
        initialMessages={chatMessages}
      />
    </div>
  );
}
