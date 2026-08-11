# Integrate A Feature Into Dev

## A. Command Authority

1. Integrate a feature only with:

   ```bash
   node .worktrees/<feature-name>/bin/decision-os-worktree.mjs integrate <feature-name> --json
   ```

2. Invoke the command from outside the feature worktree so successful cleanup can remove that checkout.
3. Do not substitute direct merge, submodule, admission, push, worktree-removal, dependency-link, exclusion, stash, or branch-deletion commands.

---

## B. Required Feature State

1. Complete implementation, tests, diff review, and scoped commits in the isolated feature worktree created by `decision-os-worktree create`.
2. Commit intended Decision OS cards and threads in the feature `.decision-os` child repository, publish that child commit to the configured source, and commit the resulting parent gitlink on the feature branch.
3. Preserve the feature worktree, feature branch, and child checkout until the integration command returns a successful receipt.
4. Parent and child feature status must be clean. The command never stashes, resets, commits, or hides unreviewed feature state.

---

## C. Canonical Dev Admission

1. The integration command runs canonical dev initialization before mutation.
2. Canonical dev owns real package-local dependencies, the exact installed child gitlink, worktree-local child visibility configuration, and no parent dirt.
3. The one-time legacy migration replaces dependency symlinks without following their targets and repairs only the exact reproduced Search fixture mutation.
4. Every unexplained tracked, staged, and untracked dev path is a rejection.

---

## D. Merge And Child Installation

1. The command records the reviewed feature `HEAD` and merges that exact commit into the persistent `dev` worktree with `--no-ff`.
2. The merge commit contains non-empty `WHAT:` and `WHY:` paragraphs.
3. The command initializes the persistent dev child checkout at the merged parent gitlink.
4. The running dev workspace reads child files from that exact checkout; object availability in another feature checkout is insufficient.

---

## E. Fixed Integration Admission

1. The command executes:

   ```bash
   node bin/decision-os-dev-integration-check.mjs --feature <reviewed-feature-sha> --json
   ```

2. Exit `0` and the JSON receipt admit cleanup only for the receipt's exact `devSha`.
3. The check proves one two-parent merge, the expected second parent, a clean parent tree, published old and new child objects, descendant child history, exact child checkout installation, clean child authored state, and a stable final dev SHA.
4. A rejection preserves the local merge, feature worktree, and feature branch for diagnosis.

---

## F. Exact Push And Cleanup

1. The command pushes only:

   ```text
   <admitted-dev-sha>:refs/heads/dev
   ```

2. It uses the Wise SSH identity required by repository policy.
3. After the exact push succeeds, it removes the completed feature worktree and deletes the merged feature branch.
4. A push failure preserves the feature recovery boundary and the admitted local merge.
5. An interrupted post-push cleanup resumes through `decision-os-worktree cleanup <feature-name> --json`; do not substitute manual branch or worktree deletion.
6. Dev integration does not promote `main`, restart a server, deploy the relay, rewrite prompt bytes, or close a master task.

---

## G. Rejection Codes

1. `dev_integration_merge_required` — dev `HEAD` is not one two-parent merge.
2. `dev_integration_feature_mismatch` — the reviewed feature SHA is not the merge second parent.
3. `dev_integration_feature_invalid` — the supplied feature value is not one full lowercase Git object ID.
4. `dev_integration_gitlink_unpublished` — the configured child source does not provide the merged gitlink.
5. `dev_integration_previous_gitlink_unpublished` — the configured child source no longer provides the first-parent gitlink.
6. `dev_integration_child_history_diverged` — the merged gitlink does not descend from the first-parent gitlink.
7. `dev_integration_child_uninitialized` — the persistent dev child repository is absent.
8. `dev_integration_child_mismatch` — the persistent child checkout does not match the merged gitlink.
9. `dev_integration_child_dirty` — non-ignored authored child bytes differ from the merged gitlink.
10. `dev_integration_parent_dirty` — parent files outside the mutable child checkout changed after merge.
