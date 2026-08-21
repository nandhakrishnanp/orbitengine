# Per-conversation model selection with user-provided provider keys

## Status

Implemented (T04, issue #24; key storage via T02/ADR-0023).

## Context

Version 1 fixed the engine to a single model (`openzen("hy3-free")`) with no
user choice. Version 2 makes model selection dynamic: each conversation stores
its own provider and model, with a user-level global default, and the model list
is fetched live from each provider's `/models` endpoint.

Users provide their own API key per provider in Settings rather than the
platform holding a single set of keys. This suits the single-maintainer,
multi-tenant reality: one user should not pay for or expose keys others use, and
each user controls which providers they enable. Because these are third-party
credentials stored on our servers, provider keys are **encrypted at rest**
server-side and never returned to the client in plaintext. The engine's system
prompt and behaviour are unchanged — only which model powers the loop differs
(extending ADR-0010, which already anticipated a per-conversation picker).

## Decision

- **One OpenAI-compatible client for all providers** (`lib/ai.ts` registry):
  `opencode-go`, `openai`, `anthropic`, `deepseek`, `google` — each mapped to
  its OpenAI-compatible base URL and constructed per-request with the user's
  decrypted key.
- **Resolution order** in the engine: conversation override → user global
  default (settings store) → built-in fallback (`opencode-go` / `hy3-free`
  with the platform `OPENZEN_API_KEY`). If no key exists for the resolved
  provider, the engine returns 400.
- **Live model lists**: `GET /api/models/[provider]` proxies the provider's
  `/models` endpoint server-side using the stored key; pickers list only
  providers with a configured key.
- **Loop parameters** (`maxSteps`, `maxRetries`) are also resolved from user
  settings instead of hardcoded constants.

## Consequences

Anthropic/Google run through their OpenAI-compat endpoints, so native-only
features (e.g. extended thinking) are out of reach until dedicated SDK
providers are added. Model lists are fetched on picker open, not cached
server-side.
