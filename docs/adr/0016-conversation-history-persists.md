# Conversation history persists; only the sandbox dies

Closing a conversation destroys its sandbox but keeps the conversation and
message history in Postgres, so past chats remain viewable and reopenable.
Reopening spawns a fresh sandbox wired to the same attached repository. Only
work pushed to GitHub survives a close.