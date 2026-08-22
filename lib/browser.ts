import {
  AgentBrowserCommandError,
  buildAgentBrowserArgv,
  createAgentBrowserCommandResult,
  DEFAULT_AGENT_BROWSER_INSTALL_SPEC,
  throwIfCommandFailed,
} from "@agent-browser/sandbox";
import { CHROMIUM_SYSTEM_DEPS } from "@agent-browser/sandbox/vercel";
import type { Sandbox } from "@vercel/sandbox";

const DEFAULT_TIMEOUT_MS = 120_000;
const INSTALL_STEP_TIMEOUT_MS = 5 * 60 * 1000;
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

interface StepResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runStep(
  sandbox: Sandbox,
  command: string,
  args: readonly string[],
  label: string,
  timeoutMs: number
): Promise<StepResult> {
  console.log(`[browser] ${label}: running…`);
  const result = await sandbox.runCommand(command, args as string[], {
    timeoutMs,
  });
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  if (result.exitCode !== 0) {
    console.error(
      `[browser] ${label}: FAILED (exit ${result.exitCode})\n` +
        `stdout: ${stdout.slice(0, 2000)}\n` +
        `stderr: ${stderr.slice(0, 2000)}`
    );
  } else {
    console.log(`[browser] ${label}: ok`);
  }
  return { exitCode: result.exitCode, stdout, stderr };
}

async function installInto(sandbox: Sandbox): Promise<void> {
  const deps = CHROMIUM_SYSTEM_DEPS.join(" ");

  const steps: { label: string; command: string; args: string[] }[] = [
    {
      label: "installing Chromium system libraries",
      command: "sh",
      args: [
        "-c",
        `sudo dnf install -y --skip-broken -- ${deps} && sudo ldconfig`,
      ],
    },
    {
      label: "installing agent-browser CLI",
      command: "npm",
      args: ["install", "-g", DEFAULT_AGENT_BROWSER_INSTALL_SPEC],
    },
    {
      label: "downloading headless Chromium",
      command: "agent-browser",
      args: ["install"],
    },
  ];

  for (const step of steps) {
    const result = await runStep(
      sandbox,
      step.command,
      step.args,
      step.label,
      INSTALL_STEP_TIMEOUT_MS
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `${step.label} failed (exit ${result.exitCode}): ${
          result.stderr.trim().slice(0, 500) || "no stderr"
        }`
      );
    }
  }
}

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
        console.log("[browser] agent-browser already installed");
        bootstrapped.add(name);
        return;
      }
      console.log(
        `[browser] agent-browser not found (exit ${probe.exitCode}) — starting bootstrap`
      );
    } catch (err) {
      console.log(
        "[browser] agent-browser probe threw — starting bootstrap:",
        err instanceof Error ? err.message : err
      );
    }
    try {
      await installInto(sandbox);
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

// Cheap probe: is there a live browser session in this sandbox?
export async function browserSessionActive(sandbox: Sandbox): Promise<boolean> {
  try {
    await ensureInstalled(sandbox);
  } catch {
    return false;
  }
  try {
    const argv = buildAgentBrowserArgv(["get", "url"], { json: true });
    const result = await sandbox.runCommand("agent-browser", argv, {
      timeoutMs: 10_000,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

// Start a session on demand (the "Start session" button) so the preview has
// something to show before the engine browses.
export async function browserStartSession(
  sandbox: Sandbox
): Promise<{ ok: boolean; error?: string }> {
  const result = await browserRun(sandbox, ["open", "about:blank"]);
  return { ok: result.ok, error: result.ok ? undefined : result.output };
}

export async function browserRun(
  sandbox: Sandbox,
  args: readonly string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<BrowserCommandOutput> {
  // Bootstrap failures are reported as normal tool output (visible in chat)
  // instead of throwing, so the model — and you — can see the reason.
  try {
    await ensureInstalled(sandbox);
  } catch (err) {
    const detail =
      err instanceof BrowserError && err.detail ? ` — ${err.detail}` : "";
    const message =
      err instanceof Error ? err.message : "Browser bootstrap failed";
    return { ok: false, output: `${message}${detail}` };
  }
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
