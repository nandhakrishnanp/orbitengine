# Browser capability via agent-browser inside the conversation sandbox

To verify that a feature actually works, the engine needs to navigate a real
browser. Version 2 uses `vercel-labs/agent-browser` — a browser-automation CLI
for AI agents with first-class `@vercel/sandbox` (Firecracker microVM)
integration — running inside the conversation's existing sandbox, exposed as an
engine tool the model calls when it needs to navigate, interact, and confirm a
feature works.

This extends ADR-0004's one-sandbox-per-loop invariant rather than adding a
second browser sandbox or a managed third-party browser over WebSocket. Keeping
the browser inside the same sandbox preserves the isolation model and avoids an
out-of-band execution surface. Browsing is gated to Build mode and to skills
that declare it, keeping Plan mode purely observational.
