# CONTEXT.md

OrbitEngine is a cloud platform where a user opens a chat alongside an engine,
links their GitHub, and the engine reads/writes repositories, PRs, and issues,
bootstraps new projects, edits code, runs tests, and pushes fixes. Everything
runs cloud-side; the client is a thin chat + status surface.

## Language

**Engine**:
The cloud-side worker that does the coding work — reading/writing files and
repos, running tests, pushing fixes — on the user's behalf.
_Avoid_: agent, bot

**Conversation**:
A user's chat session with an engine. Owns exactly one sandbox for its whole
lifetime.
_Avoid_: session, thread

**Sandbox**:
The isolated, ephemeral execution environment attached to a conversation; the
only place the engine creates, edits, and runs code.
_Avoid_: container, VM, environment

**GitHub integration**:
The two-way link between the user's GitHub account and an engine — reads
repos/PRs/issues and writes commits, PRs, and comments.
_Avoid_: connection, auth

**Project**:
A repository the engine bootstraps from scratch, or an existing repository the
user attaches to a conversation to work on.
_Avoid_: repo, workspace

**Attached repository**:
The single repository a conversation works on. Exactly one per conversation;
the sandbox is wired to it as its git working tree.
_Avoid_: repo, workspace, project

**Monitor**:
The in-app view of a conversation's sandbox — file tree, file viewer, and
command runner. How a user inspects what the engine is working on.
_Avoid_: IDE, explorer

**Model selection**:
The per-conversation choice of provider (OpenAI, Claude, DeepSeek, Gemini,
opencode.ai) and model, with a global default. Independent of the fixed engine
system prompt — the engine's behaviour does not change, only which model powers it.
_Avoid_: operator, harness

**Mode**:
The working posture of a conversation — **Plan** (read-only: the engine reads
repo files and analyses but never writes or pushes) or **Build** (full tool
set, including writes, PRs, and browsing). Per-conversation and switchable.
_Avoid_: phase

**Skill**:
A named Markdown instruction bundle the user adds to a conversation's context
by typing `/skillname` in chat. Managed in Settings — added, edited, deleted,
or created from a conversation the engine just worked on. A skill may bundle
extra tools (e.g. browser). Skills apply in Build mode.
_Avoid_: command, plugin

**Factory**:
A per-repository configuration that watches for new issues and autonomously
runs the engine to reproduce, fix, and open a PR for each one. Watches the repo
by polling for open issues.
_Avoid_: bot, workflow

**Factory run**:
One issue handled by a factory — a sandboxed engine loop that reproduces the
issue, makes a fix on a separate branch, and opens a PR. One sandbox per run
(ADR-0001). Triggered by polling, not by a webhook.
_Avoid_: job, task

**Trace**:
The recorded engine activity for a conversation or factory run — per-step spans
(tool, duration, phase, input, output) plus per-run context (model, provider,
skills, step count, total time). Viewed in the observability surface.
_Avoid_: log, timeline