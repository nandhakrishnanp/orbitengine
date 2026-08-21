"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, MessageSquare, Orbit, Plus, Settings, Trash2 } from "lucide-react";

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
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Orbit className="size-4" />
          OrbitEngine
        </span>
        <button
          onClick={async () => {
            const res = await fetch("/api/conversations", { method: "POST" });
            if (res.ok) {
              const { conversation } = await res.json();
              router.push(`/conversations/${conversation.id}`);
            }
          }}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <Plus className="size-4" />
          New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-zinc-500">
            <MessageSquare className="size-5" />
            <p className="text-sm">No conversations yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((conversation) => {
              const active = pathname === `/conversations/${conversation.id}`;
              return (
                <li
                  key={conversation.id}
                  className="group relative"
                >
                  <Link
                    href={`/conversations/${conversation.id}`}
                    className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 pr-9 transition-colors ${
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
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (
                        !confirm(
                          "Delete this conversation and its history? This cannot be undone."
                        )
                      ) {
                        return;
                      }
                      const res = await fetch(
                        `/api/conversations/${conversation.id}`,
                        { method: "DELETE" }
                      );
                      if (res.ok) {
                        if (active) {
                          router.push("/conversations");
                        }
                        router.refresh();
                      }
                    }}
                    title="Delete"
                    aria-label={`Delete ${conversation.title ?? "conversation"}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200/60 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
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
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            title="Settings"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Settings className="size-4" />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Sign out"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
