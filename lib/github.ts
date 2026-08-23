import crypto from "node:crypto";
import fs from "node:fs";
import { pool } from "@/lib/db";

const API_BASE = "https://api.github.com";

export type GitHubRepo = {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
};

function privateKey(): string {
  const fromEnv = process.env.GITHUB_APP_PRIVATE_KEY;
  if (fromEnv) return fromEnv.replace(/\\n/g, "\n");
  const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (path) return fs.readFileSync(path, "utf8");
  throw new Error(
    "GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH is not set"
  );
}

export function createAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("GITHUB_APP_ID is not set");

  const now = Math.floor(Date.now() / 1000);
  const b64u = (input: string | Buffer) =>
    Buffer.from(input).toString("base64url");

  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64u(
    JSON.stringify({ iat: now, exp: now + 540, iss: appId })
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput), privateKey())
    .toString("base64url");

  return `${signingInput}.${signature}`;
}

async function githubRequest<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "orbitengine",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub API ${res.status} for ${path}: ${detail}`);
  }

  return (await res.json()) as T;
}

async function getProviderAccountId(userId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT "providerAccountId" FROM accounts WHERE "userId" = $1 AND provider = 'github' LIMIT 1`,
    [userId]
  );
  const id = rows[0]?.providerAccountId as string | undefined;
  if (!id) {
    throw new Error("No GitHub account linked; re-sign in with GitHub");
  }
  return id;
}

type AppInstallation = { id: number; account: { id: number } };

async function findInstallationForUser(
  userId: string
): Promise<AppInstallation | null> {
  const providerAccountId = await getProviderAccountId(userId);
  const jwt = createAppJwt();

  const installations = await githubRequest<
    Array<{ id: number; account: { id: number } }>
  >("/app/installations?per_page=100", jwt);

  return (
    installations.find(
      (item) => String(item.account.id) === providerAccountId
    ) ?? null
  );
}

export async function isGitHubAppInstalled(userId: string): Promise<boolean> {
  return (await findInstallationForUser(userId)) !== null;
}

export async function getGitHubAppInstallUrl(): Promise<string> {
  const jwt = createAppJwt();
  const app = await githubRequest<{ slug: string }>("/app", jwt);
  return `https://github.com/apps/${app.slug}/installations/new`;
}

async function getInstallationIdForUser(userId: string): Promise<number> {
  const installation = await findInstallationForUser(userId);
  if (!installation) {
    let hint = "";
    try {
      hint = ` Install it at ${await getGitHubAppInstallUrl()}`;
    } catch {
      // Install URL lookup is best-effort; keep the original error clean.
    }
    throw new Error(
      `The GitHub App is not installed on your account; install it to attach repositories.${hint}`
    );
  }
  return installation.id;
}

async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = createAppJwt();
  const { token } = await githubRequest<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    jwt,
    { method: "POST", body: "{}" }
  );
  return token;
}

export async function getInstallationTokenForUser(
  userId: string
): Promise<string> {
  const installationId = await getInstallationIdForUser(userId);
  return getInstallationToken(installationId);
}

export async function listAccessibleRepos(userId: string): Promise<GitHubRepo[]> {
  const token = await getInstallationTokenForUser(userId);

  const { repositories } = await githubRequest<{
    repositories: Array<{
      full_name: string;
      name: string;
      owner: { login: string };
      private: boolean;
    }>;
  }>("/installation/repositories", token);

  return repositories
    .map((repo) => ({
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      private: repo.private,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}