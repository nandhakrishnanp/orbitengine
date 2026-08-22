# OrbitEngine Architecture

## Overview

OrbitEngine is a cloud platform where a user opens a chat alongside an engine, links their GitHub, and the engine reads/writes repositories, PRs, and issues, bootstraps new projects, edits code, runs tests, and pushes fixes. All execution happens cloud-side; the client is a thin chat + status surface.

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Next.js)                 │
│  Landing Page ─► Conversations Layout ─► Chat View  │
│  (sign-in)      (sidebar + list)       (messages,   │
│                                         composer,    │
│                                         sandbox      │
│                                         status)      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│                 SERVER (Next.js API)                 │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Auth.js      │ │ Conversations │ │ Repos API    │ │
│  │ (GitHub OAuth│ │ CRUD + msgs   │ │ (list repos) │ │
│  │  + sessions) │ │              │ │              │ │
│  └──────┬──────┘ └──────┬───────┘ └──────┬───────┘ │
│         │               │                │          │
│  ┌──────▼───────────────▼────────────────▼───────┐  │
│  │              lib/ (shared modules)             │  │
│  │  db.ts │ github.ts │ sandbox.ts │ api.ts      │  │
│  └───┬────────┬──────────┬───────────────────────┘  │
│      │        │          │                          │
└──────┼────────┼──────────┼──────────────────────────┘
       │        │          │
       ▼        ▼          ▼
┌──────────┐ ┌─────────┐ ┌─────────────────────────┐
│ Postgres │ │ GitHub  │ │ Vercel Sandbox           │
│ (Auth.js │ │ App API │ │ (Firecracker microVMs)   │
│  + state)│ │ (JWT +  │ │  - Persistent filesystem │
│          │ │  inst.  │ │  - GITHUB_TOKEN env var  │
│          │ │  token) │ │  - Agent clones repos    │
└──────────┘ └─────────┘ └─────────────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 16 (App Router) | Vercel platform fit, RSC + client components (ADR-0005) |
| Styling | Tailwind CSS v4 | Utility-first, fast iteration |
| Auth | NextAuth v5 (Auth.js) + GitHub provider | Database-backed sessions, Postgres adapter (ADR-0014) |
| Database | PostgreSQL | Conversation/message state, Auth.js adapter (ADR-0011) |
| Sandbox | Vercel Sandbox (`@vercel/sandbox` v3) | Managed Firecracker microVMs, persistent filesystem (ADR-0004) |
| AI Runtime | Vercel AI SDK (planned) | Tool calling, streaming, provider-agnostic (ADR-0006, ADR-0010) |
| AI Provider | OpenZen (planned) | OpenAI-compatible API format (ADR-0010) |
| Language | TypeScript (Node) | Single language across client + server (ADR-0003) |
| Deployment | Vercel | Serverless-friendly, stays on platform (ADR-0009) |

## Core Domain Concepts

See `CONTEXT.md` for the full glossary. Key terms:

- **Engine**: The cloud-side worker that does coding work on the user's behalf.
- **Conversation**: A user's chat session. Owns exactly one sandbox for its lifetime.
- **Sandbox**: Isolated, ephemeral execution environment. Only place code runs.

## Architecture Decision Records

All major decisions are captured in `docs/adr/`:

| ADR | Decision |
|-----|----------|
| 0001 | One sandbox per conversation, spawned on open, destroyed on close |
| 0002 | GitHub App + OAuth Web Application Flow |
| 0003 | TypeScript/Node stack |
| 0004 | Vercel Sandbox (Firecracker microVMs) |
| 0005 | Next.js App Router frontend |
| 0006 | Vercel AI SDK for agent runtime |
| 0007 | One repo per conversation |
| 0008 | Engine write surface v1 (issues, PRs, repos) |
| 0009 | Deploy on Vercel |
| 0010 | OpenAI-compatible model access |
| 0011 | Postgres for conversation state |
| 0012 | Short-lived scoped GitHub tokens |
| 0013 | Server-side engine loop; sandbox as execution tool |
| 0014 | Auth.js with GitHub provider |
| 0015 | MVP attach-and-fix loop |
| 0016 | Conversation history persists; only sandbox dies |
| 0017 | Per-conversation model selection |
| 0018 | User-managed skills |
| 0019 | agent-browser in sandbox |
| 0020 | Server-side engine-step persistence |
| 0021 | Observability: trace store |
| 0022 | Software factory |

## Data Model

### PostgreSQL Schema

