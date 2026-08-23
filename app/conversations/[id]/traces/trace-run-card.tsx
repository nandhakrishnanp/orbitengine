"use client";

import { useRef, useState } from "react";
import {
  CircleCheck,
  CircleX,
  Clock,
  Coins,
  Globe,
  ListTree,
  SquareTerminal,
  FolderGit2,
  GitPullRequest,
  Wrench,
} from "lucide-react";
import type { BundledLanguage } from "shiki";
import { CodeBlock } from "@/components/ai-elements/code-block";
import type { TraceRun, TraceSpan } from "@/lib/traces";

export type TraceRunWithSpans = TraceRun & { spans: TraceSpan[] };

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

// Tool families get their own colour across badges and the timeline.
type ToolFamily = "shell" | "files" | "browser" | "github" | "other";

const FAMILY_COLORS: Record<
  ToolFamily,
  { badge: string; bar: string }
> = {
  shell: {
    badge:
      "border-yellow-500/25 bg-yellow-500/[0.08] text-yellow-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-300",
    bar: "bg-yellow-400/75 dark:bg-yellow-400/55",
  },
  files: {
    badge:
      "border-blue-500/25 bg-blue-500/[0.08] text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300",
    bar: "bg-blue-400/75 dark:bg-blue-400/55",
  },
  browser: {
    badge:
      "border-violet-500/25 bg-violet-500/[0.08] text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300",
    bar: "bg-violet-400/75 dark:bg-violet-400/55",
  },
  github: {
    badge:
      "border-green-500/25 bg-green-500/[0.08] text-green-700 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-300",
    bar: "bg-green-400/75 dark:bg-green-400/55",
  },
  // Red is reserved for failures; neutral spans reuse blue.
  other: {
    badge:
      "border-blue-500/25 bg-blue-500/[0.08] text-zinc-600 dark:border-blue-400/15 dark:bg-blue-400/10 dark:text-blue-300/80",
    bar: "bg-blue-300/60 dark:bg-blue-400/35",
  },
};

function familyOf(tool: string): ToolFamily {
  if (tool === "run_command") return "shell";
  if (["read_file", "write_file", "list_files"].includes(tool)) return "files";
  if (tool.startsWith("browser_")) return "browser";
  if (
    ["create_pull_request", "create_issue", "create_repository"].includes(tool)
  )
    return "github";
  return "other";
}

const FAMILY_ICONS: Record<ToolFamily, typeof Wrench> = {
  shell: SquareTerminal,
  files: FolderGit2,
  browser: Globe,
  github: GitPullRequest,
  other: Wrench,
};

