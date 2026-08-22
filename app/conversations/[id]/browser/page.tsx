import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, GlobeIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import BrowserView from "./browser-view";

export default async function BrowserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await apiFetch(`/api/conversations/${id}`);
  if (res.status === 401) redirect("/");
  if (res.status === 404) notFound();

  const data = (await res.json().catch(() => null)) as {
    conversation: {
      id: string;
      status: string;
      sandboxId: string | null;
    };
  } | null;
  if (!data?.conversation) notFound();
  const { conversation } = data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <Link
          href={`/conversations/${conversation.id}`}
          className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeftIcon className="size-4" />
          Chat
        </Link>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <GlobeIcon className="size-4" />
          Live browser
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {conversation.id.slice(0, 8)}
        </span>
      </header>

      <BrowserView
        conversationId={conversation.id}
        sandboxOpen={
          Boolean(conversation.sandboxId) && conversation.status === "open"
        }
      />
    </div>
  );
}
