# Software Factory — Architecture

> Status: **bug + docs pipelines implemented** (T11/T12/T13). Feature pipeline
> pending. Decisions: ADR-0022 (polled, per-issue autonomous fixes), ADR-0024
> (step-graph orchestration).

The factory watches a repository's open issues and turns each one into an
autonomous **run**: classify → pipeline of discrete agent steps in an isolated
sandbox → PR (or a failure report on the issue). It is polled — never
webhook-driven — and the PR is the human review gate.

```
┌──────────────────────────────┐         ┌──────────────────────────────────┐
│   Next.js app  (port 3001)   │         │   worker/  (Node process, tsx)   │
│                              │         │                                  │
│  Factory CRUD API            │         │  loop:                           │
│  Ops dashboard (/factory)    │         │    1. pollOnce()                 │
│  /api/cron/factory-poll      │◄───────►│    2. claimNextRun()  (atomic)   │
│    (prod cron entry point)   │ Postgres│    3. advanceRun(run)            │
│  Re-run / cancel actions     │  = the  │       (one step per iteration)   │
│                              │  queue  │                                  │
└──────────────────────────────┘         └──────────────────────────────────┘
        │                    ▲                        │
        │ list repos         │ trace spans            │ engine tools
        ▼                    │                        ▼
   GitHub App API        trace_runs/            Vercel Sandbox
   (issues, PRs,         trace_spans            (one microVM per run,
    comments)                                   GITHUB_TOKEN injected)
```

Two processes, one repo, one database. **Postgres is the queue** — dedupe via
`UNIQUE` constraints, claiming via atomic `UPDATE ... RETURNING`. No broker,
no webhooks. `WORKER_CONCURRENCY=1` (sequential queue) to start; the claim is
written so a second worker is safe later.

---

## 1. Data model

### `factories` — per-repo configuration

| column | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `userId` | FK → users, CASCADE | ownership |
| `repoFullName` | TEXT | `owner/repo` |
| `labelFilter` | JSONB `[]` | include-list of issue labels |
| `provider`, `model` | TEXT nullable | run defaults; fall back to user settings |
| `mode` | TEXT default `'build'` | |
| `checkCommand` | TEXT nullable | override; auto-detect if null |
| `status` | TEXT `'active' \| 'paused'` | |
| `createdAt`, `updatedAt` | TIMESTAMPTZ | |

`UNIQUE (userId, repoFullName)` — one factory per repo per user.

### `factory_runs` — one per (factory, issue)

| column | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `factoryId` | FK → factories, CASCADE | |
| `issueNumber` | INTEGER | |
| `issueTitle`, `issueUrl` | TEXT | snapshot at poll time |
| `type` | TEXT nullable | `bug \| feature \| docs` — set by `identify_type` |
| `state` | TEXT | see state machine below |
| `branch` | TEXT nullable | `factory/issue-<n>-<slug>` |
| `prNumber`, `prUrl` | nullable | set on `pr_opened` |
| `error` | TEXT nullable | failure reason |
| `sandboxId` | TEXT nullable | Vercel Sandbox name for the run |
| `traceRunId` | TEXT nullable | link into trace store |
| `variant` | TEXT nullable | reserved for matrix runs (deferred) |
| `startedAt`, `finishedAt` | TIMESTAMPTZ nullable | |
| `createdAt`, `updatedAt` | TIMESTAMPTZ | |

```
UNIQUE (factoryId, issueNumber)          -- dedupe: one run per issue
INDEX factory_runs_queue_idx (state, createdAt)   -- claim query
```

### `factory_run_steps` — the graph, persisted (ADR-0024)

| column | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `runId` | FK → factory_runs, CASCADE | |
| `seq` | INTEGER | execution order |
| `step` | TEXT | `identify_type \| reproduce \| create_fix \| review_fix \| implement_docs \| open_pr \| ...` |
| `status` | TEXT | `pending \| running \| passed \| failed \| skipped` |
| `verdict` | JSONB nullable | structured output: `{ ok, evidence, revisionOf }` |
| `attempts` | INTEGER default 0 | |
| `startedAt`, `finishedAt` | TIMESTAMPTZ nullable | |

