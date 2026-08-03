# Integrate A Feature Into Dev

## A. Required State

1. **WHAT:** Complete implementation, tests, diff review, and scoped commits in one isolated feature worktree based on current `dev`.

   **WHY:** The reviewed feature commit is the immutable second parent expected by the integration receipt.

2. **WHAT:** Commit intended Decision OS cards and threads in the feature `.decision-os` child repository, publish that child commit to the configured source, then commit the resulting parent gitlink on the feature branch.

   **WHY:** A parent commit cannot deliver child objects that remain only in the feature checkout.

3. **WHAT:** Preserve the feature worktree, feature branch, and child checkout until integration admission succeeds.

   **WHY:** They are the recovery boundary for unpublished or mismatched child state.

---

## B. Local Merge And Child Installation

1. **WHAT:** Record the reviewed feature `HEAD`, then merge that exact commit into the persistent `dev` worktree with `--no-ff` and a commit body containing `WHAT:` and `WHY:`.

   **WHY:** The fixed check binds the merge second parent to the reviewed feature commit and derives the prior child boundary from the merge first parent.

2. **WHAT:** Initialize or update the persistent `dev` child checkout to the merged parent gitlink:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev
   git -c protocol.file.allow=always submodule update --init -- .decision-os
   ```

   **WHY:** The running dev workspace reads child files from this checkout; object availability in another worktree does not install runtime state.

---

## C. Cleanup Admission

1. **WHAT:** Run the fixed read-only check from the persistent `dev` worktree with the exact reviewed feature SHA:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev
   node bin/decision-os-dev-integration-check.mjs --feature <reviewed-feature-sha> --json
   ```

   **WHY:** The check proves one two-parent merge, the expected second parent, a clean parent tree, published old and new child objects, descendant child history, exact and clean persistent checkout installation, and a stable final `dev` SHA.

2. **WHAT:** Treat exit `0` and the JSON receipt as cleanup admission for its exact `devSha` only.

   **WHY:** A later `dev` change invalidates the receipt.

3. **WHAT:** On rejection, retain the local merge, feature worktree, and feature branch; repair the reported publication, ancestry, source, or checkout state and rerun the check.

   **WHY:** Deleting the feature boundary can make the missing child object unrecoverable.

---

## D. Push And Cleanup

1. **WHAT:** Push only the exact admitted `devSha` to `refs/heads/dev` with the Wise SSH identity.

   **WHY:** Branch-name push after a later local commit would exceed the receipt boundary.

2. **WHAT:** After the exact push succeeds, remove the completed feature worktree, delete the merged feature branch, and remove only iteration-temporary artifacts.

   **WHY:** Cleanup is safe only after both parent and child delivery boundaries are reconstructable.

3. **WHAT:** Do not promote `main`, restart the server, rewrite prompt bytes, or close a master task unless separately authorized.

   **WHY:** Feature integration into `dev` owns none of those lifecycle decisions.

---

## E. Rejection Codes

1. `dev_integration_merge_required` — `dev` `HEAD` is not one two-parent merge.
2. `dev_integration_feature_mismatch` — the reviewed feature SHA is not the merge second parent.
3. `dev_integration_feature_invalid` — the supplied feature value is not one full lowercase Git object ID.
4. `dev_integration_gitlink_unpublished` — the configured child source does not provide the merged gitlink.
5. `dev_integration_previous_gitlink_unpublished` — the configured child source no longer provides the first-parent gitlink.
6. `dev_integration_child_history_diverged` — the merged gitlink does not descend from the first-parent gitlink.
7. `dev_integration_child_uninitialized` — the persistent `dev` child repository is absent.
8. `dev_integration_child_mismatch` — the persistent child checkout does not match the merged gitlink.
9. `dev_integration_child_dirty` — non-ignored authored child bytes differ from the merged gitlink.
10. `dev_integration_parent_dirty` — parent files outside the mutable child checkout changed after merge.