```
users
  id (PK, UUID)
  name, email, emailVerified, image

accounts (OAuth provider links)
  id (PK), userId (FK→users), provider, providerAccountId, tokens...

sessions (database-backed)
  id (PK), sessionToken, userId (FK→users), expires

conversations
  id (PK, UUID)
  userId (FK→users)
  sandboxId (TEXT, Vercel Sandbox name)
  status ('open' | 'closed')
  provider (TEXT, nullable — per-conversation model provider)
  model (TEXT, nullable — per-conversation model id)
  mode (TEXT NOT NULL DEFAULT 'build' — 'plan' | 'build')
  createdAt, updatedAt

messages
  id (PK, UUID)
  conversationId (FK→conversations)
  role ('user' | 'assistant' | 'system')
  content (TEXT)
  parts (JSONB — full-fidelity UIMessage parts)
  phase (TEXT, nullable — engine work phases)
  createdAt

settings
  userId (PK, FK→users)
  data (JSONB — default model/mode, loop params)

provider_keys
  userId + provider (composite PK)
  encryptedKey, keyHint

skills
  id (PK, UUID)
  userId (FK→users)
  name (unique per user)
  content (Markdown)
  declaredTools (JSONB, default [])
  createdAt, updatedAt
```

### Entity Relationships

```
users 1──N conversations 1──N messages
users 1──N accounts
users 1──N sessions
```

## API Routes

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET/POST | `/api/auth/[...nextauth]` | Auth.js session management | Public |
| GET/POST | `/api/settings` | Get/update user settings (default model, mode, loop) | Required |
| PUT/DELETE | `/api/settings/keys/:provider` | Store/remove encrypted provider API keys | Required |
| GET | `/api/models/:provider` | List models for a provider (model picker) | Required |
| GET | `/api/repos` | List GitHub repos accessible to user (for @-mention autocomplete) | Required |
| GET | `/api/skills` | List user's skills | Required |
| POST | `/api/skills` | Create a skill (name + Markdown) | Required |
| GET | `/api/skills/:name` | Fetch a skill by name | Required (owner) |
| PATCH | `/api/skills/:name` | Update skill content / declared tools | Required (owner) |
| DELETE | `/api/skills/:name` | Delete a skill | Required (owner) |
| GET | `/api/conversations` | List user's conversations | Required |
| POST | `/api/conversations` | Create new conversation | Required |
| GET | `/api/conversations/:id` | Fetch conversation + messages | Required (owner) |
| PATCH | `/api/conversations/:id` | Update provider/model/mode | Required (owner) |
| DELETE | `/api/conversations/:id` | Close conversation, destroy sandbox | Required (owner) |
| POST | `/api/conversations/:id/engine` | Run the engine loop, SSE stream response | Required (owner) |
| POST | `/api/conversations/:id/messages` | Send a user message | Required (owner) |
| POST | `/api/conversations/:id/sandbox` | Provision or reopen sandbox | Required (owner) |
| GET | `/api/conversations/:id/monitor/tree` | Sandbox file tree (bounded walk, skips `node_modules`/`.git`) | Required (owner) |
| GET | `/api/conversations/:id/monitor/file?path=…` | Read a sandbox file (1 MB cap, image preview as data URL, path containment) | Required (owner) |
| POST | `/api/conversations/:id/monitor/command` | Run a command, SSE-stream output + exit code (5 min timeout) | Required (owner) |
| GET | `/api/conversations/:id/browser/frame` | Capture live browser frame (JPEG data URL) or `{idle}` | Required (owner) |
| POST | `/api/conversations/:id/browser/start` | Start a browser session on demand | Required (owner) |

## Working Modes

Each conversation has a mode (`plan` \| `build`, default `build`, persisted on
the row and switchable from the prompt box):

| Mode | Tools available | Prompt additions |
|------|-----------------|------------------|
| `build` | All 14 tools incl. GitHub writes and browser | Browsing & verification workflow section |
| `plan` | `read_file`, `list_files` only — no writes, no GitHub actions, no browsing | Strictly read-only plan-mode section |

## Browser Capability

