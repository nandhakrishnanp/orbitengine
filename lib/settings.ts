import { pool } from "./db";
import { decrypt, encrypt, keyHint } from "./crypto";

export const PROVIDERS = [
  "opencode-go",
  "openai",
  "anthropic",
  "deepseek",
  "google",
] as const;
export type Provider = (typeof PROVIDERS)[number];

export type SettingsData = {
  model?: { provider: Provider; id: string };
  mode?: "plan" | "build";
  loop?: { maxSteps?: number; maxRetries?: number };
};

export const DEFAULT_SETTINGS: Required<
  Pick<SettingsData, "mode" | "loop">
> & {
  loop: Required<NonNullable<SettingsData["loop"]>>;
} = {
  mode: "build",
  loop: { maxSteps: 50, maxRetries: 5 },
};

export type ResolvedSettings = {
  model: SettingsData["model"];
  mode: "plan" | "build";
  loop: { maxSteps: number; maxRetries: number };
};

export async function getSettings(userId: string): Promise<ResolvedSettings> {
  const result = await pool.query<{ data: SettingsData }>(
    'SELECT data FROM settings WHERE "userId" = $1',
    [userId]
  );
  const data = result.rows[0]?.data ?? {};
  return {
    model: data.model,
    mode: data.mode ?? DEFAULT_SETTINGS.mode,
    loop: {
      maxSteps: data.loop?.maxSteps ?? DEFAULT_SETTINGS.loop.maxSteps,
      maxRetries: data.loop?.maxRetries ?? DEFAULT_SETTINGS.loop.maxRetries,
    },
  };
}

export async function updateSettings(
  userId: string,
  patch: SettingsData
): Promise<void> {
  await pool.query(
    `INSERT INTO settings ("userId", data) VALUES ($1, $2)
     ON CONFLICT ("userId") DO UPDATE
     SET data = settings.data || $2::jsonb, "updatedAt" = now()`,
    [userId, JSON.stringify(patch)]
  );
}

export type ProviderKeyMeta = {
  provider: Provider;
  keyHint: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listProviderKeys(
  userId: string
): Promise<ProviderKeyMeta[]> {
  const result = await pool.query<{
    provider: Provider;
    keyHint: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT provider, "keyHint", "createdAt", "updatedAt"
     FROM provider_keys WHERE "userId" = $1 ORDER BY provider`,
    [userId]
  );
  return result.rows.map((row) => ({
    provider: row.provider,
    keyHint: row.keyHint,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function setProviderKey(
  userId: string,
  provider: Provider,
  plaintextKey: string
): Promise<ProviderKeyMeta> {
  const encryptedKey = encrypt(plaintextKey);
  const hint = keyHint(plaintextKey);
  const result = await pool.query<{
    createdAt: Date;
    updatedAt: Date;
  }>(
    `INSERT INTO provider_keys ("userId", provider, "encryptedKey", "keyHint")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("userId", provider) DO UPDATE
     SET "encryptedKey" = EXCLUDED."encryptedKey",
         "keyHint" = EXCLUDED."keyHint",
         "updatedAt" = now()
     RETURNING "createdAt", "updatedAt"`,
    [userId, provider, encryptedKey, hint]
  );
  return {
    provider,
    keyHint: hint,
    createdAt: result.rows[0].createdAt.toISOString(),
    updatedAt: result.rows[0].updatedAt.toISOString(),
  };
}

export async function removeProviderKey(
  userId: string,
  provider: Provider
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM provider_keys WHERE "userId" = $1 AND provider = $2',
    [userId, provider]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getProviderKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  const result = await pool.query<{ encryptedKey: string }>(
    'SELECT "encryptedKey" FROM provider_keys WHERE "userId" = $1 AND provider = $2',
    [userId, provider]
  );
  if (!result.rows[0]) return null;
  try {
    return decrypt(result.rows[0].encryptedKey);
  } catch {
    return null;
  }
}
