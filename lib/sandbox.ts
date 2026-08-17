import { posix as path } from "node:path";
import { Sandbox } from "@vercel/sandbox";
import { pool } from "@/lib/db";
import { getInstallationTokenForUser } from "@/lib/github";

export type SandboxStatus = "provisioning" | "ready" | "closed";

export class MonitorError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function getConversationSandbox(
  conversationId: string,
  userId: string
): Promise<Sandbox> {
  const { rows } = await pool.query(
    `SELECT "sandboxId" FROM conversations WHERE id = $1 AND "userId" = $2`,
    [conversationId, userId]
  );
  if (rows.length === 0) {
    throw new MonitorError(404, "Not found");
  }
  const sandboxId = rows[0].sandboxId as string | null;
  if (!sandboxId) {
    throw new MonitorError(400, "Sandbox not provisioned");
  }
  try {
    return await Sandbox.get({ name: sandboxId });
  } catch {
    throw new MonitorError(400, "Sandbox unavailable");
  }
}

export interface SandboxTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  children?: SandboxTreeNode[];
}

const TREE_WALK_SCRIPT = `
const fs = require("fs");
const path = require("path");
const root = process.argv[1];
const SKIP = new Set(["node_modules", ".git", "dist", ".next", ".cache", "build", "target", "__pycache__"]);
const MAX_DEPTH = 5;
const MAX_ENTRIES = 2000;
let count = 0;
function walk(dir, depth) {
  const out = [];
  let names;
  try {
    names = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  names.sort((a, b) =>
    a.isDirectory() === b.isDirectory()
      ? a.name.localeCompare(b.name)
      : a.isDirectory()
        ? -1
        : 1
  );
  for (const d of names) {
    if (count >= MAX_ENTRIES) break;
    if (d.isDirectory() && SKIP.has(d.name)) continue;
    const full = path.join(dir, d.name);
    count++;
    if (d.isDirectory()) {
      if (depth >= MAX_DEPTH) {
        out.push({ name: d.name, path: full, type: "folder" });
      } else {
        out.push({ name: d.name, path: full, type: "folder", children: walk(full, depth + 1) });
      }
    } else if (d.isFile()) {
      let size = 0;
      try {
        size = fs.statSync(full).size;
      } catch {}
      out.push({ name: d.name, path: full, type: "file", size });
    }
  }
  return out;
}
process.stdout.write(JSON.stringify({ cwd: root, entries: walk(root, 0) }));
`;

export async function walkSandboxTree(
  sandbox: Sandbox
): Promise<{ cwd: string; entries: SandboxTreeNode[] }> {
  const result = await sandbox.runCommand("node", ["-e", TREE_WALK_SCRIPT, sandbox.cwd], {
    timeoutMs: 30000,
  });
  if (result.exitCode !== 0) {
    throw new MonitorError(500, "Failed to walk sandbox filesystem");
  }
  const raw = await result.stdout();
  return JSON.parse(raw) as { cwd: string; entries: SandboxTreeNode[] };
}

const MAX_FILE_SIZE = 1024 * 1024;

export interface SandboxFileResult {
  path: string;
  name: string;
  size: number;
  content?: string;
  binary?: boolean;
  tooLarge?: boolean;
}

export async function readSandboxFile(
  sandbox: Sandbox,
  requestedPath: string
): Promise<SandboxFileResult> {
  const root = sandbox.cwd;
  const resolved = path.resolve(root, requestedPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new MonitorError(400, "Path outside sandbox workspace");
  }
  const stats = await sandbox.fs.stat(resolved).catch(() => null);
  if (!stats) {
    throw new MonitorError(404, "File not found");
  }
  if (!stats.isFile()) {
    throw new MonitorError(400, "Not a file");
  }
  const base = { path: resolved, name: path.basename(resolved), size: stats.size };
  if (stats.size > MAX_FILE_SIZE) {
    return { ...base, tooLarge: true };
  }
  const buffer = await sandbox.fs.readFile(resolved);
  if (buffer.subarray(0, 8192).includes(0)) {
    return { ...base, binary: true };
  }
  return { ...base, content: buffer.toString("utf8") };
}

export function sandboxName(conversationId: string): string {
  return `conv-${conversationId.replace(/-/g, "").slice(0, 26)}`;
}

export async function provisionSandbox({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): Promise<string> {
  const token = await getInstallationTokenForUser(userId);
  const name = sandboxName(conversationId);

  const sandbox = await Sandbox.getOrCreate({
    name,
    persistent: true,
    env: {
      GITHUB_TOKEN: token,
    },
  });

  return sandbox.name;
}

export async function destroySandbox(conversationId: string): Promise<void> {
  const name = sandboxName(conversationId);
  try {
    const sandbox = await Sandbox.get({ name });
    await sandbox.delete();
  } catch {
    // Already gone — nothing to destroy.
  }
}
