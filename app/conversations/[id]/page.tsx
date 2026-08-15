import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { addMessage } from "../actions";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { id } = await params;

  const conversationResult = await pool.query(
    `SELECT id, status FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (conversationResult.rowCount === 0) notFound();
  const conversation = conversationResult.rows[0];

  const { rows: messages } = await pool.query(
    `SELECT role, content, phase, "createdAt"
     FROM messages
     WHERE "conversationId" = $1
     ORDER BY "createdAt"`,
    [id]
  );

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

      <form
        action={async (formData: FormData) => {
          "use server";
          await addMessage(id, formData);
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
    </main>
  );
}