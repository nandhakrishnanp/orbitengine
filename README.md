# OrbitEngine

Chat alongside a coding engine, wired to your GitHub. OrbitEngine is a cloud
platform where you open a conversation, and the engine — running entirely in
the cloud, in an isolated sandbox per conversation — reads your code, makes
changes, runs the tests, and hands back a pull request.

**You only ever talk in chat and review the result.** Nothing runs on your
machine; your local repo is never touched.

## What's Working

- **GitHub sign-in** (Auth.js) with sessions persisted in Postgres
- **Conversations** that persist across visits, with full chat history
- **Engine loop** powered by Vercel AI SDK with tool calling:
  - `run_command` — execute shell commands in the sandbox
  - `read_file` / `write_file` / `list_files` — work with the filesystem
  - `create_pull_request` — open a PR on GitHub when changes are ready
  - `create_issue` — create issues from chat
  - `create_repository` — bootstrap new projects
- **Agent-driven repo cloning** — type `@owner/repo` in chat and the engine clones it
- **@-mention autocomplete** — pick repos from your GitHub installations
- **Streaming responses** with collapsible reasoning and tool call cards
- **Sandbox lifecycle** — each conversation gets its own ephemeral Firecracker microVM
- **Sandbox monitor** — per-conversation view of the sandbox: file tree, file
  viewer with syntax highlighting, and a command runner with live streaming
  output (`/conversations/:id/monitor`)

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Tailwind), deployed on Vercel
- **Auth.js** (next-auth) with the GitHub provider; **PostgreSQL** session store
  via `@auth/pg-adapter`
- **Vercel Sandbox SDK** — one ephemeral sandbox per conversation
- **Vercel AI SDK** — server-side engine loop with tool calling and streaming
- **OpenZen** — OpenAI-compatible AI provider

## Getting Started

Prerequisites: **Node 24+**, **Docker** (for the local Postgres).

### 1. Install

```bash
npm install
```

### 2. Postgres

```bash
docker run -d --name orbitengine-postgres \
  -e POSTGRES_USER=orbitengine -e POSTGRES_PASSWORD=orbitengine \
  -e POSTGRES_DB=orbitengine -p 5433:5432 postgres:16-alpine

# create the schema (idempotent)
Get-Content db/schema.sql | docker exec -i orbitengine-postgres \
  psql -U orbitengine -d orbitengine -v ON_ERROR_STOP=1
```

### 3. GitHub App

1. Create an app at `https://github.com/settings/apps/new`.
2. Set the **Callback URL** to `http://localhost:3001/api/auth/callback/github`
   and enable **Request user authorization (OAuth) during installation**.
3. The **Webhook URL is not needed** — the engine works over the API. Leave
   webhooks inactive (placeholder URL is fine).
4. Copy the app's **Client ID** and **Client Secret**.

### 4. Environment

```bash
cp .env.example .env.local   # then fill in AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
```

`.env.local` is gitignored — secrets are never committed.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3001, sign in with GitHub, and start a conversation.

## Project Layout

```
app/                    Next.js App Router (pages + /api endpoints)
  api/                  REST endpoints (auth, conversations, repos, monitor)
  conversations/        conversation list + chat UI + sandbox monitor
auth.ts                 Auth.js config (GitHub provider, Postgres adapter)
db/schema.sql           Idempotent Postgres schema
lib/
  ai.ts                 OpenZen AI client
  engine.ts             System prompt + engine tools (run, read, write, PR, issue, repo)
  github.ts             GitHub App JWT, installation tokens, repo listing
  sandbox.ts            Vercel Sandbox lifecycle
docs/
  adr/                  Architecture Decision Records (0001–0016)
  architecture.md       System architecture overview
  PRD.md                Product requirements document
CONTEXT.md              Domain glossary
```

## License

Not yet licensed — contact the maintainers before reuse.
