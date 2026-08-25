"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  Clock,
  Factory as FactoryIcon,
  GitPullRequest,
  Play,
  RefreshCw,
  Square,
  Bug,
  FileText,
  Sparkles,
  Wrench,
} from "lucide-react";
import TraceRunCard, {
  formatDuration,
  type TraceRunWithSpans,
} from "@/components/traces/trace-run-card";

type Step = {
  id: string;
  seq: number;
  step: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  verdict: Record<string, unknown> | null;
};

type Run = {
  id: string;
  factoryId: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  type: string | null;
  state: string;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  error: string | null;
  traceRunId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  steps: Step[];
};

type Factory = {
  id: string;
  repoFullName: string;
  status: string;
  labelFilter: string[];
  checkCommand: string | null;
};

type Group = { factory: Factory; runs: Run[] };

const STATE_STYLES: Record<string, string> = {
  queued:
    "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400",
  classifying:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  reproducing:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  fixing:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  checking:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  pr_opened:
    "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  cancelled:
    "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-500",
};

const STATE_LABELS: Record<string, string> = {
  queued: "Queued",
  classifying: "Classifying",
  reproducing: "Reproducing",
  fixing: "Fixing",
  checking: "Checking",
  pr_opened: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STEP_ICONS: Record<string, typeof Bug> = {
  identify_type: Sparkles,
  reproduce: Bug,
  create_fix: Wrench,
  review_fix: CircleCheck,
  open_pr: GitPullRequest,
  implement_docs: FileText,
};

function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        STATE_STYLES[state] ?? STATE_STYLES.queued
      }`}
    >
      {(state === "classifying" ||
        state === "reproducing" ||
        state === "fixing" ||
        state === "checking") && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      )}
      {STATE_LABELS[state] ?? state}
    </span>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FactoryDashboard({
  groups,
  traces,
}: {
  groups: Group[];
  traces: TraceRunWithSpans[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "trace">("details");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const runs = useMemo(() => groups.flatMap((g) => g.runs), [groups]);
  const selected = runs.find((r) => r.id === selectedId) ?? runs[0] ?? null;
  const selectedGroup = groups.find(
    (g) => g.factory.id === selected?.factoryId
  );
  const selectedTrace = traces.find((t) => t.id === selected?.traceRunId);

  // Auto-refresh while anything is in flight.
  const hasActive = runs.some((r) =>
    ["queued", "classifying", "reproducing", "fixing", "checking"].includes(
      r.state
    )
  );
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [hasActive, router]);

  async function action(run: Run, kind: "rerun" | "cancel") {
    setBusy(true);
    await fetch(`/api/factories/${run.factoryId}/runs/${run.id}/${kind}`, {
      method: "POST",
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <FactoryIcon className="size-4" />
          Factory
          <span className="font-normal text-zinc-400">
            {runs.length} run{runs.length === 1 ? "" : "s"} across{" "}
            {groups.length} factor{groups.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            New factory
          </button>
          <button
            onClick={() => router.refresh()}
            title="Refresh"
            className="rounded-md border border-zinc-200 p-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </header>

      {showCreate && <CreateFactoryForm onDone={() => { setShowCreate(false); router.refresh(); }} />}

      <div className="flex min-h-0 flex-1">
        {/* left rail */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
          {runs.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">
              No runs yet. Create a factory, then file an issue on its repo —
              the worker polls and queues a run per issue.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.factory.id} className="border-b border-zinc-100 pb-1 dark:border-zinc-800/60">
              <div className="flex items-center justify-between px-3 pb-1 pt-3 text-xs font-medium text-zinc-500">
                <span className="truncate">{g.factory.repoFullName}</span>
                <span
                  className={`ml-2 size-1.5 shrink-0 rounded-full ${
                    g.factory.status === "active"
                      ? "bg-green-500"
                      : "bg-zinc-400"
                  }`}
                  title={g.factory.status}
                />
              </div>
              {g.runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => {
                    setSelectedId(run.id);
                    setTab("details");
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    selected?.id === run.id
                      ? "bg-zinc-100 dark:bg-zinc-800/70"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                  }`}
                >
                  <span className="shrink-0 text-xs text-zinc-400">
                    #{run.issueNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {run.issueTitle}
                  </span>
                  <StateBadge state={run.state} />
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* detail pane */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Select a run
            </div>
          ) : (
            <div className="mx-auto max-w-3xl p-6">
              <h1 className="text-xl font-semibold tracking-tight">
                <a
                  href={selected.issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  <span className="text-zinc-400">#{selected.issueNumber}</span>{" "}
                  {selected.issueTitle}
                </a>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StateBadge state={selected.state} />
                {selected.type && (
                  <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    {selected.type}
                  </span>
                )}
                {selected.prUrl && (
                  <a
                    href={selected.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-700 dark:text-green-300"
                  >
                    <GitPullRequest className="size-3" /> PR #{selected.prNumber}
                  </a>
                )}
                <span className="text-xs text-zinc-400">
                  {selectedGroup?.factory.repoFullName} · started{" "}
                  {formatWhen(selected.startedAt ?? selected.createdAt)}
                  {selected.finishedAt &&
                    ` · took ${formatDuration(
                      new Date(selected.finishedAt).getTime() -
                        new Date(selected.startedAt ?? selected.createdAt).getTime()
                    )}`}
                </span>
              </div>

              {/* actions */}
              <div className="mt-4 flex items-center gap-2">
                {selected.prUrl && (
                  <a
                    href={selected.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-300"
                  >
                    <GitPullRequest className="size-3" /> Open PR
                    {selected.prNumber != null && ` #${selected.prNumber}`}
                  </a>
                )}
                {selected.state === "failed" && (
                  <button
                    disabled={busy}
                    onClick={() => action(selected, "rerun")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <Play className="size-3" /> Re-run
                  </button>
                )}
                {selected.state === "queued" && (
                  <button
                    disabled={busy}
                    onClick={() => action(selected, "cancel")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <Square className="size-3" /> Cancel
                  </button>
                )}
                {selectedTrace && (
                  <button
                    onClick={() => setTab(tab === "trace" ? "details" : "trace")}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    {tab === "trace" ? "Details" : "Trace"}
                  </button>
                )}
              </div>

              {selected.error && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3 text-sm text-red-700 dark:text-red-300">
                  {selected.error}
                </div>
              )}

              {tab === "details" ? (
                <div className="mt-6">
                  <h2 className="mb-2 text-sm font-semibold">Pipeline</h2>
                  <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                    {selected.steps.length === 0 ? (
                      <p className="p-3 text-sm text-zinc-500">
                        Waiting for the worker to pick up this run…
                      </p>
                    ) : (
                      selected.steps.map((step) => {
                        const Icon = STEP_ICONS[step.step] ?? Wrench;
                        return (
                          <div
                            key={step.id}
                            className="flex items-start gap-3 border-b border-zinc-100 p-3 last:border-0 dark:border-zinc-800/60"
                          >
                            <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {step.step}
                                </span>
                                <StepStatusChip status={step.status} />
                              </div>
                              {step.verdict && (
                                <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                                  {JSON.stringify(step.verdict, null, 2).slice(0, 2000)}
                                </pre>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                selectedTrace && (
                  <div className="mt-6">
                    <TraceRunCard run={selectedTrace} />
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepStatusChip({ status }: { status: Step["status"] }) {
  const map: Record<Step["status"], { cls: string; icon?: typeof Clock }> = {
    passed: {
      cls: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
      icon: CircleCheck,
    },
    failed: {
      cls: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
      icon: CircleX,
    },
    running: {
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      icon: Clock,
    },
    pending: {
      cls: "border-zinc-300 text-zinc-500 dark:border-zinc-700",
    },
    skipped: {
      cls: "border-zinc-300 text-zinc-400 dark:border-zinc-700",
    },
  };
  const { cls, icon: Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {Icon && <Icon className="size-2.5" />}
      {status}
    </span>
  );
}

function CreateFactoryForm({ onDone }: { onDone: () => void }) {
  const [repos, setRepos] = useState<{ fullName: string }[]>([]);
  const [repo, setRepo] = useState("");
  const [labels, setLabels] = useState("");
  const [checkCommand, setCheckCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => (r.ok ? r.json() : { repos: [] }))
      .then((d) => setRepos(d.repos ?? []))
      .catch(() => setRepos([]));
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/factories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoFullName: repo,
        labelFilter: labels
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        checkCommand: checkCommand.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create factory");
      return;
    }
    onDone();
  }

  return (
    <div className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Repository
          <select
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="w-64 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Select a repo…</option>
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Labels (comma-separated, optional)
          <input
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            placeholder="bug"
            className="w-48 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Check command (optional)
          <input
            value={checkCommand}
            onChange={(e) => setCheckCommand(e.target.value)}
            placeholder="npm test"
            className="w-44 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button
          onClick={submit}
          disabled={busy || !repo}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
