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
│          │ │  inst.  │ │  - Git clone of repo     │
│          │ │  token) │ │  - GITHUB_TOKEN env var  │
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
- **Attached Repository**: Single repo a conversation works on. The sandbox clones it.

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
  attachedRepository (TEXT, e.g. "owner/repo")
  sandboxId (TEXT, Vercel Sandbox name)
  status ('open' | 'closed')
  createdAt, updatedAt

messages
  id (PK, UUID)
  conversationId (FK→conversations)
  role ('user' | 'assistant' | 'system')
  content (TEXT)
  phase (TEXT, nullable — for engine work phases)
  createdAt
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
| GET | `/api/repos` | List GitHub repos accessible to user | Required |
| GET | `/api/conversations` | List user's conversations | Required |
| POST | `/api/conversations` | Create new conversation | Required |
| GET | `/api/conversations/:id` | Fetch conversation + messages | Required (owner) |
| PATCH | `/api/conversations/:id` | Attach a repository | Required (owner) |
| DELETE | `/api/conversations/:id` | Close conversation, destroy sandbox | Required (owner) |
| POST | `/api/conversations/:id/messages` | Send a user message | Required (owner) |
| POST | `/api/conversations/:id/sandbox` | Provision or reopen sandbox | Required (owner) |

## Sandbox Lifecycle

```
Open conversation ──► Provision sandbox (Vercel Sandbox SDK)
       │                   │
       │                   ├─ Clone attached repo (if any)
       │                   ├─ Inject GITHUB_TOKEN (short-lived, scoped)
       │                   └─ Inject ATTACHED_REPOSITORY env var
       │
       ▼
  User sends message ──► Store in Postgres ──► [Engine loop — not yet built]
       │                                              │
       │                                              ▼
       │                                     Execute in sandbox
       │                                     (read/write files, run tests)
       │                                              │
       │                                              ▼
       │                                     Stream response back to chat
       │
       ▼
  Close conversation ──► Destroy sandbox (VM + filesystem)
       │                   Conversation + messages remain in Postgres
       ▼
  Reopen conversation ──► Provision fresh sandbox (same attached repo)
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
| Conversation page | `app/conversations/[id]/page.tsx` | Server | Chat view: header, messages, composer |
| Sandbox status | `app/conversations/[id]/sandbox-status.tsx` | Client | Auto-provision, status badge, close/reopen |
| Message composer | `app/conversations/[id]/message-composer.tsx` | Client | @-mention repo picker, send message |

## What's Built vs. What's Next

### Fully Implemented
1. Auth system (GitHub OAuth, Postgres sessions)
2. Conversation CRUD (create, list, fetch, attach repo, close, reopen)
3. Message system (send, display, persist)
4. GitHub integration (App JWT, installation tokens, repo listing)
5. Sandbox provisioning (Vercel Sandbox, persistent VMs, env injection, git clone)
6. UI shell (landing page, conversations layout, sidebar, chat view, @-mention composer)
7. Database schema (6 tables, indexes)
8. Architecture documentation (16 ADRs, domain glossary)

### Not Yet Built (Issue #5 scope and beyond)
- **Engine loop**: Vercel AI SDK agent runtime with tool calling and streaming (ADR-0006, ADR-0013)
- **AI provider integration**: OpenZen via Vercel AI SDK (ADR-0010)
- **Engine write actions**: Create issues, open PRs, create repos from sandbox (ADR-0008)
- **Message processing engine**: User messages stored but no assistant responses generated yet
- **Streaming responses**: No streaming UI for engine output
- **New project bootstrapping**: Creating repos from scratch (ADR-0015 second slice)