function ToolBadge({ tool }: { tool: string }) {
  const family = familyOf(tool);
  const Icon = FAMILY_ICONS[family];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] leading-tight ${FAMILY_COLORS[family].badge}`}
    >
      <Icon className="size-3" />
      {tool}
    </span>
  );
}

function spanSummary(span: TraceSpan): string {
  const input = span.input ?? {};
  if ("command" in input && typeof input.command === "string") return input.command;
  if ("path" in input && typeof input.path === "string") return input.path;
  if ("url" in input && typeof input.url === "string") return input.url;
  if ("name" in input && typeof input.name === "string") return input.name;
  if ("owner" in input && "repo" in input) return `${input.owner}/${input.repo}`;
  if ("kind" in input && typeof input.kind === "string") return input.kind;
  return "";
}

function spanError(span: TraceSpan): string | null {
  const out = span.output as Record<string, unknown> | null;
  if (!out || typeof out !== "object") return null;
  if (typeof out.error === "string" && out.error) return out.error;
  if (out.ok === false)
    return (typeof out.output === "string" && out.output) || "failed";
  if (out.success === false)
    return `write failed${typeof out.path === "string" ? `: ${out.path}` : ""}`;
  return null;
}

/** Best-effort language guess so outputs get syntax highlighting. */
function outputLanguage(span: TraceSpan): BundledLanguage {
  const input = span.input ?? {};
  const path =
    (typeof input.path === "string" && input.path) ||
    (typeof (span.output as Record<string, unknown> | null)?.path === "string"
      ? ((span.output as Record<string, unknown>).path as string)
      : "");
  if (path) {
    const ext = path.includes(".") ? path.split(".").pop()!.toLowerCase() : "";
    const MAP: Record<string, BundledLanguage> = {
      ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
      json: "json", md: "markdown", py: "python", rs: "rust", go: "go",
      rb: "ruby", sh: "shellscript", yml: "yaml", yaml: "yaml",
      toml: "toml", html: "html", css: "css", sql: "sql",
    };
    if (MAP[ext]) return MAP[ext];
  }
  if (span.tool === "run_command") return "shellscript";
  return "json";
}

function outputText(span: TraceSpan): string | null {
  const out = span.output as Record<string, unknown> | null;
  if (!out || typeof out !== "object") return null;
  const candidates = ["content", "output", "stdout", "snapshot", "entries"];
  for (const key of candidates) {
    const v = out[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function DetailPanel({ span }: { span: TraceSpan }) {
  const error = spanError(span);
  const text = !error ? outputText(span) : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ToolBadge tool={span.tool} />
        <span className="font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {formatDuration(span.durationMs)}
        </span>
        <span
          className={`flex items-center gap-1 text-xs ${
            error
              ? "text-red-500 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {error ? (
            <CircleX className="size-3.5" />
          ) : (
            <CircleCheck className="size-3.5" />
          )}
          {error ? "failed" : "ok"}
        </span>
        <span
          className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-zinc-500"
          suppressHydrationWarning
        >
          {new Date(span.startedAt).toLocaleTimeString()}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/25 bg-red-500/10 p-2 font-mono text-xs whitespace-pre-wrap text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {span.input != null && Object.keys(span.input).length > 0 && (
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Input
          </p>
          <CodeBlock
            className="border-none"
            code={JSON.stringify(span.input, null, 2)}
            language="json"
          />
        </div>
      )}

      {text && (
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Output
          </p>
          <CodeBlock
            className="border-none"
            code={text.length > 20_000 ? `${text.slice(0, 20_000)}…` : text}
            language={outputLanguage(span)}
          />
        </div>
      )}

      {!text && !error && span.output != null && (
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Output
          </p>
          <CodeBlock
            className="border-none"
            code={JSON.stringify(span.output, null, 2)}
            language="json"
          />
        </div>
      )}
    </div>
  );
}

function HeaderItem({
  label,
  value,
  valueClass = "font-medium text-zinc-900 dark:text-zinc-100",
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-zinc-400 dark:text-zinc-500">{label}:</span>
      <span className={valueClass}>{value}</span>
    </span>
  );
}

function RunHeader({ run }: { run: TraceRunWithSpans }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <HeaderItem
        label="Model"
        value={run.model}
        valueClass="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100"
      />
      <HeaderItem label="Provider" value={run.provider} />
      {run.mode && (
        <HeaderItem label="Mode" value={run.mode} />
      )}
      {run.skills.map((s) => (
        <HeaderItem
          key={s}
          label="Skill"
          value={`/${s}`}
          valueClass="font-mono font-medium text-zinc-900 dark:text-zinc-100"
        />
      ))}
      <span className="ml-auto flex items-center gap-1.5">
        <ListTree className="size-3.5" />
        <HeaderItem
          label="Steps"
          value={run.stepCount}
          valueClass="tabular-nums"
        />
      </span>
      {run.totalMs != null && (
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          <HeaderItem
            label="Duration"
            value={formatDuration(run.totalMs)}
            valueClass="tabular-nums"
          />
        </span>
      )}
      {(run.inputTokens != null || run.outputTokens != null) && (
        <span className="flex items-center gap-1.5">
          <Coins className="size-3.5" />
          <HeaderItem
            label="Tokens"
            value={`${run.inputTokens ?? "?"} in / ${run.outputTokens ?? "?"} out`}
            valueClass="tabular-nums"
          />
        </span>
      )}
      <HeaderItem
        label="Status"
        value={
          <span
            className={`flex items-center gap-1.5 ${
              run.status === "completed"
                ? "text-green-600 dark:text-green-400"
                : "text-yellow-600 dark:text-yellow-400"
            }`}
          >
            {run.status === "completed" && <CircleCheck className="size-3.5" />}
            {run.status}
          </span>
        }
        valueClass=""
      />
    </div>
  );
}

