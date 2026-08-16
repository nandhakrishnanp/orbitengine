"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Repo = {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
};

export default function MessageComposer({
  conversationId,
  initialAttachedRepository,
}: {
  conversationId: string;
  initialAttachedRepository: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [attachedRepository, setAttachedRepository] = useState<string | null>(
    initialAttachedRepository
  );
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/repos")
      .then((res) => (res.ok ? res.json() : { repos: [] }))
      .then((data) => setRepos(data.repos ?? []))
      .catch(() => setRepos([]));
  }, []);

  const filteredRepos = useMemo(() => {
    if (!mentionQuery) return repos;
    const q = mentionQuery.toLowerCase();
    return repos.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(q) ||
        repo.name.toLowerCase().includes(q)
    );
  }, [repos, mentionQuery]);

  function parseMention(next: string) {
    const tokens = next.split(" ");
    const last = tokens[tokens.length - 1];
    if (last.startsWith("@") && last.length > 1) {
      setMentionQuery(last.slice(1));
      setMentionOpen(true);
      setHighlighted(0);
    } else if (last === "@") {
      setMentionQuery("");
      setMentionOpen(true);
      setHighlighted(0);
    } else {
      setMentionOpen(false);
    }
  }

  function handleChange(next: string) {
    setValue(next);
    parseMention(next);
  }

  async function attachRepository(repo: Repo) {
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachedRepository: repo.fullName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to attach repository");
      return;
    }
    setAttachedRepository(repo.fullName);
    setError(null);

    const tokens = value.split(" ");
    tokens[tokens.length - 1] = `@${repo.fullName}`;
    setValue(tokens.join(" "));
    setMentionOpen(false);
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = value.trim();
    if (!content) return;

    const res = await fetch(
      `/api/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
    if (res.ok) {
      setValue("");
      setError(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send message");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!mentionOpen || filteredRepos.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((h) => (h + 1) % filteredRepos.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted(
        (h) => (h - 1 + filteredRepos.length) % filteredRepos.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      attachRepository(filteredRepos[highlighted]);
    } else if (event.key === "Escape") {
      setMentionOpen(false);
    }
  }

  return (
    <div className="relative">
      {error && (
        <p className="mb-2 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {attachedRepository && (
        <div className="mb-2 flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Attached:</span>
          <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 font-medium dark:border-zinc-700 dark:bg-zinc-900">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {attachedRepository}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative">
          <input
            ref={inputRef}
            name="content"
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              attachedRepository
                ? "Describe the change to make…"
                : "Type @ to attach a repository, then describe the change…"
            }
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
            autoComplete="off"
          />

          {mentionOpen && filteredRepos.length > 0 && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {filteredRepos.slice(0, 8).map((repo, index) => (
                <button
                  key={repo.fullName}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    attachRepository(repo);
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                    index === highlighted
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : ""
                  }`}
                >
                  <span className="truncate font-medium">
                    {repo.fullName}
                  </span>
                  {repo.private && (
                    <span className="ml-2 shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      private
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="self-end rounded-full bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Send
        </button>
      </form>
    </div>
  );
}