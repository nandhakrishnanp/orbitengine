import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import TraceRunCard, { type TraceRunWithSpans } from "./trace-run-card";

export default async function TracesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await apiFetch(`/api/conversations/${id}/traces`);
  if (res.status === 401) notFound();
  if (res.status === 404) notFound();
  const data = (await res.json().catch(() => null)) as {
    runs: TraceRunWithSpans[];
  } | null;
  const runs = data?.runs ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <Link
          href={`/conversations/${id}`}
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Back to chat
        </Link>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4 text-zinc-500 dark:text-zinc-400" />
          Traces
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <div className="flex w-full flex-col gap-6">
          {runs.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No engine runs recorded yet. Send a message in the chat and the
              run will appear here.
            </p>
          ) : (
            runs.map((run) => <TraceRunCard key={run.id} run={run} />)
          )}
        </div>
      </div>
    </div>
  );
}
