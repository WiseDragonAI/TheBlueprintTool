# Manage Canonical Dev And Feature Worktrees

## A. Authority

1. `bin/decision-os-worktree.mjs` is the only supported command for dev provisioning, feature-worktree creation, feature integration, exact-SHA push, and completed-feature cleanup.
2. The command is dependency-independent plain JavaScript so malformed `node_modules` state cannot prevent `init-dev` from repairing canonical setup.
3. Every mutating command acquires the repository-global worktree-operation lock and returns one JSON receipt.

---

## B. Initialize Canonical Dev

1. Run:

   ```bash
   node bin/decision-os-worktree.mjs init-dev --json
   ```

2. The command requires exactly one `.worktrees/dev` checkout owning `refs/heads/dev`.
3. It replaces legacy dependency symlinks with real worktree-owned installs for `backend`, `frontend`, and `federation-relay` without following or modifying the old symlink targets.
4. It initializes the exact `.decision-os` gitlink and applies `submodule.".decision-os".ignore=all` through dev worktree-local configuration.
5. It repairs only the reproduced server-generated `Search/.decision-os/.gitignore` replacement. Every other tracked, staged, and untracked mutation is a rejection.
6. It writes the canonical setup manifest inside dev's worktree Git metadata and proves a clean parent receipt.

---

## C. Create A Feature Worktree

1. Run:

   ```bash
   node bin/decision-os-worktree.mjs create <feature-name> --json
   ```

2. The command initializes canonical dev first, creates `feature/<feature-name>` at `.worktrees/<feature-name>` from the exact local dev SHA, initializes the Decision OS child, and creates the matching child feature branch.
3. Feature dependencies link only to canonical dev dependencies. Repository ignore rules cover the dependency symlink paths without treating them as directories.
4. A successful receipt proves the exact parent SHA, child gitlink, branch, worktree path, dependency targets, and clean parent plus child state.
5. Existing branches, paths, noncanonical dependencies, and dirty state are rejected. The command never adopts them.

---

## D. Inspect Canonical Dev

1. Run:

   ```bash
   node bin/decision-os-worktree.mjs status --json
   ```

2. Status is read-only and reports the dev SHA, gitlink, parent status, real dependency ownership, and package-specific dependency proofs.

---

## E. Integrate A Feature

1. Run from outside the feature worktree:

   ```bash
   node .worktrees/<feature-name>/bin/decision-os-worktree.mjs integrate <feature-name> --json
   ```

2. The command requires committed and clean feature parent plus child state.
3. It initializes canonical dev, merges the exact feature SHA with a merge commit, installs the merged child gitlink, and runs the fixed dev integration check.
4. It pushes only `<admitted-dev-sha>:refs/heads/dev` with the Wise SSH identity.
5. After the exact push succeeds, it removes the completed feature worktree and deletes the merged feature branch.
6. A failed setup, merge, admission, or push preserves the feature recovery boundary and returns one stable error code.

---

## F. Prohibited Manual Substitutes

1. Do not create feature worktrees with direct `git worktree add`.
2. Do not link feature dependencies manually.
3. Do not hide dependency paths through checkout-local exclusions.
4. Do not stash or reset unrelated dev dirt to obtain an integration receipt.
5. Do not push the symbolic `dev` branch after admission; push only the admitted SHA refspec.
