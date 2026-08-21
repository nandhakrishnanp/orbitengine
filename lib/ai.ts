import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Provider } from "@/lib/settings";

export const PROVIDER_REGISTRY: Record<
  Provider,
  { label: string; baseURL: string }
> = {
  "opencode-go": {
    label: "opencode",
    baseURL:
      process.env.OPENZEN_BASE_URL ?? "https://opencode.ai/zen/v1",
  },
  openai: { label: "OpenAI", baseURL: "https://api.openai.com/v1" },
  anthropic: {
    label: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
  },
  deepseek: { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1" },
  google: {
    label: "Google",
    baseURL:
      "https://generativelanguage.googleapis.com/v1beta/openai",
  },
};

export function createProviderModel(
  provider: Provider,
  modelId: string,
  apiKey: string
) {
  const entry = PROVIDER_REGISTRY[provider];
  if (!entry) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  const client = createOpenAICompatible({
    name: provider,
    apiKey,
    baseURL: entry.baseURL,
  });
  return client(modelId);
}

export async function listProviderModels(
  provider: Provider,
  apiKey: string
): Promise<{ id: string; name?: string }[]> {
  const entry = PROVIDER_REGISTRY[provider];
  if (!entry) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  const res = await fetch(`${entry.baseURL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(
      `Model list request failed (${res.status}) for ${provider}`
    );
  }
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => ({ id: m.id }));
}
