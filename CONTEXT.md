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