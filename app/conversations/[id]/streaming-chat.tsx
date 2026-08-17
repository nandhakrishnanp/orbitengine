"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  FileText,
  FolderGit2,
  GitBranch,
  ListTree,
  Lock,
  Send,
  Sparkles,
  Square,
  SquareTerminal,
  XCircle,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from "ai";
import type { BundledLanguage } from "shiki";
import { CodeBlock } from "@/components/ai-elements/code-block";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Terminal } from "@/components/ai-elements/terminal";

type Repo = {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
};

type EngineTools = {
  run_command: { input: { command: string }; output: { exitCode: number; stdout: string; stderr: string } };
  read_file: { input: { path: string }; output: { content?: string; error?: string } };
  write_file: { input: { path: string; content: string }; output: { success: boolean; path: string } };
  list_files: { input: { path: string }; output: { entries: string } };
  create_pull_request: { input: { owner: string; repo: string; title: string; head: string; base: string; body?: string }; output: { number: number; url: string; title: string } };
  create_issue: { input: { owner: string; repo: string; title: string; body?: string; labels?: string[] }; output: { number: number; url: string; title: string } };
  create_repository: { input: { name: string; description?: string; private?: boolean }; output: { fullName: string; url: string; cloneUrl: string; owner: string; name: string } };
};

const toolTitles: Record<string, string> = {
  run_command: "Run command",
  read_file: "Read file",
  write_file: "Write file",
  list_files: "List files",
  create_pull_request: "Open pull request",
  create_issue: "Create issue",
  create_repository: "Create repository",
};

const LANGUAGE_MAP: Record<string, BundledLanguage> = {
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  md: "markdown",
  mdx: "mdx",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sql: "sql",
  xml: "xml",
  svg: "xml",
  vue: "vue",
  svelte: "svelte",
  dockerfile: "dockerfile",
};

function languageFor(name: string): BundledLanguage {
  const base = name.toLowerCase();
  if (base === "dockerfile") return "dockerfile";
  const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
  return LANGUAGE_MAP[ext] ?? "text";
}

const FILE_TOOLS = ["read_file", "write_file", "list_files"] as const;

function FriendlyInput({
  toolName,
  input,
}: {
  toolName: string;
  input: Record<string, unknown> | undefined;
}) {
  if (!input) return null;

  if (toolName === "run_command") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <SquareTerminal className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs">
          {(input.command as string) || "Running command…"}
        </span>
      </div>
    );
  }

  if ((FILE_TOOLS as readonly string[]).includes(toolName)) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <FolderGit2 className="size-4 shrink-0" />
        <span className="font-mono text-xs">
          {(input.path as string) || "—"}
        </span>
      </div>
    );
  }

  return <ToolInput input={input} />;
}

