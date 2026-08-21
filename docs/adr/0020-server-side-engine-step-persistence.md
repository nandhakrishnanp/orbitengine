# Server-side incremental engine-step persistence

## Status

Implemented (PR #34, closes issue #21).

## Context

Version 1 persisted assistant messages (including tool-call parts) only when the
client's `onFinish` fired, writing a single snapshot at response completion. If
the response was interrupted or the client disconnected, in-flight engine work —
tool calls, their results, a produced PR URL — was lost, and the existing
`phase` column was never populated. This made engine activity non-auditable and
non-durable.

Version 2 moves persistence server-side and writes each engine step (every tool
call and its result) to Postgres incrementally as it happens, populating `phase`.
The engine loop is already server-side (ADR-0013), so the sandbox is an execution
tool the model calls and persistence belongs next to the loop, not in the client.
This restores the PRD's "auditable" goal and makes every engine action durable
regardless of client state.

## Decision

- **One row per turn.** The engine route generates an assistant message ID up
  front; each step upserts (`INSERT ... ON CONFLICT DO UPDATE`) that same row,
  so `parts` JSONB grows in place rather than spawning one row per step.
- **Hook:** AI SDK v7's `createUIMessageStream({ onStepEnd })`, with a final
  write in `onEnd`. The accumulated `responseMessage` (full UIMessage parts) is
  persisted verbatim — identical shape to what hydration expects.
- **Phase vocabulary:** activity-based — `tool:<name>` for steps whose last tool
  part reached `output-available`/`output-error`, otherwise `responding`.
- **Client is no longer a writer.** The browser-side assistant POST in
  `onFinish` was removed; the server is the single source of truth.
- **Disconnect survival:** `result.consumeStream()` plus draining a tee'd copy
  of the SSE stream keeps generation (and therefore persistence) running after
  the client disconnects.
- **Step cap raised** from 10 to 50 as part of this work.

## Consequences

No schema migration was needed (`parts`, `phase` already existed). Partial runs
persist whatever completed before interruption, including any PR URL produced by
`create_pull_request`.
