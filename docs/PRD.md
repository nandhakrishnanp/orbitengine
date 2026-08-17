# OrbitEngine — Product Requirements Document

## Product Vision

OrbitEngine is a cloud platform where a user opens a chat alongside an engine, links their GitHub, and the engine reads/writes repositories, PRs, and issues, bootstraps new projects, edits code, runs tests, and pushes fixes. All execution happens cloud-side; the client is a thin chat + status surface.

## Target Users

- Developers who want AI-assisted code fixes, refactors, and feature work
- Teams that want an auditable, cloud-side coding assistant tied to their GitHub workflow

## MVP Scope (Issue #1 — the attach-and-fix loop)

The MVP delivers the core loop: a user attaches a repository, chats with the engine, the engine edits code in an isolated sandbox, runs tests, and opens a PR.

---

## Epic 1: Authentication & User Management

### Status: COMPLETE

| Requirement | Status | Details |
|-------------|--------|---------|
| GitHub OAuth sign-in | Done | NextAuth v5 with GitHub provider (`auth.ts`) |
| Database-backed sessions | Done | PostgresAdapter, strategy: "database" |
| Session persistence across visits | Done | Sessions stored in `sessions` table |
| Sign-out | Done | Sidebar sign-out button |
| User info display | Done | Sidebar shows user name, email, avatar |

