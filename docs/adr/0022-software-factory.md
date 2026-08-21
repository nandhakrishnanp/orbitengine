# Software factory: polled, per-issue autonomous fixes

A factory is a per-repository configuration that watches for new open issues and
runs the engine on each one to reproduce it, fix it on a separate branch, and
open a PR. It is **polled** — a Vercel Cron (~10 min) reads the repo's open
issues and diffs against a `factory_runs` table — rather than driven by a GitHub
webhook, preserving ADR-0002's no-webhook stance and avoiding an inbound event
surface.

Each issue becomes a **factory run**: a dedicated `factory_runs` entity (not a
user chat conversation) that drives the same engine loop, sandbox lifecycle (one
sandbox per run, ADR-0001), model selection, modes, and trace persistence. A run
opens a PR only when it reproduces the issue and lands a fix that passes checks;
otherwise it is marked failed and comments on the issue. Runs skip issues that
already have an open factory PR, never auto-retry (manual re-run from the
dashboard), and are bounded by per-run step/time caps and a concurrency limit.
The PR is the review gate — the user reviews and merges like any other PR.
