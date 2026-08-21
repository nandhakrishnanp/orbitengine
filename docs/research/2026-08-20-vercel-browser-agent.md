# Research: giving an AI agent headless browser navigation + verification

**Date:** 2026-08-20
**Status:** Research only — no code written.
**Question:** The user heard about a "Vercel browser agent" that lets an agent navigate a
website and test whether a feature works. What concrete options exist?

---

## 1. Vercel's official "browser agent": `vercel-labs/agent-browser` — this is real

The thing the user heard about exists. It is:

- **Repo:** `vercel-labs/agent-browser` — "Browser automation CLI for AI agents. Fast native Rust CLI."
  https://github.com/vercel-labs/agent-browser (Apache-2.0, ~41k stars, 2.7k forks)
- **npm package:** `agent-browser` (native binary via postinstall) — https://www.npmjs.com/package/agent-browser
- **Docs:** https://agent-browser.dev/
- **Helper for Vercel Sandbox:** `@agent-browser/sandbox` (see section 3)

### What it is

A cross-platform (macOS/Linux/Windows native binaries) browser-automation **CLI daemon**
written in Rust. It talks to Chrome directly over the Chrome DevTools Protocol (CDP). It is
purpose-built for LLM agents: commands emit compact text (an accessibility-tree snapshot
~200–400 tokens vs ~3000–5000 for a full DOM dump), and elements are addressed by stable
refs (`@e1`, `@e2`) returned by a `snapshot` command.

### The core workflow (open → snapshot → interact)

```
agent-browser open example.com     # launch Chrome + navigate
agent-browser snapshot -i          # accessibility tree with refs: - heading "Example Domain" [ref=e1]
agent-browser click @e2            # act on a ref
agent-browser fill @e3 "test@test.com"
agent-browser get text @e1
agent-browser screenshot page.png
agent-browser close
```

50+ commands: `read` (fetch agent-readable text/markdown, with `llms.txt` awareness),
`click`, `fill`, `type`, `press`, `select`, `check`, `hover`, `drag`, `upload`, `eval`
(run JS), `snapshot`, `screenshot`, `pdf`, `wait` (element/text/URL/JS condition), `get`
(title/url/html/text/value/attr/count/box), `find role|text|label|placeholder|...`,
network interception + HAR, cookies/storage, tabs/windows, frames, dialogs, React/Web
Vitals introspection, a11y (axe-core) audits, visual+snapshot diffing (`diff`), and `is
visible/enabled/checked` assertions. There is even `agent-browser chat "..."` for
natural-language browser control.

### How agents use it (three integration modes)

1. **CLI / skills** — any agent that can run shell commands (Claude Code, Cursor, Copilot,
   Codex, Gemini, opencode) just shells out to `agent-browser ...`. The repo ships a bundled
   SKILL: https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md
   (`agent-browser skills get agent-browser` prints the current copy).
2. **MCP server** — `agent-browser mcp` starts a Model Context Protocol server over stdio
   with typed tools like `agent_browser_open`, `agent_browser_snapshot`, `agent_browser_click`,
   `agent_browser_fill`, `agent_browser_screenshot`, `agent_browser_eval`, `agent_browser_close`.
   Tool profiles: `core`, `network`, `state`, `debug`, `tabs`, `react`, `mobile`, `all`.
   https://agent-browser.dev/commands (MCP section) and README "MCP Server".
3. **Programmatic wrapper** — e.g. `runAgentBrowserCommand(sandbox, [...])` in the
   `@agent-browser/sandbox` helper (section 3).

### Security / sandbox notes (relevant to a cloud engine)

- Has a `--allowed-domains` / `allowedDomains` guard, `--content-boundaries` (delimit tool
  output from untrusted page content so the LLM can tell them apart), an encrypted
  credential vault (`auth save` / `auth login`, so the LLM never sees passwords), network
  routing/blocking, and out-of-process plugin capabilities.
- Session isolation: `--session <id>` gives each agent its own browser instance, cookies,
  storage, history, and auth state — a clean fit for "one sandbox per agent loop."
