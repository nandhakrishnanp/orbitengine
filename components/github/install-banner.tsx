"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

export default function InstallBanner() {
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(() => {
    fetch("/api/github/installation-status")
      .then(async (res) => {
        if (!res.ok) {
          setInstallUrl(null);
          return;
        }
        const data = (await res.json()) as {
          installed: boolean;
          installUrl: string | null;
        };
        setInstallUrl(data.installed ? null : data.installUrl);
      })
      .catch(() => setInstallUrl(null));
  }, []);

  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [check]);

  if (!installUrl || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span>
        The GitHub App is not installed on your account. Install it to attach
        repositories.
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md bg-amber-900 px-2.5 py-1 font-medium text-white transition-colors hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
        >
          <ExternalLink className="size-3.5" />
          Install on GitHub
        </a>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-md p-1 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <X className="size-4" />
        </button>
      </span>
    </div>
  );
}
