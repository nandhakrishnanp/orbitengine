import { pool } from "./db";

// Factory domain layer (docs/factory.md). CRUD over factories and their runs;
// ownership is enforced by every query taking userId.

export type Factory = {
  id: string;
  userId: string;
  repoFullName: string;
  labelFilter: string[];
  provider: string | null;
  model: string | null;
  mode: string;
  checkCommand: string | null;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

export type FactoryRun = {
  id: string;
  factoryId: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  type: string | null;
  state:
    | "queued"
    | "classifying"
    | "reproducing"
    | "fixing"
    | "checking"
    | "pr_opened"
    | "failed"
    | "cancelled";
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  error: string | null;
  sandboxId: string | null;
  traceRunId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FactoryRunStep = {
  id: string;
  runId: string;
  seq: number;
  step: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  verdict: Record<string, unknown> | null;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
};

function rowToFactory(row: Record<string, unknown>): Factory {
  return {
    ...(row as unknown as Factory),
    labelFilter: Array.isArray(row.labelFilter)
      ? row.labelFilter.map(String)
      : [],
  };
}

export async function createFactory(input: {
  userId: string;
  repoFullName: string;
  labelFilter?: string[];
  provider?: string | null;
  model?: string | null;
  mode?: string;
  checkCommand?: string | null;
}): Promise<Factory> {
  const { rows } = await pool.query(
    `INSERT INTO factories
       ("userId", "repoFullName", "labelFilter", provider, model, mode, "checkCommand")
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.userId,
      input.repoFullName,
      JSON.stringify(input.labelFilter ?? []),
      input.provider ?? null,
      input.model ?? null,
      input.mode ?? "build",
      input.checkCommand ?? null,
    ]
  );
  return rowToFactory(rows[0]);
}

export async function listFactories(userId: string): Promise<Factory[]> {
  const { rows } = await pool.query(
    `SELECT * FROM factories WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    [userId]
  );
  return rows.map(rowToFactory);
}

export async function getFactory(
  id: string,
  userId: string
): Promise<Factory | null> {
  const { rows } = await pool.query(
    `SELECT * FROM factories WHERE id = $1 AND "userId" = $2`,
    [id, userId]
  );
  return rows[0] ? rowToFactory(rows[0]) : null;
}

export async function updateFactory(
  id: string,
  userId: string,
  patch: {
    labelFilter?: string[];
    provider?: string | null;
    model?: string | null;
    mode?: string;
    checkCommand?: string | null;
    status?: "active" | "paused";
  }
): Promise<Factory | null> {
  const sets: string[] = [];
  const values: unknown[] = [id, userId];
  if (patch.labelFilter !== undefined) {
    values.push(JSON.stringify(patch.labelFilter));
    sets.push(`"labelFilter" = $${values.length}::jsonb`);
  }
  if (patch.provider !== undefined) {
    values.push(patch.provider);
    sets.push(`provider = $${values.length}`);
  }
  if (patch.model !== undefined) {
    values.push(patch.model);
    sets.push(`model = $${values.length}`);
  }
  if (patch.mode !== undefined) {
    values.push(patch.mode);
    sets.push(`mode = $${values.length}`);
  }
  if (patch.checkCommand !== undefined) {
    values.push(patch.checkCommand);
    sets.push(`"checkCommand" = $${values.length}`);
  }
  if (patch.status !== undefined) {
    values.push(patch.status);
    sets.push(`status = $${values.length}`);
  }
  if (sets.length === 0) return getFactory(id, userId);

  const { rows } = await pool.query(
    `UPDATE factories SET ${sets.join(", ")}, "updatedAt" = now()
     WHERE id = $1 AND "userId" = $2 RETURNING *`,
    values
  );
  return rows[0] ? rowToFactory(rows[0]) : null;
}

export async function deleteFactory(id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM factories WHERE id = $1 AND "userId" = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

function rowToRun(row: Record<string, unknown>): FactoryRun {
  return row as unknown as FactoryRun;
}

export async function listRuns(
  factoryId: string,
  userId: string
): Promise<FactoryRun[]> {
  const { rows } = await pool.query(
    `SELECT r.* FROM factory_runs r
     JOIN factories f ON f.id = r."factoryId"
     WHERE r."factoryId" = $1 AND f."userId" = $2
     ORDER BY r."createdAt" DESC`,
    [factoryId, userId]
  );
  return rows.map(rowToRun);
}

export async function getRun(
  runId: string,
  userId: string
): Promise<FactoryRun | null> {
  const { rows } = await pool.query(
    `SELECT r.* FROM factory_runs r
     JOIN factories f ON f.id = r."factoryId"
     WHERE r.id = $1 AND f."userId" = $2`,
    [runId, userId]
  );
  return rows[0] ? rowToRun(rows[0]) : null;
}

export async function listRunSteps(runId: string): Promise<FactoryRunStep[]> {
  const { rows } = await pool.query(
    `SELECT * FROM factory_run_steps WHERE "runId" = $1 ORDER BY seq`,
    [runId]
  );
  return rows as unknown as FactoryRunStep[];
}

// Re-run a failed run: reset it to queued and drop its step graph so the
// executor starts clean. Dedupe is preserved (same row, same issue).
export async function rerunRun(
  runId: string,
  userId: string
): Promise<FactoryRun | null> {
  const { rows } = await pool.query(
    `UPDATE factory_runs r SET
       state = 'queued', error = NULL, type = NULL, branch = NULL,
       "prNumber" = NULL, "prUrl" = NULL, "traceRunId" = NULL,
       "startedAt" = NULL, "finishedAt" = NULL, "updatedAt" = now()
     FROM factories f
     WHERE r.id = $1 AND r."factoryId" = f.id AND f."userId" = $2
       AND r.state = 'failed'
     RETURNING r.*`,
    [runId, userId]
  );
  if (rows.length === 0) return null;
  await pool.query(`DELETE FROM factory_run_steps WHERE "runId" = $1`, [runId]);
  return rows[0] as unknown as FactoryRun;
}

export async function cancelRun(
  runId: string,
  userId: string
): Promise<FactoryRun | null> {
  const { rows } = await pool.query(
    `UPDATE factory_runs r SET state = 'cancelled', "updatedAt" = now()
     FROM factories f
     WHERE r.id = $1 AND r."factoryId" = f.id AND f."userId" = $2
       AND r.state = 'queued'
     RETURNING r.*`,
    [runId, userId]
  );
  return rows[0] ? (rows[0] as unknown as FactoryRun) : null;
}
