# OrbitEngine — Folder Structure

> Generated 2026-08-21 · reflects v1 (MVP) codebase

## Tree Overview

```
orbitengine/
├── app/                              # Next.js App Router (pages + API routes)
│   ├── favicon.ico
│   ├── globals.css                   # Tailwind imports + global styles
│   ├── layout.tsx                    # Root layout (Geist fonts, Providers wrapper)
│   ├── page.tsx                      # Landing page / redirect to /conversations
│   ├── providers.tsx                 # Client: SessionProvider + TooltipProvider
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   │   └── route.ts              # Auth.js catch-all (session management)
│   │   ├── conversations/
│   │   │   ├── route.ts              # GET (list) + POST (create) conversations
│   │   │   └── [id]/
│   │   │       ├── route.ts          # GET (fetch) + DELETE (close/destroy) conversation
│   │   │       ├── engine/
│   │   │       │   └── route.ts      # POST — server-side engine loop, SSE stream
│   │   │       ├── messages/
│   │   │       │   └── route.ts      # POST — persist user/assistant messages
│   │   │       ├── sandbox/
│   │   │       │   └── route.ts      # POST — provision or reopen sandbox
│   │   │       └── monitor/
│   │   │           ├── tree/
│   │   │           │   └── route.ts  # GET — sandbox file tree (bounded walk)
│   │   │           ├── file/
│   │   │           │   └── route.ts  # GET — read sandbox file (1 MB cap, binary detection)
│   │   │           └── command/
│   │   │               └── route.ts  # POST — run command, SSE stream output + exit code
│   │   └── repos/
│   │       └── route.ts              # GET — repos for @-mention autocomplete
│   └── conversations/
│       ├── layout.tsx                # Auth gate + sidebar shell
│       ├── page.tsx                  # Empty state or "New conversation" prompt
│       ├── sidebar.tsx               # Conversation list, user info, sign-out
│       └── [id]/
│           ├── page.tsx              # Chat view: header, sandbox status, Monitor link
│           ├── streaming-chat.tsx    # Client: useChat, @-mention picker, tool cards
│           ├── sandbox-status.tsx    # Client: provisioning/ready/closed badges, close/reopen
│           ├── message-composer.tsx  # Unused (dead code — see Findings)
│           └── monitor/
│               ├── page.tsx          # Auth gate, renders MonitorPanel
│               └── monitor-panel.tsx # Client: FileTree + Artifact viewer + Terminal
│
├── components/
│   ├── ai-elements/                  # Chat rendering primitives
│   │   ├── artifact.tsx              # Artifact viewer shell
│   │   ├── code-block.tsx            # Shiki syntax-highlighted code block
│   │   ├── conversation.tsx          # Scrollable conversation container
│   │   ├── file-tree.tsx             # Interactive file tree (folders + files)
│   │   ├── message.tsx               # Message bubble wrapper
│   │   ├── reasoning.tsx             # Collapsible reasoning block
│   │   ├── shimmer.tsx               # Loading shimmer animation
│   │   ├── terminal.tsx              # Terminal output with ANSI rendering
│   │   └── tool.tsx                  # Collapsible tool-call card
│   ├── landing/
│   │   └── landing-page.tsx          # Unauthenticated landing / sign-in page
│   └── ui/                           # shadcn/ui primitives
│       ├── badge.tsx
│       ├── button.tsx / button-group.tsx
│       ├── collapsible.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       └── tooltip.tsx
│
├── db/
│   └── schema.sql                    # Idempotent Postgres schema (6 tables)
│
├── docs/
│   ├── architecture.md               # System architecture, data model, API routes, UI components
│   ├── PRD.md                        # Product requirements document (v1, approved)
│   ├── v2.md                         # Version 2 spec (9 features)
│   ├── adr/                          # Architecture Decision Records
│   │   ├── 0001-sandbox-per-conversation.md
│   │   ├── 0002-github-app-oauth-flow.md
│   │   ├── 0003-typescript-node-stack.md
│   │   ├── 0004-vercel-sandbox.md
│   │   ├── 0005-nextjs-frontend.md
│   │   ├── 0006-vercel-ai-sdk-agent-runtime.md
│   │   ├── 0007-one-repo-per-conversation.md
│   │   ├── 0008-engine-write-surface-v1.md
│   │   ├── 0009-deploy-on-vercel.md
│   │   ├── 0010-openai-compatible-model-access.md
│   │   ├── 0011-postgres-conversation-state.md
│   │   ├── 0012-short-lived-scoped-tokens.md
│   │   ├── 0013-server-side-engine-loop.md
│   │   ├── 0014-authjs-github-provider.md
│   │   ├── 0015-mvp-attach-and-fix-loop.md
│   │   ├── 0016-conversation-history-persists.md
│   │   ├── 0017-per-conversation-model-selection.md  # v2 ADR
│   │   ├── 0018-user-managed-skills.md              # v2 ADR
│   │   ├── 0019-agent-browser-in-sandbox.md         # v2 ADR
│   │   ├── 0020-server-side-engine-step-persistence.md # v2 ADR
│   │   ├── 0021-observability-trace-store.md        # v2 ADR
│   │   └── 0022-software-factory.md                 # v2 ADR
│   ├── agents/
│   │   ├── domain.md                 # Domain glossary for agent context
│   │   ├── issue-tracker.md          # Issue tracker conventions
│   │   └── triage-labels.md          # Triage label vocabulary
│   └── research/
│       └── 2026-08-20-vercel-browser-agent.md
│
├── lib/                              # Server modules
│   ├── ai.ts                         # OpenZen provider (createOpenAICompatible)
│   ├── api.ts                        # apiFetch helper (server-to-server with cookies)
│   ├── db.ts                         # Postgres pool (AUTH_DATABASE_URL || DATABASE_URL)
│   ├── engine.ts                     # Engine tools (7) + SYSTEM_PROMPT
│   ├── github.ts                     # GitHub App JWT, installation tokens, repo listing
│   ├── messages.ts                   # Message persistence (save/list/convert)
│   ├── sandbox.ts                    # Sandbox lifecycle, file tree walk, file reader
│   └── utils.ts                      # cn() — Tailwind class merge utility
│
├── media/                            # Screenshots
│   ├── chat.png
│   └── filemonitor.png
│
├── public/                           # Static assets
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
│
├── scripts/                          # Empty
│
├── .agents/skills/                   # opencode skills (ai-elements component library)
│   └── ai-elements/
│       ├── SKILL.md
│       ├── references/               # 50+ component docs (agent, artifact, tool, …)
│       └── scripts/                  # Component example scripts
│
├── .vercel/                          # Vercel deployment config
│   ├── project.json
│   └── README.txt
│
├── auth.ts                           # NextAuth config (GitHub provider + Postgres adapter)
├── components.json                   # shadcn/ui component config
├── next.config.ts                    # Next.js config (empty)
├── tsconfig.json                     # TypeScript config
├── postcss.config.mjs                # PostCSS/Tailwind config
├── eslint.config.mjs                 # ESLint config
├── package.json                      # Dependencies and scripts
├── package-lock.json
├── .env.example                      # Env var template
├── .env.local                        # Local env (gitignored)
├── .gitignore
├── LICENSE                           # MIT
├── README.md
├── AGENTS.md                         # Agent instructions (repo context)
├── CONTEXT.md                        # Domain glossary (engine, sandbox, conversation…)
└── orbitengine77.2026-08-16.private-key.pem  # GitHub App key (gitignored)
```

