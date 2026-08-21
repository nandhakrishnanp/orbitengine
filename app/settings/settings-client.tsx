"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, Trash2Icon } from "lucide-react";
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
import { Input } from "@/components/ui/input";

const PROVIDERS = ["opencode-go", "openai", "anthropic", "deepseek", "google"];

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

type KeyMeta = {
  provider: string;
  keyHint: string | null;
  createdAt: string;
  updatedAt: string;
};

type ResolvedSettings = {
  model?: { provider: string; id: string } | null;
  mode: string;
  loop: { maxSteps: number; maxRetries: number };
};

type ModelInfo = { id: string; name?: string };

export default function SettingsClient() {
  const [settings, setSettings] = useState<ResolvedSettings | null>(null);
  const [keys, setKeys] = useState<KeyMeta[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<
    Record<string, ModelInfo[]>
  >({});
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) {
      setError(res.status === 401 ? "Sign in required" : "Failed to load");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setSettings(data.settings);
    setKeys(data.keys ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!pickerOpen) return;
    for (const key of keys) {
      if (modelsByProvider[key.provider]) continue;
      fetch(`/api/models/${key.provider}`)
        .then((res) => (res.ok ? res.json() : { models: [] }))
        .then((data) =>
          setModelsByProvider((prev) => ({
            ...prev,
            [key.provider]: data.models ?? [],
          }))
        )
        .catch(() =>
          setModelsByProvider((prev) => ({ ...prev, [key.provider]: [] }))
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  async function saveDefaultModel(provider: string, id: string) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: { provider, id } }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setPickerOpen(false);
    } else {
      setError("Failed to save default model");
    }
  }

  async function saveKey(provider: string) {
    const key = (keyDrafts[provider] ?? "").trim();
    if (!key) return;
    const res = await fetch(`/api/settings/keys/${provider}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
      setError(null);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save key");
    }
  }

  async function removeKey(provider: string) {
    const res = await fetch(`/api/settings/keys/${provider}`, {
      method: "DELETE",
    });
    if (res.ok) {
      load();
    } else {
      setError("Failed to remove key");
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-zinc-500">Loading…</p>;
  }
  if (error && !settings) {
    return <p className="p-6 text-sm text-red-500">{error}</p>;
  }

  const configured = new Set(keys.map((k) => k.provider));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <section>
        <h2 className="mb-1 text-lg font-semibold">Default model</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Used by conversations without their own override. Only providers with
          a stored API key are listed.
        </p>
        <ModelSelector open={pickerOpen} onOpenChange={setPickerOpen}>
          <ModelSelectorTrigger
            render={
              <Button
                variant="outline"
                disabled={configured.size === 0}
                className="gap-2"
              />
            }
          >
              {settings?.model ? (
                <>
                  <ModelSelectorLogo
                    provider={
                      LOGO_SLUGS[settings.model.provider] ??
                      settings.model.provider
                    }
                  />
                  <span className="font-normal">
                    {PROVIDER_LABELS[settings.model.provider] ??
                      settings.model.provider}{" "}
                    / {settings.model.id}
                  </span>
                </>
              ) : (
                <span className="font-normal">
                  {configured.size === 0
                    ? "Add an API key first"
                    : "Choose default model"}
                </span>
              )}
              <ChevronsUpDownIcon className="size-3.5 opacity-50" />
            </ModelSelectorTrigger>
          <ModelSelectorContent title="Select default model">
            <ModelSelectorInput placeholder="Search models…" />
            <ModelSelectorList>
              <ModelSelectorEmpty>No models found</ModelSelectorEmpty>
              {[...configured].map((provider) => (
                <ModelSelectorGroup
                  key={provider}
                  heading={PROVIDER_LABELS[provider] ?? provider}
                >
                  {(modelsByProvider[provider] ?? []).map((model) => {
                    const active =
                      settings?.model?.provider === provider &&
                      settings?.model?.id === model.id;
                    return (
                      <ModelSelectorItem
                        key={`${provider}:${model.id}`}
                        value={`${provider}:${model.id}`}
                        onSelect={() => saveDefaultModel(provider, model.id)}
                      >
                        <ModelSelectorLogo
                          provider={LOGO_SLUGS[provider] ?? provider}
                        />
                        <ModelSelectorName>{model.id}</ModelSelectorName>
                        {active && <CheckIcon className="ml-auto size-4" />}
                      </ModelSelectorItem>
                    );
                  })}
                </ModelSelectorGroup>
              ))}
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">API keys</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Stored encrypted at rest. Never sent to your browser.
        </p>
        <div className="flex flex-col gap-4">
          {PROVIDERS.map((provider) => {
            const meta = keys.find((k) => k.provider === provider);
            return (
              <div
                key={provider}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <ModelSelectorLogo
                      provider={LOGO_SLUGS[provider] ?? provider}
                    />
                    {PROVIDER_LABELS[provider] ?? provider}
                    {meta && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        ••••{meta.keyHint}
                      </span>
                    )}
                  </span>
                  {meta && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeKey(provider)}
                      aria-label={`Remove ${PROVIDER_LABELS[provider] ?? provider} key`}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={
                      meta ? "Replace key…" : `Paste ${PROVIDER_LABELS[provider] ?? provider} API key`
                    }
                    value={keyDrafts[provider] ?? ""}
                    onChange={(e) =>
                      setKeyDrafts((prev) => ({
                        ...prev,
                        [provider]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveKey(provider);
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => saveKey(provider)}
                    disabled={!(keyDrafts[provider] ?? "").trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
