"use client";

import { useRouter } from "next/navigation";

export default function NewConversationButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        const res = await fetch("/api/conversations", { method: "POST" });
        if (res.ok) {
          const { conversation } = await res.json();
          router.push(`/conversations/${conversation.id}`);
        }
      }}
      className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
    >
      New conversation
    </button>
  );
}