- Remote browser providers are supported directly: Browserbase, Browserless, Browser Use,
  Kernel, AgentCore, and its own "Remote Agent Browser." https://agent-browser.dev/providers/browserbase

---

## 2. Mainstream alternatives for giving a Next.js/AI-SDK agent browsing

Below are the realistic options. Two axis to keep separate: **(a) how the browser runs /
where**, and **(b) how the model calls it (a tool in its tool loop)**.

### 2a. Browser engines/libraries (run somewhere you control)

| Option | What it is | Run inside Firecracker microVM (like `@vercel/sandbox`)? | Agent-tool integration |
|---|---|---|---|
| **Playwright** https://playwright.dev | Cross-browser automation library (Chromium/Firefox/WebKit) with auto-waiting, network interception, accessibility snapshot. | **Yes.** It is just Node + a browser binary + system libs; install them in the VM (or bake into a custom OCI image / sandbox snapshot). Chrome needs system deps, same as agent-browser. | Direct in-process: `await page.goto(url)` inside a tool's `execute()`. Also ships **Playwright MCP** (below) and a new CLI+skills form. |
| **Puppeteer** https://pptr.dev | Chrome-only automation over CDP (Node). | **Yes**, same as Playwright (needs Chromium + system libs in the VM). | Direct in-process in a tool's `execute()`. |
| **Playwright MCP** https://github.com/microsoft/playwright-mcp (npm `@playwright/mcp`, ~36k stars) | An MCP server exposing browser as tools (`browser_navigate`, `browser_click`, `browser_snapshot`, ...) built on Playwright's accessibility tree (no vision needed). | **Yes** — it runs as a Node process + browser; officially shipped as a Docker image `mcr.microsoft.com/playwright/mcp`. In a Firecracker VM you'd run it directly or via that image. | MCP tools (consumed via AI SDK MCP client or an MCP-capable agent host). Microsoft's own docs note coding agents increasingly prefer **CLI + skills** over MCP for token efficiency — see `microsoft/playwright-cli`. |
| **agent-browser (Vercel)** | Rust CLI/daemon + Chrome (CDP). | **Yes**, and it is the one with first-class `@vercel/sandbox` integration + sub-second snapshot startup (section 3). | CLI/skill, MCP, or `@agent-browser/sandbox` wrapper. |

### 2b. Managed/cloud browser providers (browser runs on their infra, you call an API)

These avoid installing browsers in your sandbox entirely — your cloud sandbox only makes
network calls; the provider hosts the browser and proxies CDP/Playwright/Puppeteer over
WebSocket. They integrate as a *tool* by connecting Playwright/Puppeteer (or the provider's
SDK) over a WebSocket endpoint.

| Option | What it is | Firecracker-friendly? | Agent-tool integration |
|---|---|---|---|
| **Browserbase** https://docs.browserbase.com/ (npm `@browserbasehq/sdk`, plus `stagehand` agent SDK) | Cloud browsers (Playwright/Puppeteer/Selenium), sessions, observability, search/fetch APIs. Ships **Stagehand** ("the SDK for browser agents"): natural-language selectors, self-healing actions. | **Yes** — your sandbox is just an API/WebSocket client; no browser inside the VM. | Playwright `connect()` to a Browserbase WebSocket URL; or the Stagehand SDK's `act()/extract()` inside a tool `execute()`. Browserbase maintains agent-framework integrations (LangChain, Mastra, CrewAI). |
| **Steel.dev** https://docs.steel.dev/ (npm `steel-sdk`) | Open-source browser API for AI agents — managed cloud browsers, stealth, residential proxies, CAPTCHA solving, persistent profiles, session replays. | **Yes** — same pattern: your sandbox connects over `wss://connect.steel.dev?...` with Puppeteer/Playwright. | `puppeteer.connect({ browserWSEndpoint })` / Playwright connect inside a tool `execute()`; also a `scrape` REST endpoint. |
| **Browserless** https://docs.browserless.io | Self-hostable or hosted headless-Chrome service (CDP endpoint + JSON APIs). | **Yes** — connect via CDP endpoint; or run it inside the VM itself. | Connect Puppeteer/Playwright to its CDP endpoint. |

