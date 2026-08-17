import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const openzen = createOpenAICompatible({
  name: "openzen",
  apiKey: process.env.OPENZEN_API_KEY,
  baseURL: "https://opencode.ai/zen/v1",
});
