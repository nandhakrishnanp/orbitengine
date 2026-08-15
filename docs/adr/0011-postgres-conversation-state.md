# Postgres for conversation state

Conversations, messages, the attached repository, sandbox id, and status are
stored in Postgres (e.g. Vercel Postgres/Neon). Chosen over KV/SQLite for
structured relational data with history. GitHub remains the source of truth for
code; Postgres holds platform state.