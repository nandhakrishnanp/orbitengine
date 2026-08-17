"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type User = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Conversation = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  title: string | null;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function Sidebar({
  user,
  conversations,
}: {
  user: User;
  conversations: Conversation[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold tracking-tight">OrbitEngine</span>
        <button
          onClick={async () => {
            const res = await fetch("/api/conversations", { method: "POST" });
            if (res.ok) {
              const { conversation } = await res.json();
              router.push(`/conversations/${conversation.id}`);
            }
          }}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-500">
            No conversations yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((conversation) => {
              const active = pathname === `/conversations/${conversation.id}`;
              return (
                <li key={conversation.id}>
                  <Link
                    href={`/conversations/${conversation.id}`}
                    className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors ${
                      active
                        ? "bg-zinc-200/70 dark:bg-zinc-800"
                        : "hover:bg-zinc-200/40 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <span className="truncate text-sm font-medium">
                      {conversation.title
                        ? conversation.title
                        : "New conversation"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatTime(conversation.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2.5">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium dark:bg-zinc-700">
              {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sign out"
          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
