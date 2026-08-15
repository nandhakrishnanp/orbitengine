# OrbitEngine

Chat alongside a coding engine, wired to your GitHub. OrbitEngine is a cloud
platform where you open a conversation, attach one of your repositories, and the
engine — running entirely in the cloud, in an isolated sandbox per conversation —
reads the code, makes changes, runs the tests, and hands back a pull request.

**You only ever talk in chat and review the result.** Nothing runs on your
machine; your local repo is never touched.

## Status

Early MVP. Live today:

- GitHub sign-in (Auth.js) with sessions persisted in Postgres — you stay signed
  in across visits
- Conversations you can start, list, reopen, and send messages into; everything
  persists and survives reloads

On the way: attach a repository, the sandboxed engine loop (read / edit / test
/ push), open PRs, create issues, and bootstrap brand-new projects.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind), deployed on Vercel
- **Auth.js** (next-auth) with the GitHub provider; **PostgreSQL** session store
  via `@auth/pg-adapter`
- **PostgreSQL** for conversations and messages
- Planned: Vercel Sandbox SDK (one ephemeral sandbox per conversation) and the
  Vercel AI SDK (server-side engine loop)

## Getting started

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

## Project layout

```
app/                    Next.js App Router (pages + /api endpoints)
  api/                  REST endpoints (auth, conversations, messages)
  conversations/        conversation list + detail UI
auth.ts                 Auth.js config (GitHub provider, Postgres adapter)
db/schema.sql           Idempotent Postgres schema (auth, conversations, messages)
lib/                    db pool, API fetch helpers
docs/adr/               Architecture Decision Records (0001–0016)
CONTEXT.md              Domain glossary
```

## License

Not yet licensed — contact the maintainers before reuse.