import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { createConversation } from "./actions";

export const metadata = { title: "Conversations · OrbitEngine" };

export default async function ConversationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { rows: conversations } = await pool.query(
    `SELECT id, status, "createdAt"
     FROM conversations
     WHERE "userId" = $1
     ORDER BY "updatedAt" DESC`,
    [session.user.id]
  );

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-16">
      <div className="flex w-full max-w-xl items-center justify-between">
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <form
          action={async () => {
            "use server";
            await createConversation();
          }}
        >
          <button className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300">
            New conversation
          </button>
        </form>
      </div>

      {conversations.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No conversations yet. Start one to begin working with the engine.
        </p>
      ) : (
        <ul className="flex w-full max-w-xl flex-col gap-2">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/conversations/${conversation.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="font-medium">
                  {conversation.id.slice(0, 8)}
                </span>
                <span className="text-sm text-zinc-500">
                  {new Date(conversation.createdAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}