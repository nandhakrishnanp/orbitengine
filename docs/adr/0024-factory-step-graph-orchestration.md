# Factory runs are a step graph, not one engine loop

A factory run is orchestrated as a **graph of small, single-purpose agent
steps** — classify, reproduce, fix, review, open PR — rather than one long
engine loop that is prompted to manage its own phases. Each step is one bounded
model call with a narrow toolset, an explicit success criterion, and a
structured verdict (pass / fail / needs-revision + evidence) persisted before
the next step starts.

## Why

- **Routing before work.** A cheap classification step (bug / feature / docs)
  picks the pipeline. A docs change never enters the reproduce machinery; a
  bug never skips reproduction.
- **Resumability.** Because every step transition is persisted
  (`factory_run_steps`), a crashed worker resumes at the current step instead
  of re-running the whole loop.
- **Explicit revise loops.** Review → revise is a graph edge with a hard cap
  (`maxRevisions`), not an emergent behaviour we hope terminates.
- **The dashboard is the graph.** The ops UI (issue list with stage badges;
  detail pane with a stage table) is a direct rendering of the step rows. A
  single opaque loop cannot power that surface.
- **Composability.** A new capability is a new step type or new pipeline
  wiring — not a new mega-prompt.

## What stays

The engine does not go away. `lib/engine.ts` tools and the Vercel Sandbox
remain the **step executor**: each step is an engine invocation with a
different prompt and tool gate. One sandbox per run (ADR-0001), kept alive for
the run's duration so the workspace carries across steps; evidence
(repro output, diff, check logs) is handed forward as structured step output.
The PR remains the human review gate (ADR-0022); runs never auto-merge.

## Structure

```
Issue queued → identify_type (cheap model, structured output)
  bug:      reproduce → create_fix ⇄ review_fix (≤ maxRevisions) → open_pr
  docs:     implement_docs → open_pr
  feature:  analyze → implement ⇄ review → open_pr        (later phase)
```

Every step writes trace spans (ADR-0021) tagged with its `factoryRunId`, so
per-step and per-run timelines share one observability surface.

## Consequences

- Schema gains `factory_runs.type` and a `factory_run_steps` table; the run
  state machine tracks the current step.
- More model calls per run than a single loop; acceptable — each is smaller
  and skippable (a failed reproduction ends the run early).
- Review quality needs explicit criteria and a revision cap (default 2).
- Matrix runs (one issue × N variants) are deferred; the schema leaves room
  for a variant column on `factory_runs`.
