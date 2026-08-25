CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMP(3),
  image TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP(3) NOT NULL,
  UNIQUE (identifier, token)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "sandboxId" TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  parts JSONB,
  phase TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'build';
-- Snapshot of the sandbox filesystem taken when the conversation is closed,
-- used to restore workspace state on reopen (see ADR-0016).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "snapshotId" TEXT;

CREATE TABLE IF NOT EXISTS settings (
  "userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_keys (
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "keyHint" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", provider)
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS parts JSONB;

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  "declaredTools" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("userId", name)
);

CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations ("userId");
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages ("conversationId");
CREATE INDEX IF NOT EXISTS skills_user_idx ON skills ("userId");

-- Trace store (ADR-0021). Dedicated store for engine activity so timing
-- and context data do not bloat chat message parts.
CREATE TABLE IF NOT EXISTS trace_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  "factoryRunId" TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  mode TEXT,
  skills JSONB NOT NULL DEFAULT '[]',
  "stepCount" INTEGER NOT NULL DEFAULT 0,
  "totalMs" INTEGER,
  "inputTokens" BIGINT,
  "outputTokens" BIGINT,
  status TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "finishedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS trace_spans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL REFERENCES trace_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  tool TEXT NOT NULL,
  phase TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  input JSONB,
  output JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trace_runs_conversation_idx ON trace_runs ("conversationId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS trace_spans_run_idx ON trace_spans ("runId", seq);

-- Software factory (ADR-0022, ADR-0024). A factory is a per-repo config that
-- polls open issues; each issue becomes a factory run driven by a step graph.
CREATE TABLE IF NOT EXISTS factories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "repoFullName" TEXT NOT NULL,
  "labelFilter" JSONB NOT NULL DEFAULT '[]',
  provider TEXT,
  model TEXT,
  mode TEXT NOT NULL DEFAULT 'build',
  "checkCommand" TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("userId", "repoFullName")
);

-- One run per (factory, issue). Postgres is the queue: dedupe via UNIQUE,
-- claiming via atomic UPDATE ... WHERE state='queued' (FOR UPDATE SKIP LOCKED).
CREATE TABLE IF NOT EXISTS factory_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "factoryId" TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  "issueNumber" INTEGER NOT NULL,
  "issueTitle" TEXT NOT NULL,
  "issueUrl" TEXT NOT NULL,
  type TEXT,
  state TEXT NOT NULL DEFAULT 'queued',
  branch TEXT,
  "prNumber" INTEGER,
  "prUrl" TEXT,
  error TEXT,
  "sandboxId" TEXT,
  "traceRunId" TEXT,
  variant TEXT,
  "startedAt" TIMESTAMPTZ,
  "finishedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("factoryId", "issueNumber")
);

-- The step graph, persisted (ADR-0024). Ground truth of where a run is;
-- factory_runs.state is the rollup shown in the dashboard.
CREATE TABLE IF NOT EXISTS factory_run_steps (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL REFERENCES factory_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verdict JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMPTZ,
  "finishedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factories_user_idx ON factories ("userId");
CREATE INDEX IF NOT EXISTS factory_runs_queue_idx ON factory_runs (state, "createdAt");
CREATE INDEX IF NOT EXISTS factory_runs_factory_idx ON factory_runs ("factoryId", "issueNumber");
CREATE INDEX IF NOT EXISTS factory_run_steps_run_idx ON factory_run_steps ("runId", seq);