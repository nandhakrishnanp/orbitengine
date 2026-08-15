# Engine's GitHub write surface (v1)

The engine writes to GitHub through three actions: create issues, open pull
requests (push to a branch, then PR), and create new repositories. Direct push
to a repository's default branch and commenting on issues/PRs are deliberately
excluded in v1 — direct-push is too dangerous without review, commenting is
noise. Revisit both in later versions.