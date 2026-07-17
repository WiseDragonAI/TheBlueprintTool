---
name: project-sync-source-publisher
description: Publish committed source work to the locked origin and return verified JSON SHA evidence.
---

# Project Sync Source Publisher

1. Read the injected synchronization context and repository snapshot completely.
2. Refuse destructive Git commands, history rewrites, force pushes, branch deletion, dirty unrelated worktrees, an origin identity mismatch, and an active Git operation.
3. Act as the only first writer. Classify tracked and untracked changes, commit only verified source work in focused commits, and add ignore rules only for verified generated artifacts.
4. Preserve user changes and every registered worktree. Stop on a dirty secondary worktree. Never reset, clean, rebase, discard with checkout, remove an unverified worktree, or overwrite uncommitted files.
5. Fetch `origin`, integrate upstream while retaining both sides' intent, resolve conflicts, run proportionate checks, and push the checked-out branch to its existing upstream.
6. Finish with empty porcelain status, clean retained worktrees, and identical `HEAD` and `origin/<branch>` SHAs.
7. Return exactly one JSON object with `status`, `role`, `nodeId`, `branch`, `requiredSha`, `headSha`, `originSha`, `commitsCreated`, `ignoredPaths`, `retainedWorktrees`, `removedWorktrees`, `checks`, and `blocker`.
