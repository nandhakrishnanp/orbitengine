"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";

export default function SandboxStatus({
  conversationId,
  status,
  sandboxId,
}: {
  conversationId: string;
  status: string;
  sandboxId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const shouldProvision = status === "open" && !sandboxId;

  useEffect(() => {
    if (!shouldProvision || startedRef.current) return;
    startedRef.current = true;
    fetch(`/api/conversations/${conversationId}/sandbox`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Failed to provision sandbox");
          return;
        }
        router.refresh();
      })
      .catch(() => setError("Failed to provision sandbox"));
  }, [shouldProvision, conversationId, router]);

  const provisioning = status === "open" && !sandboxId && !error;

  const label = status === "closed"
    ? "Closed"
    : provisioning
      ? "Provisioning…"
      : "Sandbox ready";

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${
          status === "closed"
            ? "border-zinc-300 text-zinc-500 dark:border-zinc-700"
            : "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "closed"
              ? "bg-zinc-400"
              : provisioning
                ? "animate-pulse bg-amber-400"
                : "bg-emerald-500"
          }`}
        />
        {label}
      </span>

      {status === "closed" ? (
        <button
          onClick={async () => {
            setBusy(true);
            const res = await fetch(
              `/api/conversations/${conversationId}/sandbox`,
              { method: "POST" }
            );
            setBusy(false);
            if (res.ok) router.refresh();
          }}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <RotateCcw className="size-3.5" />
          Reopen
        </button>
      ) : (
        <button
          onClick={async () => {
            setBusy(true);
            const res = await fetch(`/api/conversations/${conversationId}`, {
              method: "DELETE",
            });
            setBusy(false);
            if (res.ok) router.refresh();
          }}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <X className="size-3.5" />
          Close
        </button>
      )}

      {error && (
        <span className="text-xs text-red-500 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}