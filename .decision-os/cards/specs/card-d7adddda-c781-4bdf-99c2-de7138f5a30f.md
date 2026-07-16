## A. End-to-end scenarios

1. Create an isolated test worktree with no package-local dependencies and set `TSX_TSCONFIG_PATH` to the primary checkout.
2. Change a fixture module only in the worktree, run one focused command, and prove the changed worktree source executes.
3. Run the affected package typecheck through the same CLI, then run the full suite once after focused checks pass.
4. Repeat the dependency preparation scenario with a changed lockfile and verify package-local installation is selected.

---

## B. Evidence

1. Record the worktree path, verifier invocation, dependency strategy, resolved config paths, executed test file, pass counts, and timing summary.
2. Confirm no manual dependency search, loader selection, symlink command, failed setup attempt, or test-command retry was needed.
3. Remove the test worktree and its generated dependency artifacts after verification.