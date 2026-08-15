# One attached repository per conversation

A conversation works on exactly one attached repository at a time. Multi-repo
conversations are out of scope for v1. Keeps the sandbox wiring simple: one git
remote, one working tree, matching the one-sandbox-per-conversation model.