function FriendlyOutput({
  toolName,
  input,
  output,
}: {
  toolName: string;
  input: Record<string, unknown> | undefined;
  output: Record<string, unknown> | undefined;
}) {
  const path = (input?.path as string) ?? "";

  if (toolName === "read_file") {
    const error = output?.error as string | undefined;
    if (error) {
      return (
        <p className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400">
          <XCircle className="size-4 shrink-0" />
          {error}
        </p>
      );
    }
    const content = output?.content as string | undefined;
    if (typeof content === "string") {
      return (
        <div className="flex items-start gap-2">
          <FileText className="mt-1 size-4 shrink-0 text-muted-foreground" />
          <CodeBlock
            className="border-none"
            code={content}
            language={languageFor(path)}
          />
        </div>
      );
    }
    return null;
  }

  if (toolName === "write_file") {
    const success = Boolean(output?.success);
    const outPath = (output?.path as string) ?? path;
    return (
      <p
        className={`flex items-center gap-2 text-sm ${
          success
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        }`}
      >
        {success ? (
          <CircleCheck className="size-4 shrink-0" />
        ) : (
          <XCircle className="size-4 shrink-0" />
        )}
        {success ? `Saved ${outPath}` : `Failed to write ${outPath}`}
      </p>
    );
  }

  if (toolName === "list_files") {
    const entries = output?.entries as string | undefined;
    if (!entries) return null;
    let items: string[] = [];
    try {
      const parsed = JSON.parse(entries);
      items = Array.isArray(parsed) ? parsed.map(String) : [entries];
    } catch {
      items = entries.split("\n").filter(Boolean);
    }
    return (
      <div className="flex items-start gap-2">
        <ListTree className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <ul className="space-y-0.5 font-mono text-xs text-zinc-500">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}

function ToolCall({ part }: { part: ToolUIPart<EngineTools> }) {
  const toolName = part.type.replace("tool-", "");
  const isRunCommand = toolName === "run_command";
  const isGitHubTool = toolName === "create_pull_request" || toolName === "create_issue" || toolName === "create_repository";
  const isFileTool = (FILE_TOOLS as readonly string[]).includes(toolName);
  const output = part.output as Record<string, unknown> | undefined;
  const input = part.input as Record<string, unknown> | undefined;

  const inputLabel = (() => {
    const input = part.input as Record<string, string> | undefined;
    if (!input) return null;
    if (toolName === "run_command") return input.command;
    if (FILE_TOOLS.includes(toolName as (typeof FILE_TOOLS)[number])) return input.path;
    if (toolName === "create_pull_request") return `${input.owner}/${input.repo}`;
    if (toolName === "create_issue") return `${input.owner}/${input.repo}`;
    if (toolName === "create_repository") return input.name;
    return null;
  })();

  return (
    <Tool open={part.state === "output-available" || part.state === "output-error"}>
      <ToolHeader title={`${toolTitles[toolName] ?? toolName}  ${inputLabel ? `— ${inputLabel}` : ""}`} type={part.type} state={part.state} />
      <ToolContent>
        <FriendlyInput toolName={toolName} input={input} />
        {isRunCommand && output && (
          <Terminal
            output={
              (output.stderr as string)
                ? `${output.stdout as string}\n${output.stderr as string}`
                : (output.stdout as string)
            }
            isStreaming={part.state === "input-available"}
          />
        )}
        {isGitHubTool && output && Boolean(output.url) && (
          <a
            href={output.url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:underline"
          >
            {output.url as string}
          </a>
        )}
        {isFileTool && (
          <FriendlyOutput toolName={toolName} input={input} output={output} />
        )}
        {!isRunCommand && !isGitHubTool && !isFileTool && (
          <ToolOutput output={part.output} errorText={part.errorText} />
        )}
      </ToolContent>
    </Tool>
  );
}

export default function StreamingChat({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
}) {
  const { messages, setMessages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/conversations/${conversationId}/engine`,
      body: { conversationId },
    }),
    id: conversationId,
    onFinish: async ({ message }) => {
      const text = message.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n");
      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: text,
            parts: message.parts,
          }),
        });
      } catch {
        // Persistence must never break the chat — ignore non-fatal failures.
      }
    },
  });

  const [input, setInput] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

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

  function selectRepo(repo: Repo) {
    const tokens = input.split(" ");
    tokens[tokens.length - 1] = `@${repo.fullName} `;
    setInput(tokens.join(" "));
    setMentionOpen(false);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput("");
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
    } catch {
      // Non-fatal: the engine builds context from the DB; still send anyway.
    }
    sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mentionOpen || filteredRepos.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % filteredRepos.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(
        (h) => (h - 1 + filteredRepos.length) % filteredRepos.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectRepo(filteredRepos[highlighted]);
    } else if (e.key === "Escape") {
      setMentionOpen(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Sparkles className="size-6" />}
              title="Work with the engine"
              description="Describe the fix or change you want made. The engine will read your code, make edits, and run tests in an isolated sandbox."
            />
          ) : (
            messages.map((message) => {
              const isLastMessage =
                message.id === messages[messages.length - 1]?.id;
              const hasVisible = message.parts.some(
                (p) => p.type === "text" || p.type.startsWith("tool-")
              );

              return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      if (part.type === "reasoning") {
                        return (
                          <Reasoning
                            key={i}
                            isStreaming={isStreaming && isLastMessage}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      }
                      if (part.type === "text") {
                        return (
                          <MessageResponse key={i}>
                            {part.text}
                          </MessageResponse>
                        );
                      }
                      if (part.type.startsWith("tool-")) {
                        return (
                          <ToolCall
                            key={i}
                            part={part as ToolUIPart<EngineTools>}
                          />
                        );
                      }
                      return null;
                    })}
                    {isStreaming && isLastMessage && !hasVisible && (
                      <span className="inline-block h-4 w-1.5 animate-pulse bg-muted-foreground/50" />
                    )}
                  </MessageContent>
                </Message>
              );
            })
          )}
        </ConversationContent>
      </Conversation>

      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              {mentionOpen && filteredRepos.length > 0 && (
                <div className="absolute bottom-full left-0 z-10 mb-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {filteredRepos.slice(0, 8).map((repo, index) => (
                    <button
                      key={repo.fullName}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectRepo(repo);
                      }}
                      onMouseEnter={() => setHighlighted(index)}
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                        index === highlighted
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : ""
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <GitBranch className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                        <span className="truncate font-medium">
                          {repo.fullName}
                        </span>
                      </span>
                      {repo.private && (
                        <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          <Lock className="size-3" />
                          private
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <input
                ref={inputRef}
                name="content"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  parseMention(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? "Engine is working…" : "Type @ to pick a repo, then describe the change…"}
                disabled={isStreaming}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                autoComplete="off"
              />
            </div>
            {isStreaming ? (
              <button
                type="button"
                onClick={() => stop()}
                className="flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Square className="size-3.5" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Send
                <Send className="size-3.5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
