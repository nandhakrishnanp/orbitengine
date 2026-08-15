# OpenAI-compatible API for model access

The engine's LLM loop talks to models through an OpenAI-compatible API format,
abstracted behind the Vercel AI SDK. This keeps provider choice open — any
provider that speaks the OpenAI format (OpenAI, and compatible hosts) can power
the engine. A per-conversation model picker remains possible without touching
the runtime.