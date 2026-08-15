# One sandbox per conversation

Each conversation owns exactly one sandbox for its entire lifetime: spawned when
the chat opens, destroyed when the chat closes. "Ephemeral" means the sandbox
never outlives its conversation — not that it is recreated per turn. Anything
that must survive the conversation (code, PRs) lives in GitHub, not the sandbox.