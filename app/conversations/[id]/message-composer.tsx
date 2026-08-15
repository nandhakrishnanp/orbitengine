"use client";

import { useRouter } from "next/navigation";
import { addMessage } from "../actions";

export default function MessageComposer({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const content = new FormData(form).get("content");
        if (typeof content !== "string" || !content.trim()) return;
        await addMessage(conversationId, form);
        form.reset();
        router.refresh();
      }}
      className="flex gap-2"
    >
      <input
        name="content"
        placeholder="Describe the change to make…"
        className="flex-1 rounded-full border border-zinc-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800"
        autoComplete="off"
      />
      <button
        type="submit"
        className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
      >
        Send
      </button>
    </form>
  );
}