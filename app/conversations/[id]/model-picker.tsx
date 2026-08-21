"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";

export type ProviderKeyMeta = {
  provider: string;
  keyHint: string | null;
};

type ModelInfo = { id: string; name?: string };

const PROVIDER_LABELS: Record<string, string> = {
  "opencode-go": "opencode",
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
};

const LOGO_SLUGS: Record<string, string> = {
  "opencode-go": "opencode",
  openai: "openai",
  anthropic: "anthropic",
  deepseek: "deepseek",
  google: "google",
};

export default function ModelPicker({
  conversationId,
  currentProvider,
  currentModel,
  defaultModel,
  configuredProviders,
}: {
  conversationId?: string;
  currentProvider: string | null;
  currentModel: string | null;
  defaultModel?: { provider: string; id: string } | null;
  configuredProviders: string[];
}) {
  const [open, setOpen] = useState(false);
  const [modelsByProvider, setModelsByProvider] = useState<
    Record<string, ModelInfo[]>
  >({});
  const [selection, setSelection] = useState<{
    provider: string;
    model: string;
  } | null>(
    currentProvider && currentModel
      ? { provider: currentProvider, model: currentModel }
      : defaultModel
      ? { provider: defaultModel.provider, model: defaultModel.id }
      : null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    for (const provider of configuredProviders) {
      if (modelsByProvider[provider]) continue;
      fetch(`/api/models/${provider}`)
        .then((res) => (res.ok ? res.json() : { models: [] }))
        .then((data) =>
          setModelsByProvider((prev) => ({
            ...prev,
            [provider]: data.models ?? [],
          }))
        )
        .catch(() =>
          setModelsByProvider((prev) => ({ ...prev, [provider]: [] }))
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function select(provider: string, model: string) {
    setSaving(true);
    try {
      if (conversationId) {
        const res = await fetch(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, model }),
        });
        if (!res.ok) return;
      }
      setSelection({ provider, model });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={configuredProviders.length === 0}
            className="gap-2 rounded-full"
          />
        }
      >
          {selection ? (
            <>
              <ModelSelectorLogo provider={LOGO_SLUGS[selection.provider] ?? selection.provider} />
              <span className="max-w-48 truncate font-normal">
                {PROVIDER_LABELS[selection.provider] ?? selection.provider}
                {" / "}
                {selection.model}
              </span>
            </>
          ) : (
            <span className="font-normal">
              {configuredProviders.length === 0
                ? "No API keys"
                : "Default model"}
            </span>
          )}
          <ChevronsUpDownIcon className="size-3.5 opacity-50" />
        </ModelSelectorTrigger>
      <ModelSelectorContent title="Select model">
        <ModelSelectorInput placeholder="Search models…" />
        <ModelSelectorList>
          <ModelSelectorEmpty>{saving ? "Saving…" : "No models found"}</ModelSelectorEmpty>
          {configuredProviders.map((provider) => (
            <ModelSelectorGroup
              key={provider}
              heading={PROVIDER_LABELS[provider] ?? provider}
            >
              {(modelsByProvider[provider] ?? []).map((model) => {
                const active =
                  selection?.provider === provider &&
                  selection?.model === model.id;
                return (
                  <ModelSelectorItem
                    key={`${provider}:${model.id}`}
                    value={`${provider}:${model.id}`}
                    onSelect={() => select(provider, model.id)}
                  >
                    <ModelSelectorLogo
                      provider={LOGO_SLUGS[provider] ?? provider}
                    />
                    <ModelSelectorName>{model.id}</ModelSelectorName>
                    {active && (
                      <CheckIcon className="ml-auto size-4" />
                    )}
                  </ModelSelectorItem>
                );
              })}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}
