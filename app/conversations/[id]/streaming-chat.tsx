"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  FileText,
  FolderGit2,
  Globe,
  Keyboard,
  ListTree,
  MousePointerClick,
  Sparkles,
  Square,
  SquareTerminal,
  TextCursorInput,
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
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import type { Mode } from "@/lib/settings";
import ModelPicker from "./model-picker";
import ModePicker from "./mode-picker";

type Repo = {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
};

type BrowserToolOutput = {
  ok?: boolean;
  output?: string;
  snapshot?: string;
  pass?: boolean;
};

type EngineTools = {
  run_command: { input: { command: string }; output: { exitCode: number; stdout: string; stderr: string } };
  read_file: { input: { path: string }; output: { content?: string; error?: string } };
  write_file: { input: { path: string; content: string }; output: { success: boolean; path: string } };
  list_files: { input: { path: string }; output: { entries: string } };
  create_pull_request: { input: { owner: string; repo: string; title: string; head: string; base: string; body?: string }; output: { number: number; url: string; title: string } };
  create_issue: { input: { owner: string; repo: string; title: string; body?: string; labels?: string[] }; output: { number: number; url: string; title: string } };
  create_repository: { input: { name: string; description?: string; private?: boolean }; output: { fullName: string; url: string; cloneUrl: string; owner: string; name: string } };
  browser_open: { input: { url: string }; output: BrowserToolOutput };
  browser_snapshot: { input: Record<string, never>; output: BrowserToolOutput & { snapshot?: string } };
  browser_click: { input: { ref: string }; output: BrowserToolOutput };
  browser_fill: { input: { ref: string; text: string }; output: BrowserToolOutput };
  browser_press: { input: { key: string }; output: BrowserToolOutput };
  browser_verify: { input: { kind: "title" | "url" | "text"; text?: string }; output: BrowserToolOutput };
  browser_close: { input: Record<string, never>; output: BrowserToolOutput };
};

const toolTitles: Record<string, string> = {
  run_command: "Run command",
  read_file: "Read file",
  write_file: "Write file",
  list_files: "List files",
  create_pull_request: "Open pull request",
  create_issue: "Create issue",
  create_repository: "Create repository",
  browser_open: "Open page",
  browser_snapshot: "Page snapshot",
  browser_click: "Click element",
  browser_fill: "Fill field",
  browser_press: "Press key",
  browser_verify: "Verify page",
  browser_close: "Close browser",
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
const BROWSER_ACTION_TOOLS = [
  "browser_click",
  "browser_fill",
  "browser_press",
] as const;

function BrowserSnapshotText({ text }: { text: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
      {text}
    </pre>
  );
}

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

  if (toolName === "browser_open") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <Globe className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs">
          {(input.url as string) || "Navigating…"}
        </span>
      </div>
    );
  }

  if (toolName === "browser_click") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <MousePointerClick className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs">
          {(input.ref as string) || "…"}
        </span>
      </div>
    );
  }

  if (toolName === "browser_fill") {
    const text = input.text as string | undefined;
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <TextCursorInput className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs">
          {(input.ref as string) || "—"}
          {text ? ` ← ${text.length > 40 ? `${text.slice(0, 40)}…` : text}` : ""}
        </span>
      </div>
    );
  }

  if (toolName === "browser_press") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <Keyboard className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs">
          {(input.key as string) || "…"}
        </span>
      </div>
    );
  }

  if (toolName === "browser_verify") {
    const kind = input.kind as string | undefined;
    const text = input.text as string | undefined;
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <ListTree className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs">
          {kind === "text"
            ? `visible: "${text ?? "?"}"`
            : kind
              ? `${kind} of page`
              : "…"}
        </span>
      </div>
    );
  }

  if (
    toolName === "browser_snapshot" ||
    toolName === "browser_close"
  ) {
    if (toolName === "browser_snapshot") {
      return (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Globe className="size-4 shrink-0" />
          <span className="font-mono text-xs">Reading accessibility tree…</span>
        </div>
      );
    }
    return null;
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

  if (
    (BROWSER_ACTION_TOOLS as readonly string[]).includes(toolName) ||
    toolName === "browser_open" ||
    toolName === "browser_snapshot"
  ) {
    const out = output as BrowserToolOutput | undefined;
    if (!out) return null;
    if (out.ok === false) {
      return (
        <p className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400">
          <XCircle className="size-4 shrink-0" />
          {out.output ?? "Failed"}
        </p>
      );
    }
    const body = out.snapshot ?? out.output;
    if (!body) return null;
    return (
      <div className="flex w-full items-start gap-2">
        <Globe className="mt-1 size-4 shrink-0 text-muted-foreground" />
        <BrowserSnapshotText text={body} />
      </div>
    );
  }

  if (toolName === "browser_verify") {
    const out = output as BrowserToolOutput | undefined;
    if (!out) return null;
    const passed = out.pass === true || (out.ok && out.pass === undefined);
    return (
      <p
        className={`flex items-center gap-2 text-sm ${
          passed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        }`}
      >
        {passed ? (
          <CircleCheck className="size-4 shrink-0" />
        ) : (
          <XCircle className="size-4 shrink-0" />
        )}
        {passed ? "PASS — verified on the page" : "FAIL"}
      </p>
    );
  }

  if (toolName === "browser_close") {
    const out = output as BrowserToolOutput | undefined;
    if (!out) return null;
    return out.ok ? null : (
      <p className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400">
        <XCircle className="size-4 shrink-0" />
        {out.output ?? "Failed to close browser"}
      </p>
    );
  }

  return null;
}

