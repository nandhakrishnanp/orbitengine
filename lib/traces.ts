import type { UIMessage, ToolUIPart } from "ai";
import { pool } from "./db";

// Observability trace store (ADR-0021). Every engine step is recorded as a
// span — tool, phase, startedAt, durationMs, input, output — with per-run
// context (model, provider, skills, step count, total time, token usage when
// the provider reports it). Written server-side by the same loop that does
// durable persistence; never throws into the engine loop.

export type TraceRun = {
  id: string;
  conversationId: string | null;
  factoryRunId: string | null;
  provider: string;
  model: string;
  mode: string | null;
  skills: string[];
  stepCount: number;
  totalMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
};

export type TraceSpan = {
  id: string;
  runId: string;
  seq: number;
  tool: string;
  phase: string;
  startedAt: string;
  durationMs: number;
  input: Record<string, unknown> | null;
  output: unknown;
};

export async function startTraceRun(run: {
  conversationId: string | null;
  factoryRunId?: string | null;
  provider: string;
  model: string;
  mode: string | null;
  skills: string[];
}): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `INSERT INTO trace_runs ("conversationId", "factoryRunId", provider, model, mode, skills)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        run.conversationId,
        run.factoryRunId ?? null,
        run.provider,
        run.model,
        run.mode,
        JSON.stringify(run.skills),
      ]
    );
    return rows[0].id as string;
  } catch (error) {
    console.error("[trace] failed to start run:", error);
    return null;
  }
}

function isToolPart(p: UIMessage["parts"][number]): p is ToolUIPart {
  return (
    p.type.startsWith("tool-") && "state" in p && p.state !== undefined
  );
}

/**
 * Records tool parts that completed since the last call. `seen` is a mutable
 * cursor owned by the caller (one Set per run); each part index is recorded
 * at most once. Returns how many spans were written.
 */
export async function recordCompletedSpans(
  runId: string,
  parts: UIMessage["parts"],
  seen: Set<number>,
  timing: { startedAt: Date; durationMs: number }
): Promise<number> {
  const pending: { index: number; part: ToolUIPart }[] = [];
  parts.forEach((p, index) => {
    if (seen.has(index) || !isToolPart(p)) return;
    seen.add(index);
    if (p.state === "output-available" || p.state === "output-error") {
      pending.push({ index, part: p });
    }
  });
  if (pending.length === 0) return 0;

  let recorded = 0;
  for (const { index, part } of pending) {
    try {
      await pool.query(
        `INSERT INTO trace_spans
           ("runId", seq, tool, phase, "startedAt", "durationMs", input, output)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
        [
          runId,
          index,
          part.type.slice("tool-".length),
          `tool:${part.type.slice("tool-".length)}`,
          timing.startedAt,
          timing.durationMs,
          JSON.stringify(("input" in part ? part.input : undefined) ?? null),
          JSON.stringify(("output" in part ? part.output : undefined) ?? null),
        ]
      );
      recorded += 1;
    } catch (error) {
      console.error("[trace] failed to record span:", error);
    }
  }
  return recorded;
}

export async function finishTraceRun(
  runId: string,
  result: {
    stepCount: number;
    totalMs: number;
    status: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
  }
): Promise<void> {
  try {
    await pool.query(
      `UPDATE trace_runs
       SET "stepCount" = $2,
           "totalMs" = $3,
           status = $4,
           "inputTokens" = $5,
           "outputTokens" = $6,
           "finishedAt" = now()
       WHERE id = $1`,
      [
        runId,
        result.stepCount,
        Math.round(result.totalMs),
        result.status,
        result.inputTokens ?? null,
        result.outputTokens ?? null,
      ]
    );
  } catch (error) {
    console.error("[trace] failed to finish run:", error);
  }
}

export async function listConversationTraces(
  conversationId: string
): Promise<(TraceRun & { spans: TraceSpan[] })[]> {
  const runsResult = await pool.query(
    `SELECT id, "conversationId", "factoryRunId", provider, model, mode, skills,
            "stepCount", "totalMs", "inputTokens", "outputTokens", status,
            "startedAt", "finishedAt"
     FROM trace_runs
     WHERE "conversationId" = $1 AND "factoryRunId" IS NULL
     ORDER BY "startedAt" DESC`,
    [conversationId]
  );
  if (runsResult.rowCount === 0) return [];

  const runIds = runsResult.rows.map((r) => r.id);
  const spansResult = await pool.query(
    `SELECT id, "runId", seq, tool, phase, "startedAt", "durationMs", input, output
     FROM trace_spans
     WHERE "runId" = ANY($1)
     ORDER BY seq`,
    [runIds]
  );

  return runsResult.rows.map((r) => ({
    ...r,
    skills: Array.isArray(r.skills) ? r.skills.map(String) : [],
    spans: spansResult.rows.filter((s) => s.runId === r.id),
  }));
}

// Factory-side traces: every engine run driven by one of the user's factories.
export async function listFactoryTraces(
  userId: string
): Promise<(TraceRun & { spans: TraceSpan[] })[]> {
  const runsResult = await pool.query(
    `SELECT t.id, t."conversationId", t."factoryRunId", t.provider, t.model,
            t.mode, t.skills, t."stepCount", t."totalMs", t."inputTokens",
            t."outputTokens", t.status, t."startedAt", t."finishedAt"
     FROM trace_runs t
     JOIN factory_runs r ON r.id = t."factoryRunId"
     JOIN factories f ON f.id = r."factoryId"
     WHERE f."userId" = $1 AND t."factoryRunId" IS NOT NULL
     ORDER BY t."startedAt" DESC
     LIMIT 100`,
    [userId]
  );
  if (runsResult.rowCount === 0) return [];

  const runIds = runsResult.rows.map((r) => r.id);
  const spansResult = await pool.query(
    `SELECT id, "runId", seq, tool, phase, "startedAt", "durationMs", input, output
     FROM trace_spans
     WHERE "runId" = ANY($1)
     ORDER BY seq`,
    [runIds]
  );

  return runsResult.rows.map((r) => ({
    ...r,
    skills: Array.isArray(r.skills) ? r.skills.map(String) : [],
    spans: spansResult.rows.filter((s) => s.runId === r.id),
  }));
}
