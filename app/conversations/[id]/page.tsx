import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import MessageComposer from "./message-composer";

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
    conversation: { id: string; status: string };
    messages: Message[];
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-16">
      <div className="flex items-center justify-between">
        <Link
          href="/conversations"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← All conversations
        </Link>
        <span className="text-sm text-zinc-500">
          {conversation.id.slice(0, 8)} · {conversation.status}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            No messages yet. Send the first message.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "self-end max-w-[70%] rounded-2xl bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black"
                  : "self-start max-w-[70%] rounded-2xl border border-zinc-200 px-4 py-2 dark:border-zinc-800"
              }
            >
              {message.content}
            </div>
          ))
        )}
      </div>

      <MessageComposer conversationId={conversation.id} />
    </main>
  );
}