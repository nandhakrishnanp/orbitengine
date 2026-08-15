# GitHub App with OAuth Web Application Flow

The engine accesses GitHub through a GitHub App, and users sign in via the
GitHub OAuth Web Application Flow. This combines a stable app identity for
repository/PR/issue access with user authentication. Accepted over using only a
user OAuth token, which would conflate user identity with the engine's API
identity and make app-level installs impossible later.