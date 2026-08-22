"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Skill = {
  id: string;
  name: string;
  content: string;
  declaredTools: string[];
};

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export default function SkillsSection() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // null = closed, "new" = create, else skill name
  const [nameDraft, setNameDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/skills");
    if (!res.ok) {
      setError(res.status === 401 ? "Sign in required" : "Failed to load skills");
      setSkills([]);
      return;
    }
    const data = await res.json();
    setSkills(data.skills ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function startCreate() {
    setEditing("new");
    setNameDraft("");
    setContentDraft("");
    setError(null);
  }

  function startEdit(skill: Skill) {
    setEditing(skill.name);
    setNameDraft(skill.name);
    setContentDraft(skill.content);
    setError(null);
  }

  function cancel() {
    setEditing(null);
    setNameDraft("");
    setContentDraft("");
    setError(null);
  }

  async function save() {
    const name = nameDraft.trim().toLowerCase();
    const content = contentDraft;
    if (!NAME_PATTERN.test(name)) {
      setError("Name must be lowercase letters, digits or hyphens (max 64)");
      return;
    }
    if (!content.trim()) {
      setError("Content must not be empty");
      return;
    }
    setSaving(true);
    const isNew = editing === "new" || editing === null;
    const res = await fetch(isNew ? "/api/skills" : `/api/skills/${editing}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? { name, content } : { content }),
    });
    setSaving(false);
    if (res.ok) {
      cancel();
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save skill");
    }
  }

  async function remove(name: string) {
    const res = await fetch(`/api/skills/${name}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      setError("Failed to delete skill");
    }
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Skills</h2>
        {editing === null && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={startCreate}>
            <PlusIcon className="size-3.5" />
            New skill
          </Button>
        )}
      </div>
      <p className="mb-3 text-sm text-zinc-500">
        Markdown instruction bundles invoked by typing{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
          /skillname
        </code>{" "}
        in chat. Available in all your conversations, Build mode only.
      </p>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {editing !== null && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <Input
            placeholder="skill-name"
            value={nameDraft}
            disabled={editing !== "new"}
            onChange={(e) => setNameDraft(e.target.value)}
          />
          <Textarea
            placeholder="Markdown instructions for the engine…"
            rows={8}
            value={contentDraft}
            onChange={(e) => setContentDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {editing === "new" ? "Create" : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(skills ?? []).map((skill) =>
          editing === skill.name ? null : (
            <div
              key={skill.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <span className="font-mono text-sm">/{skill.name}</span>
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${skill.name}`}
                  onClick={() => startEdit(skill)}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${skill.name}`}
                  onClick={() => remove(skill.name)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </span>
            </div>
          )
        )}
        {skills !== null && skills.length === 0 && editing === null && (
          <p className="text-sm text-zinc-500">No skills yet.</p>
        )}
      </div>
    </section>
  );
}
