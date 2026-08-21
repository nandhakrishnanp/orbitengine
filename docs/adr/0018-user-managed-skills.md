# Skills as user-managed Markdown instruction bundles

Version 2 introduces skills: named Markdown bundles a user adds to a
conversation's context by typing `/skillname` in chat, so they can teach the
engine reusable behaviour without changing the engine itself. A skill is stored
user-scoped in Postgres (name + Markdown content + any declared tool
requirements) and is available across all of that user's conversations.

Skills are user-managed: added, edited, and deleted in Settings, or created from
a conversation the engine just worked on — in which case the engine drafts the
skill and the user reviews/edits it before it is saved. The engine can never
write a skill silently. This keeps the engine generic and the user in control,
rather than baking every behaviour into the fixed system prompt.
