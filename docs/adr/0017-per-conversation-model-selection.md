# Per-conversation model selection with user-provided provider keys

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