## API Routes

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET/POST | `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | Auth.js session management |
| GET | `/api/repos` | `app/api/repos/route.ts` | List repos for @-mention autocomplete |
| GET | `/api/conversations` | `app/api/conversations/route.ts` | List user's conversations (title = first user message) |
| POST | `/api/conversations` | `app/api/conversations/route.ts` | Create new conversation |
| GET | `/api/conversations/:id` | `app/api/conversations/[id]/route.ts` | Fetch conversation + messages |
| DELETE | `/api/conversations/:id` | `app/api/conversations/[id]/route.ts` | Close conversation, destroy sandbox |
| POST | `/api/conversations/:id/engine` | `app/api/conversations/[id]/engine/route.ts` | Run engine loop, SSE stream response |
| POST | `/api/conversations/:id/messages` | `app/api/conversations/[id]/messages/route.ts` | Persist user/assistant message |
| POST | `/api/conversations/:id/sandbox` | `app/api/conversations/[id]/sandbox/route.ts` | Provision or reopen sandbox |
| GET | `/api/conversations/:id/monitor/tree` | `app/api/conversations/[id]/monitor/tree/route.ts` | Sandbox file tree |
| GET | `/api/conversations/:id/monitor/file?path=` | `app/api/conversations/[id]/monitor/file/route.ts` | Read sandbox file |
| POST | `/api/conversations/:id/monitor/command` | `app/api/conversations/[id]/monitor/command/route.ts` | Run command, SSE stream output |

## lib/ Modules

| File | Purpose |
|------|---------|
| `ai.ts` | OpenAI-compatible provider setup (OpenZen `hy3-free` model) |
| `api.ts` | `apiFetch()` — server-to-server HTTP helper, forwards cookies |
| `db.ts` | Postgres connection pool via `pg` |
| `engine.ts` | Defines all 7 engine tools (`run_command`, `read_file`, `write_file`, `list_files`, `create_pull_request`, `create_issue`, `create_repository`) and the system prompt |
| `github.ts` | GitHub App JWT creation, installation token exchange, repo listing |
| `messages.ts` | Message persistence: `saveUserMessage`, `saveAssistantMessage`, `listConversationMessages`, `toUIMessage` |
| `sandbox.ts` | Vercel Sandbox lifecycle: provision, destroy, get; file tree walk, file reader, sandbox naming |
| `utils.ts` | `cn()` — Tailwind class merge (clsx + twMerge) |

## UI Components

| File | Type | Purpose |
|------|------|---------|
| `components/ai-elements/message.tsx` | Client | Message bubble (from: user/assistant) |
| `components/ai-elements/reasoning.tsx` | Client | Collapsible reasoning block |
| `components/ai-elements/terminal.tsx` | Client | ANSI terminal output rendering |
| `components/ai-elements/tool.tsx` | Client | Collapsible tool-call card |
| `components/ai-elements/code-block.tsx` | Client | Shiki syntax-highlighted code |
| `components/ai-elements/file-tree.tsx` | Client | Interactive file tree navigation |
| `components/ai-elements/artifact.tsx` | Client | File viewer with header/actions |
| `components/ai-elements/conversation.tsx` | Client | Scrollable message list |
| `components/ai-elements/shimmer.tsx` | Client | Loading shimmer animation |
| `components/landing/landing-page.tsx` | Server | Unauthenticated landing page |
| `components/ui/*` | Client | shadcn/ui primitives (badge, button, collapsible, select, separator, tooltip) |

## Database Schema (`db/schema.sql`)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id (UUID PK), name, email, emailVerified, image | Auth.js managed |
| `accounts` | id, userId (FK→users), provider, providerAccountId, tokens | OAuth provider links |
| `sessions` | id, sessionToken, userId (FK→users), expires | Database-backed sessions |
| `verification_token` | identifier, token, expires | OAuth state verification |
| `conversations` | id (UUID PK), userId (FK→users), sandboxId, status, createdAt, updatedAt | `status`: `open` or `closed` |
| `messages` | id (UUID PK), conversationId (FK→conversations), role, content, parts (JSONB), phase, createdAt | `phase` is nullable, currently unused |

## Findings

While reading the full codebase, several observations surfaced:

### 1. `attachedRepository` column mismatch

`app/api/conversations/[id]/engine/route.ts:30` queries:

```sql
SELECT id, "sandboxId", "attachedRepository"
FROM conversations WHERE id = $1 AND "userId" = $2
```

But `db/schema.sql` has **no `attachedRepository` column** on the `conversations` table. This means every engine call hits a SQL error → returns 500. Either the local DB was migrated manually outside the schema file, or the engine route is broken as committed.

### 2. `message-composer.tsx` is dead code

`app/conversations/[id]/message-composer.tsx` exports `MessageComposer` but is **imported nowhere** in the app. It references a `PATCH /api/conversations/:id` endpoint that doesn't exist (only GET and DELETE are implemented). This is leftover from the earlier "attach repository" approach (issue #4) and was superseded by agent-driven cloning via `@owner/repo`.

### 3. `scripts/` is empty

The `scripts/` directory exists at the repo root but contains no files.

### 4. ADRs 0017–0022 are written but unimplemented

Six v2 ADRs exist (`docs/adr/0017` through `0022`) covering model selection, skills, browser-in-sandbox, step persistence, traces, and factory — all specs written ahead of the v2 implementation. These correspond directly to features in `docs/v2.md`.

### 5. Persistence is client-driven only

Message persistence (`streaming-chat.tsx:310–328`) fires only on the client's `onFinish` callback. If the client disconnects mid-stream, the assistant message is lost. The `phase` column in `messages` is never written. This is the core bug v2's durable persistence (ADR-0020) is designed to fix.
