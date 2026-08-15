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
2. Commit intended Decision OS cards and threads in the feature `.decision-os` child repository and commit the resulting parent gitlink on the feature branch. Do not publish the child: the integration command owns exact-source child publication before the parent merge.
3. Preserve the feature worktree, feature branch, and child checkout until the integration command returns a successful receipt.
4. Parent and child feature status must be clean. The command never stashes, resets, commits, or hides unreviewed feature state.

---

## C. Canonical Dev Admission

1. The integration command fetches `origin/dev` and rejects local canonical `dev` when it differs before child-source mutation.
2. It completes canonical dev initialization and cleanliness admission, including real package-local dependencies, the exact installed child gitlink, worktree-local child visibility configuration, and no parent dirt.
3. It fetches and revalidates the exact published parent SHA immediately before child publication.
4. It requires the reviewed parent `.decision-os` gitlink to equal feature-child `HEAD`, resolves the sole child source from the reviewed parent `.gitmodules` blob, and rejects a configured child `origin` that differs from that source.
5. It observes source `dev`, proves the reviewed child descends from both the canonical dev gitlink and that observed source tip, pushes the exact child SHA with `--force-with-lease`, refetches, and requires source equality before the parent merge.
6. The one-time legacy migration replaces dependency symlinks without following their targets and repairs only the exact reproduced Search fixture mutation.
7. Every unexplained tracked, staged, and untracked dev path is a rejection.

---

## D. Merge And Child Installation

1. After the child-publication receipt proves refetched source equality, the command records the reviewed feature `HEAD` and merges that exact commit into the persistent `dev` worktree with `--no-ff`.
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
4. A pre-merge child-publication rejection leaves `dev` unmerged and preserves the feature worktree plus branch. A post-merge parent-admission rejection preserves the local merge, feature worktree, and feature branch for diagnosis.

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
11. `worktree_dev_unpublished` — local canonical `dev` differs from fetched `origin/dev` before child publication.
12. `worktree_feature_child_mismatch` — the reviewed parent gitlink and feature-child `HEAD` differ.
13. `worktree_feature_child_source_missing` — the reviewed parent `.gitmodules` blob has no `.decision-os` source.
14. `worktree_feature_child_source_dev_missing` — the reviewed child source has no valid `dev` tip.
15. `worktree_feature_child_source_override` — configured child `origin` differs from the reviewed `.gitmodules` source.
16. `worktree_feature_child_source_changed` — fetched child `origin/dev` differs from the directly observed source tip.
17. `worktree_feature_child_remote_advanced` — the source changed before the leased child push settled.
18. `worktree_feature_child_publication_failed` — the child push failed without evidence that the observed source tip advanced.
19. `worktree_feature_child_canonical_ancestry_invalid` — the reviewed child does not descend from canonical dev's gitlink.
20. `worktree_feature_child_stale_feature` — the reviewed child omits the observed source `dev` history.
21. `worktree_feature_child_publication_mismatch` — refetched child source does not equal the reviewed child SHA.
