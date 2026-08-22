import {
  AgentBrowserCommandError,
  buildAgentBrowserArgv,
  createAgentBrowserCommandResult,
  throwIfCommandFailed,
} from "@agent-browser/sandbox";
import { installAgentBrowserInVercelSandbox } from "@agent-browser/sandbox/vercel";
import type { Sandbox } from "@vercel/sandbox";

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 20_000;

export class BrowserError extends Error {
  constructor(
    message: string,
    public readonly detail?: string
  ) {
    super(message);
  }
}

// One bootstrap per sandbox — installs Chromium system deps + agent-browser +
// Chrome inside the conversation sandbox. A module-level promise guards so
// concurrent tool calls don't race the install.
const bootstrapped = new Set<string>();
let bootstrapPromise: Promise<void> | null = null;
let bootstrapSandboxName: string | null = null;

async function ensureInstalled(sandbox: Sandbox): Promise<void> {
  const name = sandbox.name;
  if (bootstrapped.has(name)) return;
  if (bootstrapPromise && bootstrapSandboxName === name) {
    await bootstrapPromise;
    return;
  }
  bootstrapSandboxName = name;
  bootstrapPromise = (async () => {
    try {
      const probe = await sandbox.runCommand(
        "agent-browser",
        ["--version"],
        { timeoutMs: 30_000 }
      );
      if (probe.exitCode === 0) {
        bootstrapped.add(name);
        return;
      }
    } catch {
      // Not installed yet — fall through to the full install.
    }
    try {
      // The helper's session type declares `args: readonly string[]` while
      // @vercel/sandbox uses `string[]`; the runtime contract is identical.
      const results = await installAgentBrowserInVercelSandbox(
        sandbox as unknown as Parameters<typeof installAgentBrowserInVercelSandbox>[0]
      );
      for (const result of results) {
        if (result.exitCode !== 0) {
          throw new Error(result.stderr.slice(0, 2000) || result.command);
        }
      }
    } catch (err) {
      bootstrapPromise = null;
      bootstrapSandboxName = null;
      throw new BrowserError(
        "Failed to set up the browser in the sandbox",
        err instanceof Error ? err.message : String(err)
      );
    }
    bootstrapped.add(name);
  })();
  await bootstrapPromise;
}

export interface BrowserCommandOutput {
  ok: boolean;
  output: string;
}

export async function browserRun(
  sandbox: Sandbox,
  args: readonly string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<BrowserCommandOutput> {
  await ensureInstalled(sandbox);
  const argv = buildAgentBrowserArgv(args, { json: true });
  try {
    const result = await sandbox.runCommand("agent-browser", argv, {
      timeoutMs,
    });
    const stdout = await result.stdout();
    const stderr = await result.stderr();
    throwIfCommandFailed(
      createAgentBrowserCommandResult({
        command: ["agent-browser", ...args].join(" "),
        exitCode: result.exitCode,
        stdout,
        stderr,
      })
    );
    return {
      ok: true,
      output: (stdout.trim() || stderr.trim() || "(no output)").slice(
        0,
        MAX_OUTPUT_CHARS
      ),
    };
  } catch (err) {
    if (err instanceof AgentBrowserCommandError) {
      return {
        ok: false,
        output: (
          err.stderr.trim() ||
          err.stdout.trim() ||
          err.message
        ).slice(0, MAX_OUTPUT_CHARS),
      };
    }
    throw new BrowserError(
      "Browser command failed",
      err instanceof Error ? err.message : String(err)
    );
  }
}