```
INDEX factory_run_steps_run_idx (runId, seq)
```

### Run state machine

```
queued ─► classifying ─► reproducing ─► fixing ─► checking ─► pr_opened
   │            │              │                        │
   │            └── (docs: classifying ─► fixing ──────┘)
   ▼                           ▼                        ▼
cancelled                 failed  ◄──────────────── failed
```

`state` is the run-level rollup; `factory_run_steps` is the ground truth of
where the run actually is. Revisions loop inside `fixing` (create_fix ⇄
review_fix, capped) without leaving the `fixing` state.

---

## 2. Pipelines (ADR-0024)

Every step = one bounded model call, narrow toolset, structured verdict.

```
                    ┌───────────────┐
Issue (queued) ───► │ identify_type │  cheap model, no tools
                    └───────┬───────┘   → { type: bug|feature|docs }
              ┌─────────────┼──────────────────┐
              ▼             ▼                  ▼
        ┌─ BUG ──────┐ ┌─ DOCS ────────┐ ┌─ FEATURE (phase 2) ─┐
        │ reproduce  │ │ implement_docs│ │ analyze             │
        │    │pass   │ │       │pass   │ │ implement ⇄ review  │
        │ create_fix │ │       ▼       │ │           ▼         │
        │    ⇅ ≤N    │ │   open_pr     │ │      open_pr        │
        │ review_fix │ └───────────────┘ └─────────────────────┘
        │    │pass   │
        │    ▼       │   any step fail / cap hit ──► failed (+ issue comment)
        │ open_pr    │
        └────────────┘
```

| step | tools | pass criterion |
|---|---|---|
| `identify_type` | none | structured `{type, reason}` from cheap model |
| `reproduce` | read-only + `run_command` + browser | failing test/repro output captured as evidence |
| `create_fix` | full file/shell tools (no PR tool) | diff exists; checks pass |
| `review_fix` | read-only diff inspection | explicit rubric: addresses repro? tests added? no unrelated changes? |
| `implement_docs` | file tools | docs build/preview passes |
| `open_pr` | GitHub API | PR created; run → `pr_opened` |

**Failure path.** Any step that cannot pass (or hits caps) → run `failed`,
`error` persisted, **one** comment on the issue (marker string in the comment
body prevents duplicates across re-runs).

**Skip path (poll time).** Issues with an existing run row (`UNIQUE`) or an
open factory PR (head branch `factory/issue-<n>-*`) never get a run.

---

## 3. Worker (`worker/index.ts`)

Plain Node process (`npm run worker`, `tsx`). Sequential queue:

```
while (true) {
  if (isPollDue())  await pollOnce()          // default every 10 min
  const run = await claimNextRun()            // atomic claim
  if (run) await advanceRun(run)              // advance ONE step
  else      await sleep(TICK_MS)              // default 5 s
}
```

- **`pollOnce()`** (`lib/factory-poll.ts`, shared with the cron route):
  for each active factory → installation token → list open issues (skip PRs)
  → label filter → `INSERT ... ON CONFLICT DO NOTHING` → `queued` runs.
- **`claimNextRun()`**: `UPDATE factory_runs SET state = <next>, "updatedAt" =
  now() WHERE id = (SELECT id ... WHERE state='queued' ORDER BY createdAt
  LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING ...` — safe under concurrency.
- **`advanceRun()`** (`lib/factory-run.ts`): loads the run's current step,
  executes it, persists verdict + next step, rolls up `state`. One step per
  iteration so the queue never starves behind a long run's *whole* pipeline.

### Sandbox lifecycle per run

Free-tier Vercel allows **one live sandbox at a time**, so all factory runs
share a single sandbox (`factory-shared`) — safe because the queue is
sequential. The sandbox stays warm between runs; isolation comes from a
per-run working directory that is wiped on entry and on exit.

```
claim → provision shared sandbox "factory-shared" (persistent, GITHUB_TOKEN)
      → wipe + create runs/<runId>/ workspace
      → clone repo into it
      → steps share this workspace (continuity, ADR-0024)
      → finally: wipe runs/<runId>/ (sandbox itself stays alive)
```

