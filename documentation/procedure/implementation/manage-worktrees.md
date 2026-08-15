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

2. The command requires committed and clean feature parent plus child state, verifies that the reviewed parent gitlink equals the exact child `HEAD`, then admits local canonical `dev` only when it equals fetched `origin/dev` before any child-source mutation.
3. It completes canonical dev initialization and cleanliness admission, re-fetches and revalidates the exact published parent SHA, then resolves `.decision-os` source from the reviewed parent `.gitmodules` blob.
4. It rejects a child `origin` override, requires both canonical-child and observed-source-`dev` ancestry, and publishes the exact reviewed child SHA through a lease on the observed source `dev` tip.
5. It refetches the configured child source and requires exact equality with the reviewed child SHA before it merges the exact feature SHA, installs the merged child gitlink, and runs the fixed dev integration check.
6. The receipt includes parent admission, reviewed parent SHA and gitlink, canonical child gitlink, source, observed source tip, lease, refetched source tip, admitted dev SHA, and pushed parent ref.
7. It pushes only `<admitted-dev-sha>:refs/heads/dev` with the Wise SSH identity, then removes the completed feature worktree and deletes the merged feature branch.
8. A pre-merge child-publication rejection preserves the feature recovery boundary without a parent merge. A post-merge parent-admission failure preserves the local merge plus feature recovery boundary; repair the named condition, rerun the command, and never publish, clean, or delete manually.

---

## F. Resume Interrupted Cleanup

1. Run:

   ```bash
   node bin/decision-os-worktree.mjs cleanup <feature-name> --json
   ```

2. The command requires the exact feature branch to be fully contained by canonical dev.
3. A registered parent and child checkout must both be clean before removal.
4. The command removes the initialized-submodule worktree, deletes the exact merged branch, and refuses every unmerged or dirty recovery boundary.

---

## G. Prohibited Manual Substitutes

1. Do not create feature worktrees with direct `git worktree add`.
2. Do not link feature dependencies manually.
3. Do not hide dependency paths through checkout-local exclusions.
4. Do not stash or reset unrelated dev dirt to obtain an integration receipt.
5. Do not push the symbolic `dev` branch after admission; push only the admitted SHA refspec.

---

## H. Internal Architecture

1. `bin/decision-os-worktree.mjs` is the thin executable and public export boundary.
2. `bin/worktree/controllers/` owns command dispatch and operation lifecycles for dev initialization, feature creation, child publication, integration, cleanup, and status.
3. `bin/worktree/helpers/` owns focused validation, Git and process IO, parsing, locking, dependency setup, and receipt derivation.
4. `bin/worktree/config.mjs` owns immutable repository paths and dependency proofs; `bin/worktree/worktree-cli-error.mjs` owns the stable error contract.
5. Keep the executable below `200` LOC and preserve the controller/helper ownership boundary when extending the lifecycle.
