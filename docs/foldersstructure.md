# OrbitEngine — Folder Structure

> Generated 2026-08-23 · reflects v2 codebase (T01–T08, T10 built; T06/T09/T11–T13 open)

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
│   │   │       ├── traces/
│   │   │       │   └── route.ts      # GET — trace runs + spans for the conversation (ADR-0021)
│   │   │       ├── browser/
│   │   │       │   ├── frame/route.ts  # GET — live browser frame (JPEG data URL) or {idle}
│   │   │       │   └── start/route.ts  # POST — start a browser session on demand
│   │   │       └── monitor/
│   │   │           ├── tree/
│   │   │           │   └── route.ts  # GET — sandbox file tree (bounded walk)
│   │   │           ├── file/
│   │   │           │   └── route.ts  # GET — read sandbox file (1 MB cap, binary detection)
│   │   │           └── command/
│   │   │               └── route.ts  # POST — run command, SSE stream output + exit code
│   │   ├── github/
│   │   │   └── installation-status/
│   │   │       └── route.ts          # GET — is the GitHub App installed? returns install URL if not
│   │   ├── models/[provider]/
│   │   │   └── route.ts              # GET — live model list for a provider
│   │   ├── repos/
│   │   │   └── route.ts              # GET — repos for @-mention autocomplete
│   │   ├── settings/
│   │   │   ├── route.ts              # GET/PUT — user settings (default model/mode, loop params)
│   │   │   └── keys/[provider]/
│   │   │       └── route.ts          # PUT/DELETE — encrypted provider API keys
│   │   └── skills/
│   │       ├── route.ts              # GET/POST — skill library
│   │       └── [name]/
│   │           └── route.ts          # GET/PATCH/DELETE — single skill (owner only)
│   └── conversations/
│       ├── layout.tsx                # Auth gate + sidebar shell (+ InstallBanner)
│       ├── page.tsx                  # Empty state or "New conversation" prompt
│       ├── sidebar.tsx               # Conversation list, user info, sign-out
│       └── [id]/
│           ├── page.tsx              # Chat view: header, sandbox status, Monitor/Browser links
│           ├── streaming-chat.tsx    # Client: useChat, message stream, tool-card rendering
│           ├── composer.tsx          # Client: prompt input, model/mode pickers, @-mention + /skill pickers
│           ├── engine-tool-call.tsx  # Client: engine tool-call cards in the stream
│           ├── sandbox-status.tsx    # Client: provisioning/ready/closed badges, close/reopen
│           ├── mode-picker.tsx       # Client: Plan/Build switch (⌘I), persisted via PATCH
│           ├── model-picker.tsx      # Client: per-conversation provider + model selection
│           ├── message-composer.tsx  # Unused (dead code — see Findings)
│           ├── monitor/
│           │   ├── page.tsx          # Auth gate, renders MonitorPanel
│           │   └── monitor-panel.tsx # Client: FileTree + Artifact viewer + Terminal
│           ├── browser/
│           │   ├── page.tsx          # Auth-gated Browser shell
│           │   └── browser-view.tsx  # Client: screenshot polling, pause/resume, URL strip
│           └── traces/
│               ├── page.tsx          # Auth gate + trace list for the conversation
│               └── trace-run-card.tsx# Client: colored timeline, badges, shiki span details
│
├── components/
│   ├── ai-elements/                  # Chat rendering primitives
│   │   ├── artifact.tsx              # Artifact viewer shell
│   │   ├── code-block.tsx            # Shiki syntax-highlighted code block
│   │   ├── conversation.tsx          # Scrollable conversation container
│   │   ├── file-tree.tsx             # Interactive file tree (folders + files)
│   │   ├── message.tsx               # Message bubble wrapper
│   │   ├── model-selector.tsx        # Provider/model dropdown primitive
│   │   ├── prompt-input.tsx          # Composer primitives (PromptInput family)
│   │   ├── reasoning.tsx             # Collapsible reasoning block
│   │   ├── shimmer.tsx               # Loading shimmer animation
│   │   ├── terminal.tsx              # Terminal output with ANSI rendering
│   │   └── tool.tsx                  # Collapsible tool-call card
│   ├── github/
│   │   └── install-banner.tsx        # Amber banner + install link when GitHub App not installed
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
│   └── schema.sql                    # Idempotent Postgres schema (11 tables)
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
│   │   ├── 0022-software-factory.md                 # v2 ADR
│   │   └── 0023-settings-store-provider-keys.md     # v2 ADR
│   ├── agents/
│   │   ├── domain.md                 # Domain glossary for agent context
│   │   ├── issue-tracker.md          # Issue tracker conventions
│   │   └── triage-labels.md          # Triage label vocabulary
│   └── research/
│       └── 2026-08-20-vercel-browser-agent.md
│
├── lib/                              # Server modules
│   ├── ai.ts                         # OpenAI-compatible provider setup (OpenZen)
│   ├── api.ts                        # apiFetch helper (server-to-server with cookies)
│   ├── browser.ts                    # agent-browser bootstrap + frame capture in sandbox
│   ├── crypto.ts                     # AES-256-GCM encryption for provider keys
│   ├── db.ts                         # Postgres pool (AUTH_DATABASE_URL || DATABASE_URL)
│   ├── engine.ts                     # Engine tools (14) + SYSTEM_PROMPT, mode gating
│   ├── github.ts                     # GitHub App JWT, installation tokens, repo listing, install status
│   ├── messages.ts                   # Message persistence (save/list/convert)
│   ├── sandbox.ts                    # Sandbox lifecycle, file tree walk, file reader
│   ├── settings.ts                   # User settings + provider key storage/retrieval
│   ├── skills.ts                     # Skill CRUD + /skillname resolution for engine context
│   ├── traces.ts                     # Trace store: startTraceRun/recordCompletedSpans/finishTraceRun/list
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
| GET | `/api/conversations/:id/browser/frame` | `app/api/conversations/[id]/browser/frame/route.ts` | Live browser frame (JPEG data URL) or `{idle}` |
| POST | `/api/conversations/:id/browser/start` | `app/api/conversations/[id]/browser/start/route.ts` | Start a browser session on demand |
| GET | `/api/conversations/:id/traces` | `app/api/conversations/[id]/traces/route.ts` | Trace runs + spans (ADR-0021) |
| GET | `/api/github/installation-status` | `app/api/github/installation-status/route.ts` | GitHub App installed? + install URL |
| GET | `/api/models/:provider` | `app/api/models/[provider]/route.ts` | Live model list for provider |
| GET/PUT | `/api/settings` | `app/api/settings/route.ts` | User settings (default model/mode, loop) |
| PUT/DELETE | `/api/settings/keys/:provider` | `app/api/settings/keys/[provider]/route.ts` | Encrypted provider API keys |
| GET/POST | `/api/skills` | `app/api/skills/route.ts` | Skill library list/create |
| GET/PATCH/DELETE | `/api/skills/:name` | `app/api/skills/[name]/route.ts` | Single skill CRUD (owner only) |

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
| `settings.ts` | User settings + encrypted provider key storage |
| `skills.ts` | Skill CRUD + `/skillname` resolution for engine context |
| `traces.ts` | Trace store writes/reads (startTraceRun, recordCompletedSpans, finishTraceRun, listConversationTraces) |
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
| `conversations` | id (UUID PK), userId (FK→users), sandboxId, status, provider, model, mode, createdAt, updatedAt | `status`: `open`/`closed`; `mode`: `plan`/`build` |
| `messages` | id (UUID PK), conversationId (FK→conversations), role, content, parts (JSONB), phase, createdAt | Server-side per-step persistence (ADR-0020) |
| `settings` | userId (PK, FK→users), data (JSONB) | Default model/mode, loop params |
| `provider_keys` | userId + provider (composite PK), encryptedKey, keyHint | AES-256-GCM encrypted at rest |
| `skills` | id (UUID PK), userId (FK→users), name, content (Markdown), declaredTools (JSONB) | Unique name per user |
| `trace_runs` | id (TEXT PK), conversationId (FK→conversations, nullable), factoryRunId, provider, model, mode, skills, stepCount, totalMs, tokens, status, startedAt/finishedAt | One row per engine run (ADR-0021) |
| `trace_spans` | id (TEXT PK), runId (FK→trace_runs CASCADE), seq, tool, phase, startedAt, durationMs, input/output (JSONB) | One row per completed tool step |

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

`app/conversations/[id]/message-composer.tsx` exports `MessageComposer` but is **imported nowhere** in the app. It references a `PATCH /api/conversations/:id` endpoint that now exists (GET/PATCH/DELETE are implemented), but the component itself remains unused — superseded by `composer.tsx`. Safe to delete.

### 3. `scripts/` is empty

The `scripts/` directory exists at the repo root but contains no files.

### 4. ADRs 0017–0023: status

v2 ADRs 0017–0021 are implemented (model selection, skills, browser-in-sandbox, step persistence, traces). 0022 (software factory) and the ops dashboard remain open as issues T11–T13; 0023 (settings store) is built.

### 5. Persistence is server-side now

Message persistence moved server-side per ADR-0020 (T01): the engine loop writes each step durably. The earlier client-only `onFinish` gap is closed.
