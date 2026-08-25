import { generateText, type ToolSet } from "ai";
import { Sandbox } from "@vercel/sandbox";
import { pool } from "./db";
import { engineTools } from "./engine";
import { resolveModel } from "./model-resolver";
import { provisionFactorySandbox } from "./sandbox";
import {
  getInstallationTokenForUser,
  getRepoDefaultBranch,
  createPullRequest,
  createIssueComment,
  listIssueComments,
} from "./github";
import { startTraceRun, finishTraceRun } from "./traces";

// Factory run engine (docs/factory.md §3, ADR-0024). The worker claims one
// queued run at a time and advances it by exactly ONE step per iteration:
// each step is a bounded agent call with a narrow toolset and a structured
// verdict persisted to factory_run_steps before the next step starts.

const RUN_TIMEOUT_MS = 20 * 60 * 1000;
const STEP_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_REVISIONS = 2;
const COMMENT_MARKER = "<!-- orbitengine-factory -->";

export type ClaimedRun = {
  run: {
    id: string;
    factoryId: string;
    issueNumber: number;
    issueTitle: string;
    issueUrl: string;
    type: string | null;
    state: string;
    branch: string | null;
    error: string | null;
    sandboxId: string | null;
    traceRunId: string | null;
    startedAt: string | null;
  };
  factory: {
    id: string;
    userId: string;
    repoFullName: string;
    provider: string | null;
    model: string | null;
    mode: string;
    checkCommand: string | null;
  };
};

// Atomic claim: oldest queued run of an active factory. FOR UPDATE SKIP
// LOCKED keeps this safe if a second worker is ever added.
export async function claimNextRun(): Promise<ClaimedRun | null> {
  const { rows } = await pool.query(
    `WITH claimed AS (
       UPDATE factory_runs r SET
         state = 'classifying', "startedAt" = now(), "updatedAt" = now()
       WHERE r.id = (
         SELECT r2.id FROM factory_runs r2
         JOIN factories f ON f.id = r2."factoryId"
         WHERE r2.state = 'queued' AND f.status = 'active'
         ORDER BY r2."createdAt" ASC
         LIMIT 1
         FOR UPDATE OF r2 SKIP LOCKED
       )
       RETURNING r.*
     )
     SELECT c.id, c."factoryId", c."issueNumber", c."issueTitle",
            c."issueUrl", c.type, c.state, c.branch, c.error,
            c."sandboxId", c."traceRunId", c."startedAt",
            f."userId", f."repoFullName", f.provider, f.model, f.mode,
            f."checkCommand"
     FROM claimed c
     JOIN factories f ON f.id = c."factoryId"`
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    run: {
      id: row.id,
      factoryId: row.factoryId,
      issueNumber: row.issueNumber,
      issueTitle: row.issueTitle,
      issueUrl: row.issueUrl,
      type: row.type,
      state: row.state,
      branch: row.branch,
      error: row.error,
      sandboxId: row.sandboxId,
      traceRunId: row.traceRunId,
      startedAt: row.startedAt,
    },
    factory: {
      id: row.factoryId,
      userId: row.userId,
      repoFullName: row.repoFullName,
      provider: row.provider,
      model: row.model,
      mode: row.mode,
      checkCommand: row.checkCommand,
    },
  };
}

// Resume an orphaned run: one stuck in an active state from a previous
// worker's lifetime. advanceRun is state-driven, so it continues cleanly.
export async function getActiveRun(): Promise<ClaimedRun | null> {
  const { rows } = await pool.query(
    `SELECT r.id, r."factoryId", r."issueNumber", r."issueTitle",
            r."issueUrl", r.type, r.state, r.branch, r.error,
            r."sandboxId", r."traceRunId", r."startedAt",
            f."userId", f."repoFullName", f.provider, f.model, f.mode,
            f."checkCommand"
     FROM factory_runs r
     JOIN factories f ON f.id = r."factoryId"
     WHERE r.state IN ('classifying', 'reproducing', 'fixing')
     ORDER BY r."updatedAt" ASC
     LIMIT 1`
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    run: {
      id: row.id,
      factoryId: row.factoryId,
      issueNumber: row.issueNumber,
      issueTitle: row.issueTitle,
      issueUrl: row.issueUrl,
      type: row.type,
      state: row.state,
      branch: row.branch,
      error: row.error,
      sandboxId: row.sandboxId,
      traceRunId: row.traceRunId,
      startedAt: row.startedAt,
    },
    factory: {
      id: row.factoryId,
      userId: row.userId,
      repoFullName: row.repoFullName,
      provider: row.provider,
      model: row.model,
      mode: row.mode,
      checkCommand: row.checkCommand,
    },
  };
}

