# OrbitEngine — Product Requirements Document

## 1. Metadata

| Field | Value |
|-------|-------|
| Product | OrbitEngine |
| Author | nandhakrishnanp |
| Status | Approved — MVP built |
| Version | 2.0 |
| Last updated | 2026-08-18 |
| Stakeholders | nandhakrishnanp (sole maintainer, hobby project) |
| Related docs | [`architecture.md`](architecture.md), [`CONTEXT.md`](../CONTEXT.md), [`adr/`](adr/) |

## 2. Overview

OrbitEngine is a cloud platform where a user opens a chat alongside a coding
engine, links their GitHub, and the engine — running entirely in the cloud in
an isolated sandbox per conversation — reads repositories, edits code, runs
tests, and hands back a pull request. The client is a thin chat + status
surface; nothing user-facing executes on the user's machine.

## 3. Problem Statement

AI coding assistants today either run on the user's machine (local CLI agents
that need a dev environment, risk touching the working tree, and can't be
shared) or are locked into a vendor's hosted editor (no access to the user's
own GitHub workflow, limited auditability). Developers who want AI-assisted
fixes, refactors, and feature work still have to context-switch between chat
tools and their GitHub workflow.

What's missing: a place where the *conversation* is the interface, the
*execution* is fully isolated and cloud-side, and the *output* lands directly
in the user's GitHub as a reviewable PR.

## 4. Goals & Non-Goals

### Goals

- Chat is the only interface: the user talks, the engine works, the result is a PR.
- Full isolation: one ephemeral sandbox per conversation; no shared or reused state.
- GitHub is the primary integration surface, two-way: observe/read and write/push.
- Everything runs cloud-side; the user's local repo is never touched.
- Auditable: conversation history persists; every engine action is visible as a tool call.

### Non-Goals

- Not a general IDE or code editor (the sandbox monitor is a status/debug surface, not an editor).
- Not a CI/CD replacement — the engine opens PRs; normal GitHub review/merge applies.
- No multi-tenant team features (shared workspaces, roles, billing) in this scope.
- No client-side execution of any kind.
- No support for non-GitHub code hosts.

## 5. Success Metrics

| Metric | Target |
|--------|--------|
| Time to sandbox provision | < 10s |
| Engine first-token latency | < 3s |
| PR merge rate from engine-generated fixes | tracked, no target (hobby project) |
| Conversation reopen rate | tracked, no target |

Instrumentation for these metrics is not yet built; the targets guide future work.

## 6. Target Users / Personas

- **The solo developer** — wants AI-assisted fixes, refactors, and feature work
  without babysitting a local agent or leaving their GitHub workflow. Attaches a
  repo, describes the problem, reviews the PR.
- **The curious tinkerer** — wants to watch an agent work: inspect the sandbox
  filesystem, read the files it touched, run commands alongside it (the monitor).

## 7. User Stories / Use Cases

1. **Sign in** — As a developer, I sign in with GitHub so my conversations and
   repos are tied to my account.
2. **Start a conversation** — As a developer, I open a new conversation and get
   an isolated sandbox provisioned automatically.
3. **Attach a repo** — As a developer, I type `@owner/repo` and pick from
   autocomplete; the engine clones the repo into the sandbox.
4. **Ask for work** — As a developer, I describe a bug or feature in chat; the
   engine reads code, edits files, and runs tests in the sandbox.
5. **Review the result** — As a developer, the engine opens a PR on GitHub and
   returns the link in chat; I review and merge like any other PR.
6. **Create issues from chat** — As a developer, I ask the engine to file an
   issue and it creates one on GitHub.
7. **Bootstrap a project** — As a developer, I ask for a new project and the
   engine creates a new GitHub repo and scaffolds it.
8. **Watch the sandbox** — As a tinkerer, I open the monitor to browse the
   sandbox file tree, view files with syntax highlighting, and run commands
   with live streaming output.
9. **Close and reopen** — As a developer, I close a conversation (sandbox
   destroyed, history kept) and reopen it later with a fresh sandbox.

## 8. Requirements

### 8.1 Functional — P0 (core attach-and-fix loop)