A conversation sandbox being live can block provisioning (free-tier limit);
the run then fails with a clear error and can be re-run from the dashboard.

### Caps (enforced between steps, in `advanceRun`)

| cap | default |
|---|---|
| steps per phase (`maxSteps` from settings.loop) | settings |
| revise cycles (`review_fix` → `create_fix`) | 2 |
| run wall clock | 20 min |
| concurrency | 1 (sequential queue) |

---

## 4. API surface (Next.js app)

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/factories` | list / create factory |
| GET/PATCH/DELETE | `/api/factories/:id` | detail / edit+pause / delete |
| GET | `/api/factories/:id/runs` | runs with current step + statuses |
| POST | `/api/factories/:factoryId/runs/:runId/rerun` | failed → new queued run (same issue) |
| POST | `/api/factories/:factoryId/runs/:runId/cancel` | queued → cancelled |
| GET | `/api/factory-traces` | trace runs where `factoryRunId IS NOT NULL` |
| POST | `/api/cron/factory-poll` | prod cron entry → `pollOnce()`; guarded by `CRON_SECRET` |

All routes ownership-checked (`session.user.id` → `factories.userId`).

## 5. Ops dashboard (`/factory`, T13)

Modeled on the reference UI:

- **Left rail**: runs across the user's factories, each row = issue title +
  stage badge (`Queued` / `Reproducing` / `Fixing` / `Checking` / `Done` /
  `Failed`) + factory avatar/initials.
- **Detail pane** (selected run):
  - issue title, state badges, issue body (fetched live from GitHub)
  - **stage table**: rows = pipeline stages, cells = step status
    (▶ step chip with verdict, PR link, "Awaiting reproduction", …)
  - tabs: Details (steps + evidence JSON) · Trace (existing
    `trace-run-card` timeline via `factoryRunId`)
- **Actions** (top bar): Re-run (failed) · Cancel (queued) · Refresh · GitHub link.
- **Traces tab**: all factory runs + conversations, reusing the observability view.

## 6. Trace integration

`startTraceRun` gains a nullable `conversationId`; factory runs pass
`factoryRunId` instead. Each step's model call writes spans as usual, tagged
with the step name in `phase` — so `/factory` traces show the pipeline, and
per-step timelines need no new observability code.

## 7. Build order

| # | deliverable | issue | status |
|---|---|---|---|
| 1 | schema: `factories`, `factory_runs`, `factory_run_steps` + migration | T11 | ✅ |
| 2 | `lib/factories.ts` domain + CRUD API routes | T11 | ✅ |
| 3 | `lib/factory-poll.ts` (`pollOnce`) + cron route + `vercel.json` | T11 | ✅ |
| 4 | `worker/` loop: resume + claim + tick, `npm run worker` | T11/T12 | ✅ |
| 5 | step executor + `identify_type` + **bug pipeline** (reproduce → fix ⇄ review → PR), failure comment path | T12 | ✅ |
| 6 | docs pipeline (`implement_docs`) | T12 | ✅ |
| 7 | feature pipeline (`analyze → implement ⇄ review`) | T12 (stretch) | pending |
| 8 | `/factory` dashboard: list, detail stage table, re-run/cancel, traces tab | T13 | ✅ |

Implementation notes (deviations from the original sketch):

- **Shared sandbox**: free-tier Vercel allows one live sandbox at a time, so
  all runs share a single `factory-shared` sandbox with per-run wiped
  workspaces (§3) instead of one sandbox per run.
- **Run recovery**: the worker resumes orphaned active runs (`getActiveRun`)
  before claiming queued ones, so a worker crash mid-step never strands a run.
- **Trace spans**: factory steps write one span per step directly
  (`factory:<step>` phase) rather than per-tool-call spans.

## 8. Verification

- `tsc --noEmit` + lint clean
- E2E happy path: factory on a test repo → file a bug issue → `npm run worker`
  → watch `factory_run_steps` fill in → PR opens referencing the issue
- Failure path: unfixable issue → run `failed`, exactly one comment on the issue
- Dedupe: re-poll does not create duplicate runs; open factory PR blocks new runs
- Resumability: kill the worker mid-run → restart → run continues at current step
