# Merge Dev Into Main Without Importing Dev Decision OS State

## A. Command

1. **WHAT:** Inspect the current state and expected merge first:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-merge-dev.mjs doctor
   node bin/decision-os-merge-dev.mjs doctor --json
   ```

   **WHY:** Doctor reports both parent SHAs, main parent and child dirt, both gitlinks, predicted conflicts, blockers, and expected commits without staging, committing, updating refs, creating logs, or entering the dev child checkout.

2. **WHAT:** Run the fixed promotion command from the primary `main` checkout only when doctor reports `READY yes`:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-merge-dev.mjs --json
   ```

   **WHY:** The command commits main-owned Decision OS content, records its gitlink, and merges the local `dev` ref without adopting the `dev` gitlink.

3. **WHAT:** Treat exit `0` and the JSON receipt as successful local promotion.

   **WHY:** The receipt identifies the admitted `dev` SHA, committed child SHA, optional child and gitlink commits, and final merge SHA.

4. **WHAT:** Treat doctor exit `0` as ready, doctor exit `2` as blocked, merge exit `2` as rejected repository state, and merge exit `3` as an execution failure.

   **WHY:** Rejection is intentionally non-destructive; execution failures require inspection before retry.

5. **WHAT:** Push separately only when explicitly authorized.

   **WHY:** This command never pushes, deploys, restarts a server, updates a remote submodule, or activates a release.

6. **WHAT:** Read the `logFile` path from the success or rejection JSON.

   **WHY:** Every admitted, rejected, failed, and completed invocation writes a durable local JSONL receipt.

---

## B. Admission Boundary

1. **WHAT:** The parent and `.decision-os` repositories must both be on `main`, contain no unresolved Git operation, and permit acquisition of their shared Decision OS mutation locks.

   **WHY:** Promotion must serialize with authored-content commits and other parent mutations.

2. **WHAT:** The parent index must be empty, and the only permitted unstaged parent status path is the exact `.decision-os` submodule marker.

   **WHY:** Existing staged work is protected, and the automatic pre-merge commit may contain only Decision OS state.

3. **WHAT:** The command reads child status directly with `git -C .decision-os`.

   **WHY:** The `dev` linked worktree intentionally stores `submodule.".decision-os".ignore = all` in local worktree configuration. That setting suppresses dev status noise but does not change committed gitlinks.

4. **WHAT:** The command simulates the merge before creating any commit and rejects every conflict except the exact `.decision-os` gitlink conflict.

   **WHY:** The command owns the main gitlink decision but cannot infer source-code conflict outcomes.

---

## C. Fixed Mutation Sequence

1. **WHAT:** Stage and commit all non-ignored child changes with the fixed `Snapshot main Decision OS state` commit message.

   **WHY:** Authored Decision OS state belongs to the child repository; ignored runtime, cache, settings, uploads, and execution state remain outside Git.

2. **WHAT:** Stage and commit only `.decision-os` in the parent with the fixed `Advance main Decision OS snapshot` commit message.

   **WHY:** The parent records one gitlink and never individual child files.

3. **WHAT:** Merge the admitted local `dev` SHA using `--no-commit --no-ff`, restore `.decision-os` from post-snapshot `main`, verify the gitlink, and create `Merge dev into main`.

   **WHY:** Source changes are promoted while main-owned Decision OS history remains authoritative.

4. **WHAT:** Verify that the final commit has the post-snapshot main commit as first parent and the admitted `dev` SHA as second parent.

   **WHY:** Exact ancestry is the completion proof for the local promotion.

---

## D. Rejection And Recovery

1. **WHAT:** Resolve and commit non-submodule source conflicts before retrying.

   **WHY:** The command never uses `-X ours`, `-X theirs`, or another broad automatic conflict strategy.

2. **WHAT:** Remove or commit unrelated parent dirt through its owning workflow before retrying.

   **WHY:** The promotion command cannot classify or absorb unrelated operator work.

3. **WHAT:** If a real merge differs from simulation, the command runs `git merge --abort` and reports the conflicting paths.

   **WHY:** An unexpected conflict must leave the parent outside an active merge operation.

4. **WHAT:** Do not use `git merge -s ours`, `git submodule update --remote`, or edit `.gitmodules` to suppress Decision OS drift.

   **WHY:** Those operations respectively discard dev source, change child authority, or hide main gitlink evidence globally.

---

## E. Local Promotion Logs

1. **WHAT:** Promotion logs are stored under `.decision-os-merge-dev-logs/` in the parent repository.

   **WHY:** The directory is Git-ignored, so preserved operational evidence never becomes merge input or parent dirt.

2. **WHAT:** Each invocation creates one mode-`0600` JSONL file named with its UTC timestamp and process ID.

   **WHY:** Separate append-only receipts preserve admission, child snapshot, gitlink snapshot, failure, and completion evidence without cross-run overwrites.

3. **WHAT:** Review log size before cleanup:

   ```bash
   du -sh .decision-os-merge-dev-logs
   find .decision-os-merge-dev-logs -type f -name '*.jsonl' -printf '%TY-%Tm-%Td %p\n' | sort
   ```

   **WHY:** Operators can retain recent failures while identifying old successful runs.

4. **WHAT:** Delete logs older than 30 days during regular maintenance:

   ```bash
   find .decision-os-merge-dev-logs -type f -name '*.jsonl' -mtime +30 -delete
   ```

   **WHY:** The command never cleans evidence automatically; explicit age-based cleanup bounds local disk usage.