| # | Requirement | Status |
|---|-------------|--------|
| F1 | GitHub OAuth sign-in with database-backed sessions | Done |
| F2 | Create, list, fetch, close, and reopen conversations | Done |
| F3 | Ownership enforcement: every route verifies the session owns the conversation | Done |
| F4 | Send user messages; persist full chat history (role, content, phase) | Done |
| F5 | Stream engine responses with reasoning, tool calls, and terminal output visible | Done |
| F6 | Provision one ephemeral sandbox per conversation on open; destroy on close | Done |
| F7 | Inject short-lived, scoped GitHub token into the sandbox as `GITHUB_TOKEN` | Done |
| F8 | `@owner/repo` mention with autocomplete from the user's GitHub installations | Done |
| F9 | Agent-driven repo cloning when the user mentions a repo | Done |
| F10 | Engine tools: `run_command`, `read_file`, `write_file`, `list_files` | Done |
| F11 | Engine tools: `create_pull_request`, `create_issue`, `create_repository` | Done |
| F12 | Multi-step engine loop (up to 10 tool steps per reply) | Done |
| F13 | Conversation history survives sandbox close/reopen | Done |

### 8.2 Functional — P1 (extensions)

| # | Requirement | Status |
|---|-------------|--------|
| F14 | Sandbox monitor: file tree (bounded walk), file viewer (1 MB cap, binary detection, path containment), command runner (SSE streaming, 5 min timeout) | Done |
| F15 | Sandbox status UI: provisioning / ready / closed states with reopen action | Done |
| F16 | Landing page and sign-in UX | Done |
| F17 | code-server (VS Code in browser) inside the sandbox via SDK port exposure | Not built (follow-up on issue #19) |

### 8.3 Non-Functional

| # | Requirement | Status |
|---|-------------|--------|
| N1 | **Isolation** — each sandbox is its own Firecracker microVM (dedicated kernel, network, filesystem); no state shared between conversations | Done |
| N2 | **Secrets** — all GitHub App credentials, DB URLs, and tokens stay server-side; nothing secret reaches the client | Done |
| N3 | **Token hygiene** — only short-lived, per-conversation installation tokens; never long-lived app or user tokens | Done |
| N4 | **Path safety** — monitor file reads enforce path containment and skip `node_modules`/`.git`/`dist`/`.next` | Done |
| N5 | **Streaming** — engine output streams to the client (SSE) rather than blocking | Done |
| N6 | **Idempotent schema** — `db/schema.sql` is safe to re-run | Done |
| N7 | **Portability** — single language (TypeScript) across client and server | Done |

## 9. User Flow / UX

```
Landing page ──sign in with GitHub──► Conversations (sidebar + list)
                                          │
                                     New conversation
                                          │
                                          ▼
                              Chat view + sandbox auto-provisions
                              (status badge: provisioning → ready)
                                          │
                              Type "@owner/repo fix the bug"
                              (@-mention autocomplete lists repos)
                                          │
                                          ▼
                              Engine streams work:
                              reasoning (collapsible) →
                              tool cards (clone, read, edit, test) →
                              PR link in chat
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │                                            │
             Monitor button                              Close conversation
             /conversations/:id/monitor                   (sandbox destroyed,
             file tree + file viewer +                     history kept)
             command runner                                  │
                                                            ▼
                                                     Reopen → fresh sandbox
```

UI surfaces:

- **Chat** — messages, collapsible reasoning, collapsible tool-call cards,
  terminal output blocks, `@`-mention picker with keyboard navigation.
- **Sidebar** — conversation list (first user message as title), user info,
  sign-out.
- **Monitor** — two-pane: file tree + file viewer (shiki highlighting, line
  numbers, copy/download) and a command runner with live streaming output.

Screenshots: [`media/chat.png`](../media/chat.png),
[`media/filemonitor.png`](../media/filemonitor.png).

## 10. Technical Approach

Deep dive on each major subsystem. Decisions are recorded as ADRs in
[`adr/`](adr/); each subsection cites the relevant ADRs.

### 10.1 Authentication

Auth.js (NextAuth v5) with the GitHub provider, using the OAuth Web
Application flow of a **GitHub App** (not a plain OAuth app), so sign-in and
repo access share one installation (ADR-0002, ADR-0014).

- **Database-backed sessions** (`strategy: "database"`) via
  `@auth/pg-adapter` — sessions live in Postgres, not cookies/JWT-only, so
  they survive deploys and can be inspected/revoked.
- Auth config lives in a single `auth.ts` consumed by both the route handler
  (`/api/auth/[...nextauth]`) and server-side `getSession()` calls.
- Every protected API route re-verifies ownership: `session.user.id` must
  match the conversation's `userId`. There is no client-trusted ownership.

Why this shape: a GitHub App gives installation-scoped tokens (needed by the
engine, §10.2) while the OAuth flow gives the user session. One integration
serves both.

### 10.2 GitHub Integration

All GitHub access goes through the GitHub App API, server-side, in
`lib/github.ts`:

- **App JWT** — signed with the app's private key (RS256), minted on demand,
  short TTL. Used only to talk to the App API.
- **Installation tokens** — exchanged per installation, **short-lived and
  scoped** (ADR-0012). These are the only tokens that ever reach a sandbox,
  injected as the `GITHUB_TOKEN` env var.
- **Read surface** — `GET /api/repos` lists repos accessible via the user's
  installations; this powers `@`-mention autocomplete.
- **Write surface (v1, ADR-0008)** — exactly three engine tools:
  `create_pull_request`, `create_issue`, `create_repository`. Deliberately
  narrow: the engine can propose work (PRs) and track it (issues, repos) but
  cannot merge, delete, or administer.
- **No webhooks** — the engine works purely over the API; there is no
  inbound GitHub event pipeline.

Why this shape: short-lived scoped tokens bound to one installation mean a
compromised sandbox can only do what one repo installation allows, for a
bounded time.

### 10.3 Sandbox

Execution happens exclusively in **Vercel Sandbox** (ADR-0004): managed
Firecracker microVMs with persistent filesystems, accessed via
`@vercel/sandbox` v3 from `lib/sandbox.ts`.

- **Lifecycle (ADR-0001, ADR-0016)** — one sandbox per conversation, spawned
  when the conversation is opened, destroyed when it is closed. Closing
  destroys only the VM + filesystem; conversation and messages remain in
  Postgres. Reopening provisions a *fresh* sandbox (old `sandboxId` cleared) —
  state is never carried across sandboxes.
- **Provisioning** — `POST /api/conversations/:id/sandbox` with
  `persistent: true`; the client auto-triggers it on conversation open and
  shows provisioning/ready/closed states.
- **Token injection** — the short-lived installation token is set as
  `GITHUB_TOKEN` in the sandbox environment at provision time.
- **Repo cloning is agent-driven (ADR-0007, ADR-0015)** — the platform stores
  no "attached repo" state. The system prompt tells the engine that an
  `@owner/repo` mention means: clone it yourself via `run_command`
  (`git clone https://x-access-token:${GITHUB_TOKEN}@github.com/...`). One
  repo per conversation by convention.
- **Monitor access (issue #19)** — `getConversationSandbox`,
  `walkSandboxTree` (bounded: depth 5, 2000 entries, skips
  `node_modules`/`.git`/`dist`/`.next`), and `readSandboxFile` (1 MB cap,
  binary detection, path containment check) expose the sandbox to the
  monitor UI safely.

Why this shape: Firecracker gives kernel-level isolation per conversation at
near-zero marginal cost; making cloning agent-driven keeps the platform
stateless about repos and keeps the engine in control of its own workspace.

### 10.4 Engine Loop

The engine is a **server-side agent loop** (ADR-0013) built on the **Vercel
AI SDK** (ADR-0006), defined in `lib/engine.ts` and served from
`app/api/conversations/[id]/engine/route.ts`.

- **Model access (ADR-0010)** — any OpenAI-compatible endpoint; currently
  OpenZen (`lib/ai.ts`). Provider-agnostic by construction.
- **Tools** — the model acts through a fixed tool set:
  - `run_command` — shell in the sandbox (clone, test, build, anything)
  - `read_file` / `write_file` / `list_files` — filesystem work
  - `create_pull_request` / `create_issue` / `create_repository` — GitHub writes
- **Loop control** — `streamText` with `stopWhen` caps the tool-calling loop
  at 10 steps per reply, bounding cost and runaway behavior.
- **Streaming** — the route streams SSE to the client; the UI renders
  incremental text, collapsible reasoning, tool-call cards, and terminal
  output as they arrive (AI Elements components).
- **Persistence** — user and assistant messages are stored in Postgres
  (role, content, phase) so history survives across visits and sandbox
  reopens (ADR-0016).

Why this shape: keeping the loop server-side means the sandbox is just an
execution tool the model calls — no agent runtime on the client, no long-lived
client connections, and the same loop can later be driven by non-browser
clients.

### 10.5 Data Model

PostgreSQL (ADR-0011), schema in `db/schema.sql` (idempotent):

```
users 1──N conversations 1──N messages
users 1──N accounts
users 1──N sessions
```

| Table | Key columns | Notes |
|-------|-------------|-------|
| `users` | id, name, email, image | Auth.js managed |
| `accounts` | userId, provider, providerAccountId, tokens | OAuth links |
| `sessions` | sessionToken, userId, expires | Database-backed sessions |
| `conversations` | id, userId, sandboxId, status (`open`\|`closed`), createdAt, updatedAt | `sandboxId` is the Vercel Sandbox name; null when closed |
| `messages` | id, conversationId, role (`user`\|`assistant`\|`system`), content, phase (nullable), createdAt | `phase` marks engine work phases |

Deliberately minimal: no `attachedRepository` column, no PR/issue tracking
tables — GitHub is the system of record for repo state (ADR-0007, ADR-0008).

### 10.6 Frontend

Next.js 16 App Router + TypeScript + Tailwind v4 (ADR-0003, ADR-0005),
deployed on Vercel (ADR-0009).

- **Server components** for pages, layouts, sidebar, and the monitor page
  shell; **client components** only where interactivity is required:
  streaming chat, `@`-mention picker, sandbox status, monitor panel.
- **Chat** — `useChat` hook against the engine route; AI Elements components
  (`Message`, `Reasoning`, `Tool`, `Terminal`, `FileTree`, `Artifact`,
  `CodeBlock`) for rendering.
- **Auth gating** — `app/conversations/layout.tsx` is the auth boundary;
  unauthenticated users land on the sign-in page.
- **No secrets in the client** — the client only ever talks to our own API
  routes.

### 10.7 Deployment & Environment

Deployed on Vercel (ADR-0009); local dev mirrors it (Node 24+, Dockerized
Postgres on port 5433).

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_SECRET` | Yes | Auth.js secret |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | Yes | GitHub App OAuth client |
| `GITHUB_APP_ID` | Yes | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_PRIVATE_KEY_PATH` | One of the two | App private key (PEM contents or path) |
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_DATABASE_URL` | No | Fallback for `DATABASE_URL` |
| `VERCEL_OIDC_TOKEN` | Yes | Vercel Sandbox OIDC auth |
| `OPENZEN_API_KEY` / `OPENZEN_BASE_URL` | Yes | AI provider (OpenAI-compatible) |

`.env.local` is gitignored; secrets are never committed.

## 11. Risks & Open Questions

### Risks

| Risk | Mitigation |
|------|------------|
| Single-maintainer (hobby project) — bus factor 1 | ADRs + this doc keep decisions recoverable; MIT-licensed |
| Dependence on Vercel Sandbox availability/pricing | Sandbox lifecycle is isolated in `lib/sandbox.ts`; swapping providers is one module |
| AI provider cost/availability (OpenZen) | OpenAI-compatible interface (ADR-0010) — provider is a config change |
| Runaway engine loops (cost, damage) | 10-step cap, narrow write surface (PR/issue/repo only), sandbox isolation |
| Token leakage from sandbox | Short-lived scoped tokens only (ADR-0012); no long-lived credentials ever injected |
| GitHub App approval/permission changes by GitHub | Write surface is minimal; no webhooks to break |

### Open Questions

- **code-server in the sandbox** — VS Code in the browser via SDK port
  exposure; tracked as a follow-up on issue #19.
- **Multi-repo conversations** — currently one repo per conversation by
  convention (ADR-0007); no plan to change.
- **Metrics instrumentation** — targets defined in §5 but not yet measured.
- **Sandbox idle timeout** — currently the sandbox lives until the
  conversation is closed; idle reclamation is unexplored.

## 12. Appendix

- **Architecture overview** — [`architecture.md`](architecture.md)
- **Domain glossary** — [`CONTEXT.md`](../CONTEXT.md)
- **Architecture Decision Records** — [`adr/`](adr/) (0001–0016)
- **Issue tracker conventions** — [`agents/issue-tracker.md`](agents/issue-tracker.md),
  labels in [`agents/triage-labels.md`](agents/triage-labels.md)
- **API routes** — full table in [`architecture.md`](architecture.md#api-routes)
- **Screenshots** — [`media/chat.png`](../media/chat.png),
  [`media/filemonitor.png`](../media/filemonitor.png)

### Issue Status Snapshot (2026-08-18)

| Issue | Title | Status |
|-------|-------|--------|
| #1 | MVP: the attach-and-fix loop | Open (parent) |
| #4 | Attach one repository | Closed |
| #5 | Sandbox lifecycle per conversation | Closed |
| #6 | Engine chat loop (streaming + phases) | Closed |
| #7 | Clone repo into sandbox + read files | Closed |
| #8 | Edit/write files + run commands | Closed |
| #9 | Open a pull request from chat | Closed |
| #10 | Create a GitHub issue from chat | Closed |
| #11 | Bootstrap a new repository | Closed |
| #17 | UI polish: landing + sign-in pages, icons + typography | Open |
| #18 | Persist engine responses to Postgres (full fidelity) | Open |
| #19 | Sandbox monitor: file browser + command runner | Closed |
