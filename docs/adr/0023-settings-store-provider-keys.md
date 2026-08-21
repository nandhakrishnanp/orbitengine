# Settings store with provider keys encrypted at rest

## Status

Implemented (T02, issue #22).

## Context

Later features (dynamic model selection T04, GitHub disconnect T06, skills
T07–T09, factory T11–T12) all need a per-user place for global defaults and
credentials. Provider API keys are secrets: they must never be returned to the
client in plaintext (or ciphertext), and must be encrypted at rest so a database
dump alone does not leak them.

## Decision

- **Two tables** in `db/schema.sql`:
  - `settings` — one row per user (`"userId"` PK), `data JSONB` holding global
    defaults: default `model { provider, id }`, `mode`, `loop { maxSteps,
    maxRetries }`. JSONB keeps the shape evolvable without migrations; defaults
    are resolved in code (`lib/settings.ts`) so stored patches stay partial.
  - `provider_keys` — one row per user+provider (composite PK),
    `encryptedKey TEXT`, `keyHint TEXT` (last 4 chars) so the UI can show
    `…abcd` without decrypting.
- **Encryption:** AES-256-GCM from `node:crypto` (already a runtime dependency
  of the codebase; no new packages). Payload format `iv:tag:ciphertext`
  (base64). Key comes from a dedicated `SETTINGS_ENCRYPTION_KEY` env var
  (32 bytes, base64) — independent of `AUTH_SECRET` so auth-secret rotation
  cannot break stored keys.
- **API surface** (first zod-validated routes in the repo):
  - `GET/PUT /api/settings` — read resolved defaults + key metadata; patch
    defaults.
  - `PUT/DELETE /api/settings/keys/[provider]` — add/update/remove a key.
  - Providers accepted upfront: `opencode-go`, `openai`, `anthropic`,
    `deepseek`, `google`.
  - Every handler enforces the session guard; ownership is implicit via
    `"userId"` scoping. Responses contain only key metadata — never plaintext
    or ciphertext.

## Consequences

Rotating `SETTINGS_ENCRYPTION_KEY` makes previously stored keys undecryptable;
users must re-enter them. Decryption failures surface as `null` from
`getProviderKey` rather than throwing, so consumers can prompt for re-entry.
The engine does not consume these settings yet — wiring is T04's scope.