function ToolCall({ part }: { part: ToolUIPart<EngineTools> }) {
  const toolName = part.type.replace("tool-", "");
  const isRunCommand = toolName === "run_command";
  const isGitHubTool = toolName === "create_pull_request" || toolName === "create_issue" || toolName === "create_repository";
  const isFileTool = (FILE_TOOLS as readonly string[]).includes(toolName);
  const isBrowserTool = toolName.startsWith("browser_");
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
    if (toolName === "browser_open") return input.url;
    if (toolName === "browser_click" || toolName === "browser_fill") return input.ref;
    if (toolName === "browser_press") return input.key;
    if (toolName === "browser_verify")
      return input.kind === "text" ? `text: ${input.text}` : input.kind;
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
        {isBrowserTool && (
          <FriendlyOutput toolName={toolName} input={input} output={output} />
        )}
        {!isRunCommand && !isGitHubTool && !isFileTool && !isBrowserTool && (
          <ToolOutput output={part.output} errorText={part.errorText} />
        )}
      </ToolContent>
    </Tool>
  );
}

export default function StreamingChat({
  conversationId,
  initialMessages,
  initialMode,
  defaultModel,
  configuredProviders,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  initialMode?: Mode | null;
  defaultModel?: { provider: string; id: string } | null;
  configuredProviders?: string[];
}) {
  const { messages, setMessages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/conversations/${conversationId}/engine`,
      body: { conversationId },
    }),
    id: conversationId,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, []);

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
          <Composer
            conversationId={conversationId}
            sendMessage={sendMessage}
            isStreaming={isStreaming}
            stop={stop}
            initialMode={initialMode}
            defaultModel={defaultModel}
            configuredProviders={configuredProviders ?? []}
          />
        </div>
      </div>
    </div>
  );
}

function Composer({
  conversationId,
  sendMessage,
  isStreaming,
  stop,
  initialMode,
  defaultModel,
  configuredProviders,
}: {
  conversationId: string;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  isStreaming: boolean;
  stop: () => void;
  initialMode?: Mode | null;
  defaultModel?: { provider: string; id: string } | null;
  configuredProviders: string[];
}) {
  const [input, setInput] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    const next = tokens.join(" ");
    setInput(next);
    if (textareaRef.current) textareaRef.current.value = next;
    setMentionOpen(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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

  async function handleSubmit(message: { text?: string }) {
    const text = (message.text ?? "").trim();
    if (!text || isStreaming) return;
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
    } catch {
      // Non-fatal: the engine builds context from the DB; still send anyway.
    }
    setInput("");
    setMentionOpen(false);
    sendMessage({ text });
  }

  return (
    <PromptInputProvider>
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              parseMention(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? "Engine is working…"
                : "Type @ to pick a repo, then describe the change…"
            }
            disabled={isStreaming}
            rows={2}
            className="border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 disabled:opacity-50"
          />
        </PromptInputBody>
        <PromptInputFooter className="mt-2 items-center justify-between">
          <PromptInputTools>
            <ModePicker
              conversationId={conversationId}
              initialMode={initialMode}
            />
            <ModelPicker
              conversationId={conversationId}
              currentProvider={null}
              currentModel={null}
              defaultModel={defaultModel}
              configuredProviders={configuredProviders}
            />
          </PromptInputTools>
          <PromptInputSubmit />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  );
}
