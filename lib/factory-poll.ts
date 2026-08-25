import { pool } from "./db";
import {
  getInstallationTokenForUser,
  listOpenIssues,
  listOpenFactoryPullRequests,
} from "./github";

// Factory polling (ADR-0022). A pure, testable poll pass shared by the
// worker loop and the /api/cron/factory-poll route. Never webhooks.

export type PollResult = {
  factoryId: string;
  repoFullName: string;
  createdRuns: number;
  skippedOpenPrIssues: number;
  error?: string;
};

export async function pollOnce(): Promise<PollResult[]> {
  const { rows } = await pool.query(
    `SELECT id, "userId", "repoFullName", "labelFilter"
     FROM factories WHERE status = 'active'
     ORDER BY "createdAt" ASC`
  );

  const results: PollResult[] = [];
  for (const row of rows) {
    results.push(await pollFactory(row));
  }
  return results;
}

export async function pollFactory(factory: {
  id: string;
  userId: string;
  repoFullName: string;
  labelFilter: unknown;
}): Promise<PollResult> {
  const result: PollResult = {
    factoryId: factory.id,
    repoFullName: factory.repoFullName,
    createdRuns: 0,
    skippedOpenPrIssues: 0,
  };

  let token: string;
  try {
    token = await getInstallationTokenForUser(factory.userId);
  } catch (error) {
    result.error = `token unavailable: ${error instanceof Error ? error.message : error}`;
    return result;
  }

  let issues;
  try {
    issues = await listOpenIssues(token, factory.repoFullName);
  } catch (error) {
    result.error = `list issues failed: ${error instanceof Error ? error.message : error}`;
    return result;
  }

  // Issues that already have an open factory PR are never re-run.
  let openPrByIssue: Map<
    number,
    { prNumber: number; prUrl: string; branch: string }
  >;
  try {
    openPrByIssue = await listOpenFactoryPullRequests(
      token,
      factory.repoFullName
    );
  } catch (error) {
    result.error = `list pulls failed: ${error instanceof Error ? error.message : error}`;
    return result;
  }

  const labelFilter = Array.isArray(factory.labelFilter)
    ? factory.labelFilter.map(String)
    : [];

  for (const issue of issues) {
    if (
      labelFilter.length > 0 &&
      !issue.labels.some((l) => labelFilter.includes(l))
    ) {
      continue;
    }
    if (openPrByIssue.has(issue.number)) {
      result.skippedOpenPrIssues += 1;
      continue;
    }

    const insert = await pool.query(
      `INSERT INTO factory_runs
         ("factoryId", "issueNumber", "issueTitle", "issueUrl")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("factoryId", "issueNumber") DO NOTHING
       RETURNING id`,
      [factory.id, issue.number, issue.title, issue.htmlUrl]
    );
    if ((insert.rowCount ?? 0) > 0) {
      result.createdRuns += 1;
      console.log(
        `[factory] queued run for ${factory.repoFullName}#${issue.number}`
      );
    }
  }

  return result;
}
