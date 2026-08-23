"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import type { Mode } from "@/lib/settings";
import ModelPicker from "./model-picker";
import ModePicker from "./mode-picker";

type Repo = {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
};

type Skill = {
  id: string;
  name: string;
};

export default function Composer({
  conversationId,
  sendMessage,
  isStreaming,
  stop,
  initialMode,
  defaultModel,
  configuredProviders,
}: {
  conversationId: string;
  sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
  isStreaming: boolean;
  stop: () => void;
  initialMode?: Mode | null;
  defaultModel?: { provider: string; id: string } | null;
  configuredProviders: string[];
}) {
  const [input, setInput] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/repos")
      .then((res) => (res.ok ? res.json() : { repos: [] }))
      .then((data) => setRepos(data.repos ?? []))
      .catch(() => setRepos([]));
    fetch("/api/skills")
      .then((res) => (res.ok ? res.json() : { skills: [] }))
      .then((data) => setSkills(data.skills ?? []))
      .catch(() => setSkills([]));
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

  const filteredSkills = useMemo(() => {
    if (!skillQuery) return skills;
    const q = skillQuery.toLowerCase();
    return skills.filter((skill) => skill.name.toLowerCase().includes(q));
  }, [skills, skillQuery]);

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
    if (last.startsWith("/") && last.length > 1) {
      setSkillQuery(last.slice(1));
      setSkillOpen(true);
      setHighlighted(0);
    } else if (last === "/") {
      setSkillQuery("");
      setSkillOpen(true);
      setHighlighted(0);
    } else {
      setSkillOpen(false);
    }
  }

  function selectRepo(repo: Repo) {
    const tokens = input.split(" ");
    tokens[tokens.length - 1] = `@${repo.fullName} `;
    setInput(tokens.join(" "));
    setMentionOpen(false);
    textareaRef.current?.focus();
  }

  function selectSkill(skill: Skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill.name) ? prev : [...prev, skill.name]
    );
    // Drop the typed "/partial" token from the input; the skill rides
    // along as a chip and is prepended to the message on submit.
    const tokens = input.split(" ");
    tokens.splice(-1, 1);
    setInput(tokens.length > 0 ? tokens.join(" ") + " " : "");
    setSkillOpen(false);
    textareaRef.current?.focus();
  }

  function removeSkill(name: string) {
    setSelectedSkills((prev) => prev.filter((s) => s !== name));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (skillOpen && filteredSkills.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % filteredSkills.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted(
          (h) => (h - 1 + filteredSkills.length) % filteredSkills.length
        );
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectSkill(filteredSkills[highlighted]);
        return;
      } else if (e.key === "Escape") {
        setSkillOpen(false);
        return;
      }
    }

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
    const typed = (message.text ?? "").trim();
    const prefix = selectedSkills.map((name) => `/${name}`).join(" ");
    const text = prefix ? `${prefix} ${typed}`.trim() : typed;
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
    setSelectedSkills([]);
    setMentionOpen(false);
    setSkillOpen(false);
    setInput("");
    sendMessage({ text });
  }

  return (
    <div className="relative">
      {skillOpen && filteredSkills.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 z-10 mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="max-h-48 overflow-auto py-1">
              {filteredSkills.map((skill, i) => (
                <li key={skill.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm ${
                      i === highlighted ? "bg-zinc-100 dark:bg-zinc-800" : ""
                    }`}
                    onMouseEnter={() => setHighlighted(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSkill(skill);
                    }}
                  >
                    <span className="font-mono">/{skill.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {mentionOpen && filteredRepos.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 z-10 mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="max-h-48 overflow-auto py-1">
              {filteredRepos.slice(0, 8).map((repo, i) => (
                <li key={repo.fullName}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlighted(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectRepo(repo);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-1.5 text-left text-sm ${
                      i === highlighted ? "bg-zinc-100 dark:bg-zinc-800" : ""
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
                </li>
              ))}
            </ul>
          </div>
        )}
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
                  : "Type @ to pick a repo, / to use a skill, then describe the change…"
              }
              disabled={isStreaming}
              rows={2}
              className="w-full block resize-none border-0 bg-transparent px-4 py-3 text-left text-sm focus-visible:ring-0 disabled:opacity-50"
            />
          </PromptInputBody>
          <PromptInputFooter className="mt-2 items-center justify-between px-3 pb-2">
            <PromptInputTools className="gap-1.5">
            {selectedSkills.length > 0 && (
              <span className="flex items-center gap-1">
                {selectedSkills.map((name) => (
                  <span
                    key={name}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-transparent pr-2 pl-3 text-xs font-normal text-foreground select-none dark:bg-input/30"
                  >
                    <span className="font-mono">/{name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      className="flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => removeSkill(name)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </span>
            )}
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
    </div>
  );
}
