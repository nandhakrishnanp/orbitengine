# Vercel AI SDK for the agent runtime

The engine's loop is driven by the Vercel AI SDK (tool calling, streaming)
rather than a hand-rolled LLM loop or LangGraph.js. Chosen for first-class
streaming/tool support and vendor consistency with the rest of the stack. A
custom loop or heavier orchestration is possible later if the SDK becomes a
limit.