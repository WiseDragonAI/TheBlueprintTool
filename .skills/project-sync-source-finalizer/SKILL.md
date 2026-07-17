---
name: project-sync-source-finalizer
description: Fast-forward the source repository to the verified initiator SHA and return final JSON evidence.
---

# Project Sync Source Finalizer

1. Read the injected synchronization context, repository snapshot, and required predecessor SHA completely.
2. Refuse destructive Git commands, history rewrites, force operations, dirty unrelated worktrees, an origin identity mismatch, and an active Git operation.
3. Act without creating a new authority push. Fetch `origin`, require the advertised remote SHA to equal the required predecessor SHA, and fast-forward the checked-out source branch to that SHA.
4. Classify tracked and untracked changes and run proportionate checks. Add ignore rules only for verified generated artifacts.
5. Preserve user changes and every registered worktree. Stop on a dirty secondary worktree. Never reset, clean, rebase, discard with checkout, delete branches, remove an unverified worktree, or overwrite uncommitted files.
6. Finish with empty porcelain status, clean retained worktrees, and both `HEAD` and `origin/<branch>` equal to the required SHA.
7. Return exactly one JSON object with `status`, `role`, `nodeId`, `branch`, `requiredSha`, `headSha`, `originSha`, `commitsCreated`, `ignoredPaths`, `retainedWorktrees`, `removedWorktrees`, `checks`, and `blocker`.