**Key files**: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/providers.tsx`, `app/conversations/sidebar.tsx`

---

## Epic 2: Conversation Management

### Status: COMPLETE

| Requirement | Status | Details |
|-------------|--------|---------|
| Create new conversation | Done | POST `/api/conversations` |
| List user's conversations | Done | GET `/api/conversations` — ordered by updatedAt DESC |
| Fetch conversation + messages | Done | GET `/api/conversations/:id` |
| Close conversation | Done | DELETE `/api/conversations/:id` — destroys sandbox, keeps history |
| Reopen conversation | Done | POST `/api/conversations/:id/sandbox` — provisions fresh sandbox |
| Conversation ownership | Done | All routes verify `session.user.id` matches `conversation.userId` |
| Conversation sidebar | Done | Lists conversations with first user message as title |

**Key files**: `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`, `app/conversations/sidebar.tsx`

---

## Epic 3: Repository Attachment

### Status: COMPLETE (agent-driven)

| Requirement | Status | Details |
|-------------|--------|---------|
| @-mention repo picker | Done | Client component with keyboard navigation, autocomplete |
| List accessible repos | Done | GET `/api/repos` — via GitHub installation API |
| Agent-driven cloning | Done | User types @owner/repo, agent clones via system prompt |
| No platform-side state | Done | No attachedRepository column, no PATCH endpoint |

**Key files**: `app/conversations/[id]/streaming-chat.tsx`, `app/api/repos/route.ts`, `lib/github.ts`

---

## Epic 4: Sandbox Lifecycle (Issue #5)

### Status: COMPLETE

| Requirement | Status | Details |
|-------------|--------|---------|
| Provision sandbox on conversation open | Done | Auto-provisions via client component + POST `/api/conversations/:id/sandbox` |
| Sandbox status UI | Done | Provisioning (amber pulse), Ready (green), Closed (grey) |
| Persistent sandbox across turns | Done | `persistent: true` in Vercel Sandbox SDK |
| Destroy sandbox on close | Done | `DELETE /api/conversations/:id` calls `destroySandbox()` |
| Fresh sandbox on reopen | Done | POST endpoint provisions new sandbox, clears old sandboxId |
| Inject short-lived GitHub token | Done | `GITHUB_TOKEN` env var from installation token |
| Agent-driven repo cloning | Done | Agent clones repos via system prompt when user types @owner/repo |
| Conversation history survives close | Done | Only sandbox destroyed; messages remain in Postgres |

**Key files**: `lib/sandbox.ts`, `app/api/conversations/[id]/sandbox/route.ts`, `app/conversations/[id]/sandbox-status.tsx`

---

## Epic 5: Messaging

### Status: COMPLETE

| Requirement | Status | Details |
|-------------|--------|---------|
| Send user message | Done | POST `/api/conversations/:id/messages` |
| Display messages in chat | Done | AI Elements `Message` + `MessageResponse` components |
| Message persistence | Done | Stored in `messages` table with role, content, phase |
| Message ordering | Done | Ordered by `createdAt` |
| Engine response streaming | Done | `useChat` hook + SSE from engine route |
| Streaming UI | Done | Live text streaming with cursor animation |
| Reasoning display | Done | Collapsible reasoning via AI Elements `Reasoning` component |
| Tool call display | Done | Collapsible tool cards via AI Elements `Tool` component |
| Terminal output | Done | Command output via AI Elements `Terminal` component |

**Key files**: `app/api/conversations/[id]/messages/route.ts`, `app/conversations/[id]/streaming-chat.tsx`

---

## Epic 6: Engine Loop (AI Integration)

### Status: COMPLETE

| Requirement | Status | ADR |
|-------------|--------|-----|
| Vercel AI SDK agent runtime | Done | ADR-0006 |
| OpenZen as AI provider | Done | ADR-0010 (hy3-free model) |
| Server-side engine loop | Done | ADR-0013 |
| Tool calling (file read/write, test exec) | Done | ADR-0006, ADR-0008 |
| GitHub write tools (PR, issue, repo) | Done | ADR-0008 |
| Streaming output to chat | Done | ADR-0006 |
| Multi-step tool loop (up to 10 steps) | Done | `stopWhen` in `streamText` |

**Key files**: `lib/ai.ts`, `lib/engine.ts`, `app/api/conversations/[id]/engine/route.ts`

---

## Epic 7: New Project Bootstrapping

### Status: COMPLETE

| Requirement | Status | ADR |
|-------------|--------|-----|
| Bootstrap new repo from scratch | Done | ADR-0015 |
| Create GitHub repo via API | Done | ADR-0008 (`create_repository` tool) |

---

## Epic 8: Sandbox Monitor (Issue #19)

### Status: COMPLETE

| Requirement | Status | Details |
|-------------|--------|---------|
| Monitor button per conversation | Done | Chat header, visible when sandbox is ready |
| Dedicated monitor route | Done | `/conversations/:id/monitor` — two-pane layout |
| File tree | Done | ai-elements `FileTree`; bounded walk (depth 5, 2000 entries, skips `node_modules`/`.git`/`dist`/`.next`) |
| File viewer | Done | ai-elements `Artifact` + `CodeBlock` (shiki highlighting, line numbers); 1 MB cap, binary detection, path containment check |
| Copy / download actions | Done | Artifact header actions |
| Command runner | Done | ai-elements `Terminal`; `sandbox.runCommand({ detached: true })` + `command.logs()` streamed over SSE; 5 min timeout; exit code surfaced |
| Ownership + sandbox guards | Done | All monitor routes verify session ownership; 400/404 when sandbox is closed |
| Closed/provisioning states | Done | Monitor page shows state + Reopen action |

**Key files**: `app/conversations/[id]/monitor/`, `app/api/conversations/[id]/monitor/`, `lib/sandbox.ts` (`getConversationSandbox`, `walkSandboxTree`, `readSandboxFile`)

**Future**: code-server (VS Code in browser) inside the sandbox via SDK port exposure — tracked as a follow-up in issue #19.

---

## Database Schema

### `conversations` table
```sql
conversations (
  id UUID PK,
  userId TEXT FK→users,
  sandboxId TEXT,                -- Vercel Sandbox name
  status TEXT DEFAULT 'open',    -- 'open' | 'closed'
  createdAt TIMESTAMPTZ,
  updatedAt TIMESTAMPTZ
)
```

### `messages` table
```sql
messages (
  id UUID PK,
  conversationId UUID FK→conversations,
  role TEXT,                     -- 'user' | 'assistant' | 'system'
  content TEXT,
  phase TEXT,                    -- nullable, for engine work phases
  createdAt TIMESTAMPTZ
)
```

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_SECRET` | Yes | Auth.js secret |
| `AUTH_GITHUB_ID` | Yes | GitHub App Client ID |
| `AUTH_GITHUB_SECRET` | Yes | GitHub App Client Secret |
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_DATABASE_URL` | No | Fallback for DATABASE_URL |
| `GITHUB_APP_ID` | Yes | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | Yes* | PEM contents (*or use path) |
| `GITHUB_APP_PRIVATE_KEY_PATH` | Yes* | Path to .pem file (*or use key) |
| `VERCEL_OIDC_TOKEN` | Yes | Vercel Sandbox OIDC auth |
| `OPENZEN_API_KEY` | Yes | OpenZen API key for AI provider |
| `OPENZEN_BASE_URL` | Yes | OpenZen API base URL (`https://opencode.ai/zen/v1`) |

---

## Key Metrics (Future)

- Time to sandbox provision (target: <10s)
- Engine response latency (first token)
- PR merge rate from engine-generated fixes
- User retention (conversations reopened)

---

## Issue Tracker

GitHub issues follow the conventions in `docs/agents/issue-tracker.md` with labels from `docs/agents/triage-labels.md`.

### Current Issue Status

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
