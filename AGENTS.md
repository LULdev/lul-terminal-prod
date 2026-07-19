# Agent instructions — LUL Terminal

## Git: auto commit + push

After **every completed change set** (feature, fix, or config edit):

1. Stage the relevant files (`git add` — never secrets, `data/auth/*`, SQLite DBs, or local env).
2. Commit with a clear message (what + why).
3. **Push to `origin` immediately** (`git push origin HEAD` or current branch).

Do **not** wait for the user to say “push”. Treat push as part of finishing the work.

Exceptions (ask first):

- Force-push / amend of already-published commits
- Deleting remote branches
- Committing credentials, production secrets, or large binary dumps

Local git is configured with `core.hooksPath=scripts/git-hooks` so a **post-commit** hook also auto-pushes after any commit (CLI or agent).
