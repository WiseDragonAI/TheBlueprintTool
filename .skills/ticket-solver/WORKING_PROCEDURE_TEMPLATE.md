# Work Procedure

This document defines the expected workflow for production-grade work in this repo.

## Execution Rules

1. Assume the repo is clean because the user said it is (do not run `git status`).
2. First action: send a short status update for the ticket start.
3. If you are **not** already inside a dedicated worktree, create one:
   `git worktree add .worktrees/<iid>-<short-description> -b pipeline/<iid>-<short-description> main`.
4. If you are already in a valid task worktree, continue there and do not create another worktree.
5. All implementation work happens inside the selected worktree.
6. Use this document as state of the current iteration, do not commit it during the iteration.
7. Do not run any Hangar-specific local stack bootstrap (`hangar local up` is not required).

## Phases

1. Analyze codebase surface area sequentially per task (Task 1, then Task 2, etc.). For each task:
   - Add code references and proof snippets of the current gap.
   - Add risks/unknowns and mitigations.
   - Add a short progress ping.
2. Prepare architecture (clean, non-monolithic, prod-ready; clearly commented in the doc).
   - Follow engineering rules: files <=300 lines when feasible, functions <=60 lines when feasible, comments explain WHAT/WHY.
   - Prepare planned functions/signatures as pseudo-code in the document (not final implementation).
3. Prepare test scenarios using the repository's local testing suite and standards.
   - Every planned function must be covered.
   - Every fix must include regression tests.
   - Every user journey must have integration coverage where applicable.
4. Implement tests in the worktree and run them.
   - If expected to fail first, verify failures map to intended behavior changes.
5. Implement code in the worktree and update the doc with task status.
6. Re-run tests and fix until passing.
   - Document meaningful lessons when assumptions were wrong.
7. After tests pass, run a review subagent and capture omissions/drift.
8. Apply final fixes for drift/omissions and report remaining spec gaps.
9. After operator validation, write a short postmortem capturing reusable technical lessons.

## Additional rules

A. Forbidden unless explicitly requested by a human: push branches, create MRs, merge to `main`.
B. Avoid `python` or `node` shell commands unless absolutely required by repository tooling.
