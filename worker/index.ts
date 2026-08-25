import { pool } from "@/lib/db";
import { pollOnce } from "@/lib/factory-poll";
import {
  advanceRun,
  claimNextRun,
  getActiveRun,
} from "@/lib/factory-run";

// Factory worker (docs/factory.md §3). A long-lived Node process that owns
// the poll + execute loop. Postgres is the queue; WORKER_CONCURRENCY=1 for
// now — the atomic claim keeps extra workers safe later.

const POLL_INTERVAL_MS = Number(
  process.env.FACTORY_POLL_INTERVAL_MS ?? 10 * 60 * 1000
);
const TICK_MS = Number(process.env.FACTORY_TICK_MS ?? 5000);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logQueueDepth(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT state, count(*)::int AS n FROM factory_runs GROUP BY state`
  );
  if (rows.length > 0) {
    console.log(
      "[worker] queue:",
      rows.map((r) => `${r.state}=${r.n}`).join(" ")
    );
  }
}

async function main() {
  console.log(
    `[worker] started pollEvery=${POLL_INTERVAL_MS}ms tick=${TICK_MS}ms concurrency=1`
  );

  let lastPoll = 0;

  while (true) {
    try {
      if (Date.now() - lastPoll >= POLL_INTERVAL_MS) {
        lastPoll = Date.now();
        const results = await pollOnce();
        for (const r of results) {
          if (r.error) {
            console.error(
              `[worker] poll ${r.repoFullName} failed: ${r.error}`
            );
          } else {
            console.log(
              `[worker] poll ${r.repoFullName}: created=${r.createdRuns} skippedOpenPr=${r.skippedOpenPrIssues}`
            );
          }
        }
        await logQueueDepth();
      }

      // Resume an orphaned active run (worker crash mid-step) before
      // claiming anything new — one run at a time.
      const claimed =
        (await getActiveRun()) ??
        (await claimNextRun().then((c) => {
          if (c) {
            console.log(
              `[worker] claimed run ${c.run.id} (${c.factory.repoFullName}#${c.run.issueNumber})`
            );
          }
          return c;
        }));
      if (claimed) {
        console.log(
          `[worker] advancing run ${claimed.run.id} (${claimed.factory.repoFullName}#${claimed.run.issueNumber}) state=${claimed.run.state}`
        );
        await advanceRun(claimed);
      }
    } catch (error) {
      console.error("[worker] loop error:", error);
    }
    await sleep(TICK_MS);
  }
}

main().catch((error) => {
  console.error("[worker] fatal:", error);
  process.exit(1);
});
