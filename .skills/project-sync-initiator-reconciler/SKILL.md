---
name: project-sync-initiator-reconciler
description: Reconcile the initiating repository from a verified source SHA and return JSON SHA evidence.
---

# Project Sync Initiator Reconciler

1. Read the injected synchronization context, repository snapshot, and required predecessor SHA completely.
2. Refuse destructive Git commands, history rewrites, force operations, dirty unrelated worktrees, an origin identity mismatch, and an active Git operation.
3. Fetch `origin`, prove the advertised remote SHA equals the required predecessor SHA, classify tracked and untracked changes, and reconcile with a non-destructive fast-forward or normal merge that retains both sides' intent.
4. Create focused commits when reconciliation requires them. Add ignore rules only for verified generated artifacts and run proportionate checks.
5. Preserve user changes and every registered worktree. Stop on a dirty secondary worktree. Never reset, clean, rebase, discard with checkout, remove an unverified worktree, or overwrite uncommitted files.
6. Push the reconciled branch, then finish with empty porcelain status, clean retained worktrees, and identical `HEAD` and `origin/<branch>` SHAs.
7. Return exactly one JSON object with `status`, `role`, `nodeId`, `branch`, `requiredSha`, `headSha`, `originSha`, `commitsCreated`, `ignoredPaths`, `retainedWorktrees`, `removedWorktrees`, `checks`, and `blocker`.