// ---------------------------------------------------------------------------
// small persistence helpers

async function setState(
  runId: string,
  state: string,
  extra?: { type?: string; branch?: string; error?: string | null }
): Promise<void> {
  const sets = [`state = $2`, `"updatedAt" = now()`];
  const values: unknown[] = [runId, state];
  if (extra?.type !== undefined) {
    values.push(extra.type);
    sets.push(`type = $${values.length}`);
  }
  if (extra?.branch !== undefined) {
    values.push(extra.branch);
    sets.push(`branch = $${values.length}`);
  }
  if (extra?.error !== undefined) {
    values.push(extra.error);
    sets.push(`error = $${values.length}`);
  }
  await pool.query(
    `UPDATE factory_runs SET ${sets.join(", ")} WHERE id = $1`,
    values
  );
}

async function insertStep(
  runId: string,
  step: string,
  status: string,
  verdict: Record<string, unknown> | null
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM factory_run_steps WHERE "runId" = $1`,
    [runId]
  );
  const seq = rows[0].n;
  await pool.query(
    `INSERT INTO factory_run_steps
       ("runId", seq, step, status, verdict, attempts, "startedAt", "finishedAt")
     VALUES ($1, $2, $3, $4, $5::jsonb, 1, now(), now())`,
    [runId, seq, step, status, verdict ? JSON.stringify(verdict) : null]
  );
}

async function recordTraceSpan(
  traceRunId: string | null,
  step: string,
  durationMs: number,
  output: unknown
): Promise<void> {
  if (!traceRunId) return;
  try {
    await pool.query(
      `INSERT INTO trace_spans
         ("runId", seq, tool, phase, "startedAt", "durationMs", output)
       SELECT $1, count(*)::int, $2, $3, now() - ($4::int * interval '1 millisecond'), $4::int, $5::jsonb
       FROM trace_spans WHERE "runId" = $1`,
      [traceRunId, step, `factory:${step}`, Math.round(durationMs), JSON.stringify(output ?? null)]
    );
  } catch (error) {
    console.error("[factory] trace span failed:", error);
  }
}

// ---------------------------------------------------------------------------
// workspace helpers (shared factory sandbox — docs/factory.md §3)

async function getSandbox(sandboxName: string): Promise<Sandbox> {
  return Sandbox.get({ name: sandboxName });
}

async function runCmd(
  sandbox: Sandbox,
  command: string,
  timeoutMs = 120_000
): Promise<{ exitCode: number; output: string }> {
  const result = await sandbox.runCommand("bash", ["-c", command], {
    timeoutMs,
  });
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  return {
    exitCode: result.exitCode,
    output: `${stdout}\n${stderr}`.trim().slice(0, 20_000),
  };
}

async function ensureWorkspace(
  sandbox: Sandbox,
  runId: string,
  repoFullName: string
): Promise<string> {
  const dir = `${sandbox.cwd}/runs/${runId}`;
  await runCmd(sandbox, `rm -rf ${dir} && mkdir -p ${dir}`);
  const clone = await runCmd(
    sandbox,
    `git clone --depth 50 https://x-access-token:$GITHUB_TOKEN@github.com/${repoFullName}.git ${dir}`,
    300_000
  );
  if (clone.exitCode !== 0) {
    throw new Error(`clone failed: ${clone.output}`);
  }
  return dir;
}

async function wipeWorkspace(sandbox: Sandbox, runId: string): Promise<void> {
  try {
    await runCmd(sandbox, `rm -rf ${sandbox.cwd}/runs/${runId}`);
  } catch {
    // Best-effort; the directory is wiped again on the next run anyway.
  }
}

// ---------------------------------------------------------------------------
// agent step helper