The engine drives [agent-browser](https://github.com/vercel-labs/agent-browser)
(headless Chrome over CDP) **inside the conversation sandbox**:

- Lazy bootstrap on first use: `npm install -g agent-browser` →
  `agent-browser install --with-deps` (the CLI detects the distro's package
  manager itself), guarded against concurrent installs
- Tools: open / snapshot (a11y tree with refs) / click / fill / press /
  verify / close; Build mode only
- Live preview: `GET .../browser/frame` captures a JPEG each poll (~1.5s) for
  the standalone Browser page; session lifecycle = sandbox lifecycle

## Sandbox Lifecycle

```
Open conversation ──► Provision sandbox (Vercel Sandbox SDK)
       │                   │
       │                   ├─ Inject GITHUB_TOKEN (short-lived, scoped)
       │                   └─ Empty filesystem (no repo cloned yet)
       │
       ▼
  User sends "@owner/repo fix the bug"
       │
       ▼
  Engine sees @mention ──► Clones repo via run_command tool
       │                   git clone https://x-access-token:${GITHUB_TOKEN}@github.com/owner/repo.git .
       │
       ▼
  Engine reads/edits files, runs tests in sandbox
       │
       ▼
  When changes are ready:
       ├─ create_pull_request ──► Opens PR on GitHub, returns link
       ├─ create_issue ─────────► Creates issue on GitHub, returns link
       └─ create_repository ──► Creates new repo (bootstrapping)
       │
       ▼
  Stream response back to chat (with PR/issue links)
       │
       ▼
  Close conversation ──► Destroy sandbox (VM + filesystem)
       │                   Conversation + messages remain in Postgres
       ▼
  Reopen conversation ──► Provision fresh sandbox (user re-clones via @mention)
```

## Security Model

- **Auth**: NextAuth v5 with GitHub OAuth provider, database-backed sessions (ADR-0014).
- **GitHub tokens**: Short-lived, per-conversation, scoped installation tokens — never long-lived app or user tokens (ADR-0012). Injected as `GITHUB_TOKEN` env var in sandbox.
- **Sandbox isolation**: Each sandbox runs in its own Firecracker microVM with dedicated kernel, network, filesystem (ADR-0004).
- **Ownership checks**: Every API route verifies `session.user.id` matches the conversation's `userId`.
- **No secrets in client**: All GitHub App credentials, DB URLs, and tokens stay server-side.

## UI Components

| Component | Path | Type | Purpose |
|-----------|------|------|---------|
| Root layout | `app/layout.tsx` | Server | Geist font, Providers wrapper |
| Landing page | `app/page.tsx` | Server | Sign-in or redirect to conversations |
| Providers | `app/providers.tsx` | Client | SessionProvider wrapper |
| Conversations layout | `app/conversations/layout.tsx` | Server | Auth-gated with sidebar |
| Conversations list | `app/conversations/page.tsx` | Server | Empty state or "New conversation" |
| Sidebar | `app/conversations/sidebar.tsx` | Server | Conversation list, user info, sign-out |
| Conversation page | `app/conversations/[id]/page.tsx` | Server | Chat view: header, messages, composer, Browser + Monitor buttons |
| Sandbox status | `app/conversations/[id]/sandbox-status.tsx` | Client | Auto-provision, status badge, close/reopen |
| Streaming chat | `app/conversations/[id]/streaming-chat.tsx` | Client | Chat messages, @-mention repo picker, engine tool display (file/GitHub/browser cards) |
| Mode picker | `app/conversations/[id]/mode-picker.tsx` | Client | Plan/Build switch in the prompt box footer (`⌘I`), persisted via PATCH |
| Model picker | `app/conversations/[id]/model-picker.tsx` | Client | Per-conversation provider + model selection |
| Monitor page | `app/conversations/[id]/monitor/page.tsx` | Server | Sandbox monitor: auth-gated, closed/provisioning states |
| Monitor panel | `app/conversations/[id]/monitor/monitor-panel.tsx` | Client | FileTree + Artifact file viewer (text + images) + Terminal command runner |
| Browser page | `app/conversations/[id]/browser/page.tsx` | Server | Live browser view: auth-gated shell |
| Browser view | `app/conversations/[id]/browser/browser-view.tsx` | Client | Idle → Starting → Live states; screenshot polling, pause/resume, URL strip |
| Settings page | `app/settings/page.tsx` + `settings-client.tsx` | Server/Client | Provider API keys (encrypted at rest), default model & loop params |

## What's Built vs. What's Next

### Fully Implemented
1. Auth system (GitHub OAuth, Postgres sessions)
2. Conversation CRUD (create, list, fetch, patch, close, reopen)
3. Message system (send, display, persist — server-side per-step persistence)
4. GitHub integration (App JWT, installation tokens, repo listing for @-mention)
5. Sandbox provisioning (Vercel Sandbox, persistent VMs, GITHUB_TOKEN injection)
6. Engine loop (Vercel AI SDK, tool calling: run_command, read_file, write_file, list_files)
7. Agent-driven repo cloning (user types @owner/repo, agent clones via system prompt)
8. GitHub write tools (create_pull_request, create_issue, create_repository)
9. UI shell (landing page, conversations layout, sidebar, chat view, @-mention autocomplete)
10. Database schema (7 tables, indexes)
11. Architecture documentation (22 ADRs, domain glossary)
12. Sandbox monitor (file tree, file viewer with image previews, command runner)
13. Durable engine-step persistence (ADR-0020)
14. Per-conversation model selection with encrypted provider keys (ADR-0017, T02/T04)
15. Plan/Build working modes with tool gating (T03)
16. Live browser capability via agent-browser + standalone browser preview (T05)
17. User-managed skills: skills table, Settings CRUD, `/skillname` invocation injecting skill Markdown into the engine context in Build mode (T07)

### Not Yet Built (see docs/v2.md and the issue tracker)
- Create skill from conversation (T08), skill browser-tool bundling (T09)
- Observability trace store + live traces view (T10)
- Software factory: config/run engine (T11/T12) and ops dashboard (T13)