function TimelineStrip({
  run,
  scaleMs,
  runStartMs,
  selectedId,
  onSelect,
}: {
  run: TraceRunWithSpans;
  scaleMs: number;
  runStartMs: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative h-9 min-w-0 overflow-hidden border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-800/30">
      {/* quarter guides */}
      {[25, 50, 75].map((pct) => (
        <span
          key={pct}
          className="absolute inset-y-0 w-px bg-zinc-200 dark:bg-zinc-700/60"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      ))}
      {run.spans.map((span) => {
        const family = familyOf(span.tool);
        const errored = spanError(span) !== null;
        const startMs = new Date(span.startedAt).getTime() - runStartMs;
        const selected = span.id === selectedId;
        return (
          <button
            key={span.id}
            type="button"
            title={`${span.tool} — ${formatDuration(span.durationMs)}${
              errored ? " (failed)" : ""
            }`}
            aria-label={`Select ${span.tool} span`}
            onClick={() => onSelect(span.id)}
            className={`absolute inset-y-1.5 rounded-sm transition-transform hover:scale-y-110 focus:z-10 focus:outline-none ${
              errored ? "bg-red-400/80 dark:bg-red-500/60" : FAMILY_COLORS[family].bar
            } ${
              selected
                ? "ring-2 ring-zinc-500 dark:ring-zinc-300"
                : ""
            }`}
            style={{
              left: `${(startMs / scaleMs) * 100}%`,
              width: `${Math.max((span.durationMs / scaleMs) * 100, 0.6)}%`,
            }}
          />
        );
      })}
      <span className="absolute bottom-0.5 left-1 text-[10px] leading-none text-zinc-400 tabular-nums dark:text-zinc-500">
        0
      </span>
      <span className="absolute bottom-0.5 right-1 text-[10px] leading-none text-zinc-400 tabular-nums dark:text-zinc-500">
        {formatDuration(scaleMs)}
      </span>
    </div>
  );
}

export default function TraceRunCard({ run }: { run: TraceRunWithSpans }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    run.spans[0]?.id ?? null
  );
  const listRef = useRef<HTMLUListElement>(null);

  const runStartMs = new Date(run.startedAt).getTime();
  const lastEndMs = run.spans.reduce(
    (max, s) => Math.max(max, new Date(s.startedAt).getTime() + s.durationMs),
    runStartMs
  );
  const scaleMs = Math.max(lastEndMs - runStartMs, run.totalMs ?? 0, 1);
  const hasSpans = run.spans.length > 0;
  const selected = run.spans.find((s) => s.id === selectedId) ?? null;

  function selectAndScroll(id: string) {
    setSelectedId(id);
    const row = listRef.current?.querySelector<HTMLLIElement>(
      `[data-span-id="${CSS.escape(id)}"]`
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <section className="overflow-hidden  rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <RunHeader run={run} />

      {hasSpans && (
        <TimelineStrip
          run={run}
          scaleMs={scaleMs}
          runStartMs={runStartMs}
          selectedId={selectedId}
          onSelect={selectAndScroll}
        />
      )}

      {!hasSpans ? (
        <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          No tool calls in this run.
        </p>
      ) : (
        <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          {/* Span list */}
          <ul
            ref={listRef}
            className="min-w-0 divide-y  divide-zinc-100 border-b border-zinc-200 md:border-b-0 md:border-r dark:divide-zinc-800/70 dark:border-zinc-800"
          >
            {run.spans.map((span) => {
              const error = spanError(span);
              const isSelected = span.id === selectedId;
              return (
                <li key={span.id} className=" " data-span-id={span.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(span.id)}
                    className={`flex w-full  items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800/70"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <ToolBadge tool={span.tool} />
                    {spanSummary(span) && (
                      <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-zinc-400 lg:block dark:text-zinc-500">
                        {spanSummary(span)}
                      </span>
                    )}
                    {error ? (
                      <CircleX className="ml-auto size-3.5 shrink-0 text-red-500 dark:text-red-400" />
                    ) : null}
                    <span
                      className={`${error ? "" : "ml-auto"} shrink-0 font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400`}
                    >
                      {formatDuration(span.durationMs)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Detail panel */}
          <div className="min-h-64 min-w-0 bg-zinc-50/40 md:max-h-[32rem] dark:bg-zinc-800/20">
            {selected ? (
              <DetailPanel span={selected} />
            ) : (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                Select a span to inspect its input and output.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