function extractJson(text: string): Record<string, unknown> | null {
  const matches = text.match(/\{[\s\S]*\}/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(matches[i]) as Record<string, unknown>;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function runAgent(input: {
  ctx: ClaimedRun;
  system: string;
  prompt: string;
  tools: ToolSet;
  maxSteps: number;
}): Promise<{ text: string; durationMs: number }> {
  const resolved = await resolveModel(input.ctx.factory.userId, {
    provider: input.ctx.factory.provider,
    model: input.ctx.factory.model,
  });
  if (!resolved) {
    throw new Error(
      `No API key configured for provider "${input.ctx.factory.provider ?? "opencode-go"}"`
    );
  }
  const started = Date.now();
  const result = await generateText({
    model: resolved.model,
    system: input.system,
    prompt: input.prompt,
    tools: input.tools,
    maxRetries: resolved.loop.maxRetries,
    stopWhen: ({ steps }) => steps.length >= input.maxSteps,
    abortSignal: AbortSignal.timeout(STEP_TIMEOUT_MS),
    onStepFinish: ({ text, toolCalls, finishReason }) => {
      console.log(
        `[factory] run ${input.ctx.run.id} step=${toolCalls?.map((tc) => tc.toolName).join(",") || "(text)"} finish=${finishReason}`
      );
      if (text) console.log(`[factory] run ${input.ctx.run.id} » ${text.slice(0, 150)}`);
    },
  });
  return { text: result.text, durationMs: Date.now() - started };
}

function gate(all: ToolSet, names: string[]): ToolSet {
  return Object.fromEntries(
    Object.entries(all).filter(([name]) => names.includes(name))
  );
}

const READ_TOOLS = ["read_file", "list_files"];
const REPRODUCE_TOOLS = [
  "run_command",
  "read_file",
  "list_files",
  "browser_open",
  "browser_snapshot",
  "browser_click",
  "browser_fill",
  "browser_press",
  "browser_verify",
  "browser_close",
];
const FIX_TOOLS = ["run_command", "read_file", "write_file", "list_files"];

// ---------------------------------------------------------------------------
// terminal path

async function failRun(
  ctx: ClaimedRun,
  sandboxName: string | null,
  error: string,
  comment?: string
): Promise<void> {
  console.error(`[factory] run ${ctx.run.id} failed: ${error}`);
  await setState(ctx.run.id, "failed", { error });
  await insertStep(ctx.run.id, "failed", "failed", { error });
  await finishTraceRunSafe(ctx, "failed");

  if (comment) await commentOnIssueOnce(ctx, comment);

  if (sandboxName) {
    try {
      const sandbox = await getSandbox(sandboxName);
      await wipeWorkspace(sandbox, ctx.run.id);
    } catch {
      // sandbox already gone — nothing to clean
    }
  }
  await pool.query(
    `UPDATE factory_runs SET "finishedAt" = now() WHERE id = $1`,
    [ctx.run.id]
  );
}

async function finishTraceRunSafe(
  ctx: ClaimedRun,
  status: string
): Promise<void> {
  if (!ctx.run.traceRunId) return;
  try {
    await finishTraceRun(ctx.run.traceRunId, {
      stepCount: 0,
      totalMs: ctx.run.startedAt
        ? Date.now() - new Date(ctx.run.startedAt).getTime()
        : 0,
      status,
    });
  } catch (error) {
    console.error("[factory] trace finish failed:", error);
  }
}

async function commentOnIssueOnce(
  ctx: ClaimedRun,
  body: string
): Promise<void> {
  try {
    const token = await getInstallationTokenForUser(ctx.factory.userId);
    const comments = await listIssueComments(
      token,
      ctx.factory.repoFullName,
      ctx.run.issueNumber
    );
    if (comments.some((c) => c.body.includes(COMMENT_MARKER))) return;
    await createIssueComment(token, ctx.factory.repoFullName, ctx.run.issueNumber, `${COMMENT_MARKER}\n${body}`);
  } catch (error) {
    console.error("[factory] issue comment failed:", error);
  }
}

// ---------------------------------------------------------------------------
// the step executor

export async function advanceRun(ctx: ClaimedRun): Promise<boolean> {
  // Wall-clock cap, checked between steps.
  if (
    ctx.run.startedAt &&
    Date.now() - new Date(ctx.run.startedAt).getTime() > RUN_TIMEOUT_MS
  ) {
    await failRun(ctx, ctx.run.sandboxId, "Run exceeded the 20 minute cap");
    return true;
  }

  try {
    switch (ctx.run.state) {
      case "classifying":
        return await stepClassify(ctx);
      case "reproducing":
        return await stepReproduce(ctx);
      case "fixing":
        return await stepFix(ctx);
      case "pr_opened":
      case "failed":
      case "cancelled":
        return false;
      default:
        await failRun(ctx, ctx.run.sandboxId, `Unknown state ${ctx.run.state}`);
        return true;
    }
  } catch (error) {
    await failRun(
      ctx,
      ctx.run.sandboxId,
      error instanceof Error ? error.message : String(error)
    );
    return true;
  }
}

// --- classify ---------------------------------------------------------------

async function stepClassify(ctx: ClaimedRun): Promise<boolean> {
  const resolved = await resolveModel(ctx.factory.userId, {
    provider: ctx.factory.provider,
    model: ctx.factory.model,
  });
  if (!resolved) {
    await failRun(ctx, null, "No API key configured for factory runs");
    return true;
  }

  const traceRunId = await startTraceRun({
    conversationId: null,
    factoryRunId: ctx.run.id,
    provider: resolved.providerId,
    model: resolved.modelId,
    mode: ctx.factory.mode,
    skills: [],
  });
  await pool.query(`UPDATE factory_runs SET "traceRunId" = $2 WHERE id = $1`, [
    ctx.run.id,
    traceRunId,
  ]);
  ctx.run.traceRunId = traceRunId;

  const started = Date.now();
  const { text } = await runAgent({
    ctx,
    system:
      "You classify GitHub issues for an automated fixing pipeline. " +
      "Reply with ONLY a JSON object: {\"type\": \"bug\"|\"feature\"|\"docs\", \"reason\": \"...\"}. " +
      "bug = something is broken or behaves incorrectly; feature = new functionality is requested; docs = documentation-only change.",
    prompt: `Issue #${ctx.run.issueNumber}: ${ctx.run.issueTitle}`,
    tools: {},
    maxSteps: 1,
  });
  const verdict = extractJson(text) ?? { type: "bug", reason: "unparsable, defaulted to bug" };
  const type = ["bug", "feature", "docs"].includes(String(verdict.type))
    ? String(verdict.type)
    : "bug";

  await insertStep(ctx.run.id, "identify_type", "passed", verdict);
  await recordTraceSpan(traceRunId, "identify_type", Date.now() - started, verdict);
  console.log(`[factory] run ${ctx.run.id} classified as ${type}`);

  if (type === "feature") {
    // Feature pipeline lands in a later phase (docs/factory.md §7).
    await failRun(
      ctx,
      null,
      `Pipeline for "${type}" issues is not implemented yet`,
      `The factory currently handles **bug** and **docs** issues automatically. This issue was classified as \`${type}\` and was not processed.`
    );
    return true;
  }

  // docs → straight to the fixing state (implement_docs → open_pr, no
  // reproduce/review loop); bug → reproducing.
  await setState(ctx.run.id, type === "docs" ? "fixing" : "reproducing", {
    type,
  });
  ctx.run.state = type === "docs" ? "fixing" : "reproducing";
  return true;
}

// --- reproduce --------------------------------------------------------------

async function stepReproduce(ctx: ClaimedRun): Promise<boolean> {
  console.log(
    `[factory] run ${ctx.run.id} provisioning factory sandbox…`
  );
  const sandboxName = await provisionFactorySandbox(ctx.factory.userId);
  ctx.run.sandboxId = sandboxName;
  await pool.query(`UPDATE factory_runs SET "sandboxId" = $2 WHERE id = $1`, [
    ctx.run.id,
    sandboxName,
  ]);

  const sandbox = await getSandbox(sandboxName);
  console.log(`[factory] run ${ctx.run.id} cloning ${ctx.factory.repoFullName}…`);
  const dir = await ensureWorkspace(sandbox, ctx.run.id, ctx.factory.repoFullName);
  console.log(`[factory] run ${ctx.run.id} cloned, starting reproduce agent…`);

  const all = engineTools(sandbox, process.env.GITHUB_TOKEN ?? "");
  const tools = gate(all, REPRODUCE_TOOLS);

  const started = Date.now();
  const { text } = await runAgent({
    ctx,
    system:
      "You reproduce GitHub issues inside an isolated sandbox with the repo checked out at the current directory. " +
      "Write and run a minimal reproduction (test, script, or browser session for UI issues) and capture the failing output as evidence. " +
      "Do NOT attempt a fix. Finish with ONLY a JSON object: {\"reproduced\": true|false, \"evidence\": \"the failing output / observed behavior\"}.",
    prompt: `Issue #${ctx.run.issueNumber}: ${ctx.run.issueTitle}\n\nThe repository is checked out at ${dir}.`,
    tools,
    maxSteps: 25,
  });
  const verdict = extractJson(text) ?? { reproduced: false, evidence: text.slice(0, 2000) };

  const reproduced = verdict.reproduced === true;
  await insertStep(ctx.run.id, "reproduce", reproduced ? "passed" : "failed", verdict);
  await recordTraceSpan(ctx.run.traceRunId, "reproduce", Date.now() - started, {
    reproduced,
  });
  console.log(`[factory] run ${ctx.run.id} reproduced=${reproduced}`);

  if (!reproduced) {
    await failRun(
      ctx,
      sandboxName,
      "Issue could not be reproduced",
      `The automated pipeline could not reproduce this issue, so no fix was attempted.\n\n**Evidence collected:**\n\n${String(verdict.evidence ?? "").slice(0, 2000)}`
    );
    return true;
  }

  await setState(ctx.run.id, "fixing");
  ctx.run.state = "fixing";
  return true;
}

// --- fix ⇄ review ------------------------------------------------------------

function branchFor(ctx: ClaimedRun): string {
  const slug =
    ctx.run.issueTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "fix";
  return `factory/issue-${ctx.run.issueNumber}-${slug}`;
}

async function stepFix(ctx: ClaimedRun): Promise<boolean> {
  // Docs pipeline: implement_docs → open_pr, no reproduce/review loop.
  if (ctx.run.type === "docs") {
    return await stepDocs(ctx);
  }

  const sandbox = await getSandbox(ctx.run.sandboxId!);
  const dir = `${sandbox.cwd}/runs/${ctx.run.id}`;
  const branch = ctx.run.branch ?? branchFor(ctx);
  if (!ctx.run.branch) {
    await setState(ctx.run.id, "fixing", { branch });
    ctx.run.branch = branch;
  }

  const { rows } = await pool.query(
    `SELECT step, status, verdict FROM factory_run_steps
     WHERE "runId" = $1 ORDER BY seq DESC LIMIT 1`,
    [ctx.run.id]
  );
  const last = rows[0];

  // Review said "revise" → run create_fix again with the feedback. Anything
  // else (fresh run, post-reproduce) starts with create_fix.
  const needsReview = last?.step === "create_fix" && last?.status === "passed";
  if (needsReview) {
    await stepReview(ctx, sandbox, dir);
    return true;
  }

  await stepCreateFix(ctx, sandbox, dir, branch);
  return true;
}

async function stepCreateFix(
  ctx: ClaimedRun,
  sandbox: Sandbox,
  dir: string,
  branch: string
): Promise<void> {
  const all = engineTools(sandbox, process.env.GITHUB_TOKEN ?? "");
  const tools = gate(all, FIX_TOOLS);

  const checkCommand =
    ctx.factory.checkCommand ?? (await detectCheckCommand(sandbox, dir));

  // Carry review feedback from a rejected previous review, if any.
  const { rows } = await pool.query(
    `SELECT verdict FROM factory_run_steps
     WHERE "runId" = $1 AND step = 'review_fix' ORDER BY seq DESC LIMIT 1`,
    [ctx.run.id]
  );
  const reviewFeedback = rows[0]?.verdict ? String((rows[0].verdict as Record<string, unknown>).reasons ?? "") : "";

  const started = Date.now();
  const { text } = await runAgent({
    ctx,
    system:
      "You fix a reproduced GitHub issue in a git checkout of the repository. " +
      `Work in ${dir}. Steps:\n` +
      `1. git checkout -b ${branch} (or switch to it if it exists)\n` +
      "2. Implement the minimal fix addressing the reproduction.\n" +
      `3. Run the checks: ${checkCommand ?? "(no check command detected — verify with a build/typecheck if possible)"}\n` +
      "4. git add -A && git commit, then git push -u origin " + branch + "\n" +
      "Finish with ONLY a JSON object: {\"fixed\": true|false, \"checksPassed\": true|false, \"summary\": \"what changed and why\", \"checksOutput\": \"tail of check output\"}.",
    prompt:
      `Issue #${ctx.run.issueNumber}: ${ctx.run.issueTitle}\n\n` +
      (reviewFeedback ? `A reviewer rejected a previous attempt with this feedback — address it:\n${reviewFeedback}\n\n` : ""),
    tools,
    maxSteps: 40,
  });
  const verdict = extractJson(text) ?? { fixed: false, checksPassed: false, summary: text.slice(0, 2000) };

  const ok = verdict.fixed === true && verdict.checksPassed !== false;
  await insertStep(ctx.run.id, "create_fix", ok ? "passed" : "failed", verdict);
  await recordTraceSpan(ctx.run.traceRunId, "create_fix", Date.now() - started, {
    fixed: verdict.fixed,
    checksPassed: verdict.checksPassed,
  });
  console.log(`[factory] run ${ctx.run.id} createFix ok=${ok}`);

  if (!ok) {
    await failRun(
      ctx,
      ctx.run.sandboxId,
      "Fix did not pass checks",
      `An automated fix was attempted but did not pass checks, so no PR was opened.\n\n**Summary:** ${String(verdict.summary ?? "")}\n\n**Check output:**\n\n\`\`\`\n${String(verdict.checksOutput ?? "").slice(0, 2000)}\n\`\`\``
    );
  }
  // State stays 'fixing' — the next advanceRun iteration runs the review.
}

async function detectCheckCommand(
  sandbox: Sandbox,
  dir: string
): Promise<string | null> {
  const probe = await runCmd(
    sandbox,
    `cat ${dir}/package.json 2>/dev/null | grep -E '"(test|build)"' || true`
  );
  if (/test/.test(probe.output)) return "npm test";
  if (/build/.test(probe.output)) return "npm run build";
  return null;
}

// --- docs pipeline ------------------------------------------------------------

async function stepDocs(ctx: ClaimedRun): Promise<boolean> {
  try {
    if (!ctx.run.sandboxId) {
      console.log(`[factory] run ${ctx.run.id} provisioning factory sandbox…`);
      const sandboxName = await provisionFactorySandbox(ctx.factory.userId);
      ctx.run.sandboxId = sandboxName;
      await pool.query(
        `UPDATE factory_runs SET "sandboxId" = $2 WHERE id = $1`,
        [ctx.run.id, sandboxName]
      );
    }
    const sandbox = await getSandbox(ctx.run.sandboxId);
    console.log(
      `[factory] run ${ctx.run.id} cloning ${ctx.factory.repoFullName}…`
    );
    const dir = await ensureWorkspace(
      sandbox,
      ctx.run.id,
      ctx.factory.repoFullName
    );

    const branch = ctx.run.branch ?? branchFor(ctx);
    if (!ctx.run.branch) {
      await setState(ctx.run.id, "fixing", { branch });
      ctx.run.branch = branch;
    }

    const all = engineTools(sandbox, process.env.GITHUB_TOKEN ?? "");
    const tools = gate(all, FIX_TOOLS);

    const started = Date.now();
    const { text } = await runAgent({
      ctx,
      system:
        "You make documentation changes in a git checkout of the repository. " +
        `Work in ${dir}. The issue asks for a docs change (README, guides, API docs, comments-as-docs).\n` +
        `Steps:\n1. git checkout -b ${branch}\n` +
        "2. Make the requested documentation changes. Match the existing docs style and structure.\n" +
        "3. If the repo has a docs build (e.g. `npm run docs:*`, mkdocs, docusaurus), run it to verify.\n" +
        "4. git add -A && git commit, then git push -u origin " + branch + "\n" +
        'Finish with ONLY a JSON object: {"done": true|false, "summary": "what docs changed", "checksOutput": "docs build output if any"}.',
      prompt: `Issue #${ctx.run.issueNumber}: ${ctx.run.issueTitle}`,
      tools,
      maxSteps: 25,
    });
    const verdict = extractJson(text) ?? {
      done: false,
      summary: text.slice(0, 2000),
    };

    const ok = verdict.done === true;
    await insertStep(ctx.run.id, "implement_docs", ok ? "passed" : "failed", verdict);
    await recordTraceSpan(ctx.run.traceRunId, "implement_docs", Date.now() - started, {
      done: ok,
    });
    console.log(`[factory] run ${ctx.run.id} implementDocs ok=${ok}`);

    if (!ok) {
      await failRun(
        ctx,
        ctx.run.sandboxId,
        "Docs change could not be completed",
        `An automated docs change was attempted but did not complete, so no PR was opened.\n\n**Summary:** ${String(verdict.summary ?? "")}`
      );
      return true;
    }

    await openPullRequest(ctx, sandbox);
    return true;
  } catch (error) {
    await failRun(
      ctx,
      ctx.run.sandboxId,
      error instanceof Error ? error.message : String(error)
    );
    return true;
  }
}

async function stepReview(
  ctx: ClaimedRun,
  sandbox: Sandbox,
  dir: string
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS revisions FROM factory_run_steps
     WHERE "runId" = $1 AND step = 'review_fix'`,
    [ctx.run.id]
  );
  const revisions = rows[0].revisions;

  const all = engineTools(sandbox, process.env.GITHUB_TOKEN ?? "");
  const tools = gate(all, READ_TOOLS);

  const started = Date.now();
  const { text } = await runAgent({
    ctx,
    system:
      "You are a strict code reviewer. Inspect the changes on the factory branch " +
      `(\`git -C ${dir} log/diff\` against the default branch) and decide whether to approve.\n` +
      "Rubric — approve ONLY if ALL hold:\n" +
      "1. The diff plausibly fixes the reported issue.\n" +
      "2. It does not contain unrelated changes or debug leftovers.\n" +
      "3. Tests/checks were run and are consistent with the claim.\n" +
      "Finish with ONLY a JSON object: {\"approved\": true|false, \"reasons\": \"...\"}.",
    prompt: `Issue #${ctx.run.issueNumber}: ${ctx.run.issueTitle}`,
    tools,
    maxSteps: 15,
  });
  const verdict = extractJson(text) ?? { approved: false, reasons: text.slice(0, 2000) };
  const approved = verdict.approved === true;

  await insertStep(ctx.run.id, "review_fix", approved ? "passed" : "failed", verdict);
  await recordTraceSpan(ctx.run.traceRunId, "review_fix", Date.now() - started, {
    approved,
  });
  console.log(`[factory] run ${ctx.run.id} review approved=${approved}`);

  if (approved) {
    await openPullRequest(ctx, sandbox);
    return;
  }
  if (revisions + 1 >= MAX_REVISIONS) {
    await failRun(
      ctx,
      ctx.run.sandboxId,
      `Review rejected the fix after ${MAX_REVISIONS} revisions`,
      `An automated fix was attempted but rejected in review after ${MAX_REVISIONS} revisions.\n\n**Reviewer reasons:** ${String(verdict.reasons ?? "")}`
    );
    return;
  }
  // Loop back: the next advanceRun runs create_fix with review feedback.
  await setState(
    ctx.run.id,
    "fixing",
    { error: `revision ${revisions + 1}: review rejected, retrying` }
  );
}

async function openPullRequest(
  ctx: ClaimedRun,
  sandbox: Sandbox
): Promise<void> {
  const token = await getInstallationTokenForUser(ctx.factory.userId);
  const base = await getRepoDefaultBranch(token, ctx.factory.repoFullName);

  const { rows } = await pool.query(
    `SELECT verdict FROM factory_run_steps
     WHERE "runId" = $1 AND step IN ('create_fix', 'implement_docs')
     ORDER BY seq DESC LIMIT 1`,
    [ctx.run.id]
  );
  const summary = rows[0]?.verdict
    ? String((rows[0].verdict as Record<string, unknown>).summary ?? "")
    : "";

  const prefix = ctx.run.type === "docs" ? "Docs" : "Fix";
  const pr = await createPullRequest(token, ctx.factory.repoFullName, {
    title: `${prefix} #${ctx.run.issueNumber}: ${ctx.run.issueTitle}`,
    head: ctx.run.branch!,
    base,
    body: `Automated fix by OrbitEngine factory.\n\nCloses #${ctx.run.issueNumber}\n\n## What changed\n\n${summary}\n\n---\n\u26A0\uFE0F Review this like any other PR — it was produced autonomously.`,
  });

  await pool.query(
    `UPDATE factory_runs SET state = 'pr_opened', "prNumber" = $2, "prUrl" = $3,
       "finishedAt" = now(), "updatedAt" = now()
     WHERE id = $1`,
    [ctx.run.id, pr.number, pr.url]
  );
  await insertStep(ctx.run.id, "open_pr", "passed", {
    prNumber: pr.number,
    prUrl: pr.url,
  });
  await recordTraceSpan(ctx.run.traceRunId, "open_pr", 0, pr);
  await finishTraceRunSafe(ctx, "completed");
  await wipeWorkspace(sandbox, ctx.run.id);
  console.log(`[factory] run ${ctx.run.id} opened PR ${pr.url}`);
}
