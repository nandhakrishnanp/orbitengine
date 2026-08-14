# AGENTS.md

## Project

OrbitEngine is a cloud platform where a user opens a chat alongside an engine,
links their GitHub, and the engine reads/writes repositories, PRs, and issues,
bootstraps new projects, edits code, runs tests, and pushes fixes. All execution
happens in the cloud; the client is a thin chat + status surface.

## Architecture invariants

- **One ephemeral cloud sandbox per agent loop.** Each session gets its own
  isolated sandbox (filesystem + execution + tests). Never share or reuse
  sandbox state between loops.
- **GitHub is the primary integration surface** (auth, repositories, issues,
  PRs, pushes). It is two-way: observe/read and write/push.
- Everything runs cloud-side. Nothing user-facing executes on the client.

## Status / known unknowns

- The tech stack, frontend, and sandbox tech are **undecided**. Do not assume a
  language, framework, or container platform. Record them here once chosen.
- Repo is early-stage and mostly empty; this file documents intent, not reality.
- Do not write toolchain/command guidance here that cannot be verified — that
  belongs in this file only after the stack is picked.