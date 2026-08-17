"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Lock, Send, Sparkles, Square } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart } from "ai";
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

function ToolCall({ part }: { part: ToolUIPart<EngineTools> }) {
  const toolName = part.type.replace("tool-", "");
  const isRunCommand = toolName === "run_command";
  const isGitHubTool = toolName === "create_pull_request" || toolName === "create_issue" || toolName === "create_repository";
  const output = part.output as Record<string, unknown> | undefined;

  const inputLabel = (() => {
    const input = part.input as Record<string, string> | undefined;
    if (!input) return null;
    if (toolName === "run_command") return input.command;
    if (toolName === "read_file" || toolName === "write_file" || toolName === "list_files") return input.path;
    if (toolName === "create_pull_request") return `${input.owner}/${input.repo}`;
    if (toolName === "create_issue") return `${input.owner}/${input.repo}`;
    if (toolName === "create_repository") return input.name;
    return null;
  })();

  return (
    <Tool open={part.state === "output-available" || part.state === "output-error"}>
      <ToolHeader title={`${toolTitles[toolName] ?? toolName}  ${inputLabel ? `— ${inputLabel}` : ""}`} type={part.type} state={part.state} />
      <ToolContent>
        <ToolInput input={part.input} />
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
        {!isRunCommand && !isGitHubTool && (
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
  initialMessages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const { messages, setMessages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/conversations/${conversationId}/engine`,
      body: { conversationId },
    }),
    id: conversationId,
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
      setMessages(
        initialMessages.map((m, i) => ({
          id: `init-${i}`,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
        }))
      );
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input.trim() });
    setInput("");
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
              const textParts = message.parts.filter((p) => p.type === "text");
              const reasoningParts = message.parts.filter((p) => p.type === "reasoning");
              const toolParts = message.parts.filter((p) => p.type.startsWith("tool-")) as ToolUIPart<EngineTools>[];
              const hasReasoning = reasoningParts.length > 0;
              const reasoningText = reasoningParts.map((p) => p.text).join("");
              const isLastMessage = message.id === messages[messages.length - 1]?.id;

              return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {hasReasoning && (
                      <Reasoning isStreaming={isStreaming && isLastMessage}>
                        <ReasoningTrigger />
                        <ReasoningContent>{reasoningText}</ReasoningContent>
                      </Reasoning>
                    )}
                    {textParts.map((part, i) => (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ))}
                    {toolParts.map((part, i) => (
                      <ToolCall key={i} part={part} />
                    ))}
                    {isStreaming && isLastMessage && !textParts.length && !toolParts.length && (
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
