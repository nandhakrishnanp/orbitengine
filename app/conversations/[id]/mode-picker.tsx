"use client";

import { useEffect, useState } from "react";
import { BoxIcon, MessageSquareTextIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import type { Mode } from "@/lib/settings";

const MODE_OPTIONS: {
  value: Mode;
  label: string;
  description: string;
  icon: typeof BoxIcon;
}[] = [
  {
    value: "build",
    label: "Build",
    description: "Make anything",
    icon: BoxIcon,
  },
  {
    value: "plan",
    label: "Plan",
    description: "Ask questions, plan your work",
    icon: MessageSquareTextIcon,
  },
];

export default function ModePicker({
  conversationId,
  initialMode,
}: {
  conversationId: string;
  initialMode?: Mode | null;
}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "build");
  const [saving, setSaving] = useState(false);

  async function change(next: Mode) {
    if (saving || next === mode) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) return;
      setMode(next);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        void change(mode === "plan" ? "build" : "plan");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, saving]);

  const current =
    MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[1];
  const CurrentIcon = current.icon;

  return (
    <Select value={mode} onValueChange={(value) => change(value as Mode)}>
      <SelectTrigger
        size="sm"
        aria-label="Working mode"
        className="gap-1.5 rounded-full px-3 font-normal"
      >
        <span className="flex items-center gap-1.5">
          <CurrentIcon className="size-3.5 text-muted-foreground" />
          <span>{current.label}</span>
        </span>
      </SelectTrigger>
      <SelectContent side="top" align="start" className="w-72 min-w-72">
        <SelectGroup>
          <SelectLabel>&#8984; I to switch modes</SelectLabel>
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <SelectItem
                key={option.value}
                value={option.value}
                className="py-2"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="whitespace-normal leading-snug">
                  <span className="font-medium">{option.label}</span>{" "}
                  <span className="text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
