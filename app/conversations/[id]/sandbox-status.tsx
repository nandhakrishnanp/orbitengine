"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

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

  const label =
    status === "closed"
      ? "Sandbox closed"
      : provisioning
        ? "Provisioning…"
        : "Sandbox live";

  return (
    <div className="flex items-center gap-1.5">
      <span
        title={label}
        className={`h-2 w-2 rounded-full ${
          status === "closed"
            ? "bg-zinc-400 dark:bg-zinc-600"
            : provisioning
              ? "animate-pulse bg-amber-400"
              : "bg-emerald-500"
        }`}
      />

      {status === "closed" && (
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
          disabled={busy}
          title="Reopen sandbox"
          className="rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-600 disabled:opacity-50 dark:hover:text-zinc-300"
        >
          <RotateCcw className="size-3" />
        </button>
      )}

      {error && (
        <span className="text-xs text-red-500 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
