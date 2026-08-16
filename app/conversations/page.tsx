"use client";

import { useRouter } from "next/navigation";

export default function ConversationsEmpty() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">OrbitEngine</h1>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        Pick a conversation from the sidebar, or start a new chat to work on a
        repository with the engine.
      </p>
      <button
        onClick={async () => {
          const res = await fetch("/api/conversations", { method: "POST" });
          if (res.ok) {
            const { conversation } = await res.json();
            router.push(`/conversations/${conversation.id}`);
          }
        }}
        className="rounded-full bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
      >
        New conversation
      </button>
    </div>
  );
}