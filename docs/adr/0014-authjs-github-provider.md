# Auth.js (NextAuth) with GitHub provider

Users sign in to the app through Auth.js (NextAuth) using the GitHub provider,
with a session cookie and a Postgres session store. Reuses the GitHub OAuth
flow; no custom auth plumbing in v1. The GitHub App still handles repository
access independently of login.