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

1. Complete implementation, tests, diff review, and scoped parent commits in the isolated feature worktree created by `decision-os-worktree create`.
2. Preserve the feature worktree and feature branch until the integration command returns a successful receipt.
3. Parent source status must be clean. Feature-child `.decision-os` status, branch, origin, and gitlink are disposable inputs and never enter dev.
4. The command never stashes, resets, or commits unreviewed parent source state.

---

## C. Canonical Dev Admission

1. The integration command fetches `origin/dev` and rejects local canonical `dev` when it differs.
2. It completes canonical dev initialization and cleanliness admission, including real package-local dependencies, the exact installed dev child gitlink, worktree-local child visibility configuration, and no parent dirt.
3. It fetches and revalidates the exact published parent SHA immediately before the parent merge.
4. It records canonical dev's exact `.decision-os` gitlink as the only child value authorized in the merge commit.
5. It performs no feature-child fetch, origin validation, ancestry validation, publication, or checkout installation.
6. The one-time legacy migration replaces dependency symlinks without following their targets and repairs only the exact reproduced Search fixture mutation.
7. Every unexplained tracked, staged, and untracked dev path is a rejection.

---

## D. Merge And Child Resolution

1. The command records the reviewed feature `HEAD` and starts a `--no-commit --no-ff` merge in the persistent `dev` worktree.
2. It automatically resolves `.decision-os` to the exact pre-merge dev gitlink, including a submodule conflict and a clean incoming gitlink change.
3. It rejects every unresolved conflict outside `.decision-os`.
4. It proves the staged gitlink equals the retained dev gitlink before creating the merge commit.
5. The merge commit contains non-empty `WHAT:` and `WHY:` paragraphs.
6. The command keeps the persistent dev child checkout at the retained gitlink.

---

## E. Fixed Integration Admission

1. The command executes:

   ```bash
   node bin/decision-os-dev-integration-check.mjs --feature <reviewed-feature-sha> --json
   ```

2. Exit `0` and the JSON receipt admit cleanup only for the receipt's exact `devSha`.
3. The check proves one two-parent merge, the expected second parent, an unchanged dev-owned gitlink, a clean parent tree, a fetchable retained child object, exact child checkout installation, clean child authored state, and a stable final dev SHA.
4. A pre-merge parent-admission rejection leaves `dev` unmerged and preserves the feature worktree plus branch. A post-merge parent-admission rejection preserves the local merge, feature worktree, and feature branch for diagnosis.

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
4. `dev_integration_gitlink_unpublished` — the configured dev child source does not provide the retained gitlink.
5. `dev_integration_child_uninitialized` — the persistent dev child repository is absent.
6. `dev_integration_child_mismatch` — the persistent child checkout does not match the retained gitlink.
7. `dev_integration_child_dirty` — non-ignored authored dev-child bytes differ from the retained gitlink.
8. `dev_integration_parent_dirty` — parent files outside the mutable child checkout changed after merge.
9. `worktree_dev_unpublished` — local canonical `dev` differs from fetched `origin/dev` before merge.
10. `worktree_feature_merge_conflict` — the feature has unresolved conflicts outside `.decision-os`.
11. `worktree_feature_merge_failed` — the merge failed without an automatically resolvable `.decision-os` conflict.
12. `worktree_dev_child_replaced` — the committed merge gitlink differs from canonical dev's pre-merge gitlink.
