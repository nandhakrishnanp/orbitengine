# Short-lived scoped GitHub tokens into the sandbox

The sandbox receives a short-lived, per-conversation, scoped GitHub
installation token as an environment variable — never the long-lived app or
user token. Limits blast radius if a sandbox is compromised and keeps one
conversation's credentials from outliving it.