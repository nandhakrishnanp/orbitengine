# Observability trace store for engine activity

To make engine activity inspectable, every engine step is recorded as a trace
span — tool, phase, startedAt, durationMs, input, output — with per-run context
(model, provider, skills, step count, total time, and token usage when the
provider reports it). This is a **dedicated store** written server-side by the
same loop that does the durable persistence, not folded into chat message parts,
so timing and context data do not bloat conversation history.

Traces stream live over SSE and are viewed per conversation or per factory run
in the Ops surface. There is no cross-user aggregation or metrics in this scope —
observability is a read surface over data the loop already records. Keeping the
trace in the same server-side write path (ADR-0013, ADR-0020) makes every run
inspectable without a parallel pipeline.
