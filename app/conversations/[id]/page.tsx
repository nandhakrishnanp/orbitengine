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
    conversation: {
      id: string;
      status: string;
      attachedRepository: string | null;
    };
    messages: Message[];
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {conversation.id.slice(0, 8)}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {conversation.status}
          </span>
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-lg font-medium">Work with the engine</p>
            <p className="max-w-sm text-sm text-zinc-500">
              Type @ to attach a GitHub repository, then describe the fix or
              change you want made.
            </p>
          </div>
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

      <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl">
          <MessageComposer
            conversationId={conversation.id}
            initialAttachedRepository={conversation.attachedRepository}
          />
        </div>
      </div>
    </div>
  );
}