"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from "ai";
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
import type { Mode } from "@/lib/settings";
import Composer from "./composer";
import { ToolCall, type EngineTools } from "./engine-tool-call";

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