### 2c. Bottom line for section 2

- The single most turnkey path **on Vercel** is `agent-browser` + `@vercel/sandbox`, because
  Vercel built both and documented them together (next section).
- If you prefer to keep it "just a library," Playwright (or Puppeteer) running **inside** the
  `@vercel/sandbox` microVM works fine — you must install Chrome/Chromium + its system deps
  each cold boot unless you bake them into a custom OCI image or a sandbox **snapshot**.
- If you don't want to manage browsers at all in your engine, Browserbase (with Stagehand)
  or Steel.dev give you a browser over WebSocket with no browser inside the sandbox.

---

## 3. Exposing browsing as an AI SDK tool (the "browse" tool)

### The recommended, documented path: `@agent-browser/sandbox` + Vercel Sandbox

This is the exact fit for a Next.js app deployed on Vercel that already uses
`@vercel/sandbox` (which this repo's ADR-0004 already records). Vercel's agent-browser docs
have a dedicated "Next.js + Vercel" page:

https://agent-browser.dev/next

Key facts, all from that page:

- Install: `pnpm add @agent-browser/sandbox @vercel/sandbox`
- Sandboxes are **Firecracker microVMs** (Amazon Linux by default) that boot on demand, run
  your command, then shut down. Confirmed by Vercel's Sandbox docs: "Each sandbox runs in a
  secure Firecracker microVM with its own filesystem and network." https://vercel.com/docs/sandbox
- Chromium needs system libraries not present on a fresh VM, so the `@agent-browser/sandbox`
  helper installs them (`dnf install`) and handles command execution. For production you use a
  **sandbox snapshot** (`AGENT_BROWSER_SNAPSHOT_ID`) — a saved VM image with deps +
  agent-browser + Chromium preinstalled, cutting cold start from ~30s to sub-second.
- Auth: on Vercel deployments the Sandbox SDK authenticates automatically via OIDC
  (`VERCEL_OIDC_TOKEN`); locally pass `VERCEL_TOKEN` / `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID`.

The documented pattern is a server action / route that opens a sandbox, runs agent-browser
commands (open → snapshot → screenshot → close), and returns the result:

```ts
import { runAgentBrowserCommand, withAgentBrowserSandbox } from "@agent-browser/sandbox/vercel";

export async function verifyFeature(url: string) {
  return withAgentBrowserSandbox(async (sandbox) => {
    await runAgentBrowserCommand(sandbox, ["open", url]);
    const snap = await runAgentBrowserCommand(sandbox, ["snapshot", "-i", "-c"], { json: false });
    await runAgentBrowserCommand(sandbox, ["close"], { json: false });
    return { ok: true, snapshot: snap.stdout };
  });
}
```

(Full server-action examples for screenshotting and snapshotting are on the page above; a
working demo app with streaming progress + rate limiting is at
`vercel-labs/agent-browser/tree/main/examples/environments`.)

### Wrapping that in an AI SDK tool

AI SDK tools are objects with an `inputSchema` (Zod) and an async `execute()`. You call
`generateText`/`streamText` (or a loop agent) with a `tools` map; multi-step tool calling is
enabled via `stopWhen` (e.g. `isStepCount(n)`), so the model can browse, observe, then
continue until it judges the feature works.

https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling

```ts
import { z } from "zod";
import { tool, generateText, isStepCount } from "ai";
import { runAgentBrowserCommand, withAgentBrowserSandbox } from "@agent-browser/sandbox/vercel";

const browse = tool({
  description: "Navigate to a URL and return the page's accessibility snapshot with element refs.",
  inputSchema: z.object({ url: z.string().describe("URL to open") }),
  execute: async ({ url }) =>
    withAgentBrowserSandbox(async (sandbox) => {
      await runAgentBrowserCommand(sandbox, ["open", url]);
      const snap = await runAgentBrowserCommand(sandbox, ["snapshot", "-i", "-c"], { json: false });
      await runAgentBrowserCommand(sandbox, ["close"], { json: false });
      return { snapshot: snap.stdout };
    }),
});

const click = tool({
  description: "Click an element by snapshot ref (@e1) in the running browser.",
  inputSchema: z.object({ ref: z.string() }),
  execute: async ({ ref }) =>
    withAgentBrowserSandbox(async (sandbox) => {
      await runAgentBrowserCommand(sandbox, ["click", ref]);
      return runAgentBrowserCommand(sandbox, ["snapshot", "-i", "-c"], { json: false });
    }),
});
```

Design notes for a realistic `browse`/`assert` tool set:

- **State lives in the sandbox**, not in your function. The browser session (open tab,
  cookies, DOM) persists across agent-browser commands because they all hit the same daemon
  inside the same sandbox. For a multi-step flow keep the sandbox alive across tool calls
  (don't `close` and destroy between steps); close it when the loop finishes.
- **Separate verbs** the model can compose: `browse`/`navigate(url)`, `snapshot`,
  `click(ref)`, `fill(ref,text)`, `screenshot` (returns base64 image the model can view if
  it has vision), `eval(js)`, and assertion helpers (`is visible`, `get text`, `wait for
  text`). agent-browser's snapshot-ref model is designed so the model reads a small snapshot,
  picks a ref, and acts on it.
- **Verification loop:** after an action, call `wait`/`snapshot`/`diff` and feed the result
  back so the model decides pass/fail (e.g. "Dashboard" heading visible, no error in
  `console`/`errors`). agent-browser even has `diff snapshot`/`diff screenshot` for visual or
  structural before/after comparison.
- **Security/guardrails:** constrain with `--allowed-domains`, use `--content-boundaries`
  so untrusted page text is separated from tool output, use a per-loop sandbox session
  (matches the repo's "one sandbox per agent loop" invariant), and consider AI SDK
  `toolApproval` for sensitive actions. AI SDK `toolApproval` docs are on the tool-calling
  page above.

### Alternative tool-wiring for section 3

- **AI SDK MCP tools:** instead of writing `execute()` wrappers, register agent-browser's or
  Playwright's MCP server and import its tools via the AI SDK's MCP client
  (https://sdk.vercel.ai/docs/ai-sdk-core/mcp-tools). This gives you the full typed browser
  tool surface with minimal glue, though it is heavier on context than a few purpose-built
  `browse`/`click` tools.
- **Direct in-process Playwright/Puppeteer:** a `browse` tool's `execute()` calls
  `playwright.chromium.launch()` + `page.goto()` + `page.accessibility`/`locator` inside the
  sandbox. Works, but you manage the browser lifecycle and system deps yourself and get none
  of agent-browser's token-efficient snapshot/ref model out of the box.
- **Managed providers (Browserbase/Steel):** a `browse` tool's `execute()` connects
  Playwright/Puppeteer over WebSocket to the provider, so your sandbox needs no browser. Best
  when you want stealth/proxies/persistence managed externally and don't mind a cloud
  dependency.

---

## Sources (primary)

- agent-browser repo (README, commands, MCP, security): https://github.com/vercel-labs/agent-browser
- agent-browser docs: https://agent-browser.dev/ (esp. /commands, /next, /providers/browserbase)
- agent-browser skill: https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md
- npm package: https://www.npmjs.com/package/agent-browser
- Next.js + Vercel Sandbox integration: https://agent-browser.dev/next
- Vercel Sandbox docs (Firecracker microVM, images, snapshots, SDK): https://vercel.com/docs/sandbox
- Playwright MCP: https://github.com/microsoft/playwright-mcp ; Playwright CLI: https://github.com/microsoft/playwright-cli ; Playwright: https://playwright.dev
- Puppeteer: https://pptr.dev
- Browserbase docs (Stagehand, Playwright/Puppeteer quickstarts): https://docs.browserbase.com/
- Steel.dev docs (SDK, WSS connect): https://docs.steel.dev/
- AI SDK tool calling (tool(), execute, stopWhen, toolApproval, experimental_sandbox): https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
- AI SDK MCP tools: https://sdk.vercel.ai/docs/ai-sdk-core/mcp-tools
