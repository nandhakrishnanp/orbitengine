"use client";

import { useEffect, useState } from "react";
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

type EngineTools = {
  run_command: { input: { command: string }; output: { exitCode: number; stdout: string; stderr: string } };
  read_file: { input: { path: string }; output: { content?: string; error?: string } };
  write_file: { input: { path: string; content: string }; output: { success: boolean; path: string } };
  list_files: { input: { path: string }; output: { entries: string } };
};

const toolTitles: Record<string, string> = {
  run_command: "Run command",
  read_file: "Read file",
  write_file: "Write file",
  list_files: "List files",
};

function ToolCall({ part }: { part: ToolUIPart<EngineTools> }) {
  const toolName = part.type.replace("tool-", "");
  const isRunCommand = toolName === "run_command";
  const output = part.output as Record<string, unknown> | undefined;

  const inputLabel = (() => {
    const input = part.input as Record<string, string> | undefined;
    if (!input) return null;
    if (toolName === "run_command") return input.command;
    if (toolName === "read_file" || toolName === "write_file" || toolName === "list_files") return input.path;
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
        {!isRunCommand && (
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
  const isStreaming = status === "streaming" || status === "submitted";

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
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
            <input
              name="content"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? "Engine is working…" : "Describe the change to make…"}
              disabled={isStreaming}
              className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              autoComplete="off"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-lg border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Send
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
