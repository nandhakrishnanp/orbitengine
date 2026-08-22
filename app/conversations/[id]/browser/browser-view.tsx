"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GlobeIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FrameState =
  | { kind: "loading" }
  | { kind: "idle" }
  | { kind: "starting"; note: string }
  | { kind: "error"; message: string }
  | {
      kind: "live";
      image: string;
      url: string | null;
      timestamp: string;
    };

const POLL_MS = 1500;

export default function BrowserView({
  conversationId,
  sandboxOpen,
}: {
  conversationId: string;
  sandboxOpen: boolean;
}) {
  const [state, setState] = useState<FrameState>({ kind: "loading" });
  const [paused, setPaused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/browser/frame`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to capture frame");
      }
      const data = await res.json();
      if (!mountedRef.current) return;
      if (data.idle) {
        setState({ kind: "idle" });
      } else if (data.image) {
        setState((prev) =>
          prev.kind === "live" && prev.image === data.image
            ? prev
            : {
                kind: "live",
                image: data.image,
                url: data.url ?? null,
                timestamp: data.timestamp ?? new Date().toISOString(),
              }
        );
      } else {
        setState({ kind: "error", message: data.error ?? "No frame" });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to capture frame",
      });
    }
  }, [conversationId]);

  useEffect(() => {
    if (!sandboxOpen) return;
    void poll();
    if (paused) return;
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [sandboxOpen, paused, poll]);

  async function startSession() {
    setState({
      kind: "starting",
      note: "Preparing the browser… first time can take up to a minute.",
    });
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/browser/start`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start browser session");
      }
      setState({ kind: "starting", note: "Starting session…" });
      await poll();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to start",
      });
    }
  }

  if (!sandboxOpen) {
    return (
      <EmptyState
        icon={<GlobeIcon className="size-8 text-zinc-400" />}
        title="Sandbox is not running"
        description="Open the conversation and make sure its sandbox is ready to browse."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
          {state.kind === "live" && (
            <span className="flex size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
          )}
          <span
            className={cn(
              "truncate font-mono text-xs",
              state.kind === "live"
                ? "text-zinc-700 dark:text-zinc-300"
                : "text-zinc-400 dark:text-zinc-600"
            )}
          >
            {state.kind === "live" && state.url
              ? state.url
              : "about:blank — waiting for navigation"}
          </span>
        </div>
        {state.kind === "live" && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Resume live view" : "Pause live view"}
            >
              {paused ? (
                <PlayIcon className="size-4" />
              ) : (
                <PauseIcon className="size-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                await poll();
                setRefreshing(false);
              }}
              aria-label="Refresh now"
            >
              <RefreshCwIcon
                className={cn("size-4", refreshing && "animate-spin")}
              />
            </Button>
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              {paused ? "Paused" : `Live · every ${POLL_MS / 1000}s`}
            </span>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
        {state.kind === "loading" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Checking for an active browser session…
          </p>
        ) : state.kind === "idle" ? (
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <GlobeIcon className="size-8 text-zinc-400" />
            <p className="text-sm font-medium">No active browser session</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              The engine opens one automatically whenever it needs to browse —
              or you can start one now and watch it live.
            </p>
            <Button size="sm" onClick={() => void startSession()}>
              Start a browser session
            </Button>
          </div>
        ) : state.kind === "starting" ? (
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <RefreshCwIcon className="size-6 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {state.note}
            </p>
          </div>
        ) : state.kind === "error" ? (
          <div className="max-w-md p-6 text-center text-sm text-red-500">
            {state.message}
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={state.image}
            alt="Live browser frame"
            className="h-full w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}
