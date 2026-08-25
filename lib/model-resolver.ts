import { createProviderModel } from "@/lib/ai";
import {
  getSettings,
  getProviderKey,
  type Provider,
  type Mode,
} from "@/lib/settings";

const DEFAULT_PROVIDER: Provider = "opencode-go";
const DEFAULT_MODEL = "hy3-free";

export type ResolvedModel = {
  model: ReturnType<typeof createProviderModel>;
  providerId: Provider;
  modelId: string;
  loop: { maxSteps: number; maxRetries: number };
  mode: Mode;
  source: "user-key" | "platform-key";
};

// Shared model resolution (engine chat route + factory run engine): explicit
// choice wins, then user default, then the platform opencode-go key.
export async function resolveModel(
  userId: string,
  choice: { provider: string | null; model: string | null }
): Promise<ResolvedModel | null> {
  const settings = await getSettings(userId);
  const provider =
    (choice.provider as Provider | null) ??
    settings.model?.provider ??
    DEFAULT_PROVIDER;
  const modelId = choice.model ?? settings.model?.id ?? DEFAULT_MODEL;

  const storedKey = await getProviderKey(userId, provider);
  if (storedKey) {
    return {
      model: createProviderModel(provider, modelId, storedKey),
      providerId: provider,
      modelId,
      loop: settings.loop,
      mode: settings.mode,
      source: "user-key",
    };
  }
  // Fall back to the platform key (opencode-go only).
  if (process.env.OPENZEN_API_KEY && provider === DEFAULT_PROVIDER) {
    return {
      model: createProviderModel(provider, modelId, process.env.OPENZEN_API_KEY),
      providerId: provider,
      modelId,
      loop: settings.loop,
      mode: settings.mode,
      source: "platform-key",
    };
  }
  return null;
}
