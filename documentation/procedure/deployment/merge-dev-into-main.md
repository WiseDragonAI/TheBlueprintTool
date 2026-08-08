# Merge Dev Into Main Without Importing Dev Decision OS State

## A. Command

1. **WHAT:** Inspect the current state and expected merge first:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-merge-dev.mjs doctor min
   node bin/decision-os-merge-dev.mjs doctor min --json
   ```

   **WHY:** Doctor infers the next canonical SemVer release from the latest `rel-X.Y.Z` tag, reports the planned `rel-<version>` and `devrel-<version>` tags, both parent SHAs, main parent and child dirt, both gitlinks, predicted conflicts, blockers, and expected commits without staging, committing, updating refs, creating logs, or entering the dev child checkout.

2. **WHAT:** Run the fixed promotion command from the primary `main` checkout only when doctor reports `RESULT READY` or JSON field `"result":"READY"`:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-merge-dev.mjs min --json
   ```

   **WHY:** The command commits main-owned Decision OS content, records its gitlink, merges the local `dev` ref without adopting the `dev` gitlink, and creates one matching rollback version across the parent and child repositories.

3. **WHAT:** Treat exit `0` and the JSON receipt as successful local promotion.

   **WHY:** The receipt identifies the admitted `dev` SHA, committed child SHA, optional child and gitlink commits, final merge SHA, exact merge parents, preserved Decision OS gitlink, four release tag targets, and final parent and child status.

4. **WHAT:** The standalone command is the sole owner of the protected `dev` to `main` merge transaction.

   **WHY:** `decision-os-delivery promote` consumes the published merge as immutable release input and performs no merge, commit, tag, and push operation.

5. **WHAT:** Treat `READY` plus doctor exit `0` as admission, `NO-GO` plus doctor exit `2` as blocked, merge exit `2` as rejected repository state, and merge exit `3` as an execution failure.

   **WHY:** The mutually exclusive result prevents automation from inferring admission from an ambiguous boolean or another occurrence of the word `ready`; rejection remains non-destructive.

6. **WHAT:** Select exactly one bump token: `maj`, `min`, or `fix`.

   **WHY:** The command never accepts a manual version. It increments the latest canonical parent `rel-X.Y.Z` tag: `maj` resets minor and fix, `min` resets fix, and `fix` increments only fix.

7. **WHAT:** Publish the exact receipt `mainSha`, parent tags, and child tags only when explicitly authorized.

   ```bash
   git push origin <mainSha>:refs/heads/main rel-<version> devrel-<version>
   git -C .decision-os push local-submodule rel-<version> devrel-<version>
   ```

   **WHY:** Production delivery admits only an already-published canonical main merge. The merge command itself never pushes, deploys, restarts a server, updates a remote submodule, and activates a release.

8. **WHAT:** Deploy the relay from the published annotated parent release tag in the canonical primary `main` checkout:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-deploy-relay.mjs rel-<version> --json
   ```

   **WHY:** The release tag is the deployment input. Its resolved commit remains only the relay health compatibility fingerprint; no detached release worktree and no canary on port `50151` participates in relay deployment.

9. **WHAT:** Read the `logFile` path from the success or rejection JSON.

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

5. **WHAT:** Create annotated tags with the inferred version after final ancestry, gitlink, and clean-status proofs pass.

   | Repository | `rel-<version>` | `devrel-<version>` |
   |---|---|---|
   | Parent | Final `main` merge commit | Admitted `dev` commit |
   | `.decision-os` | Preserved main child snapshot | Gitlink recorded by admitted `dev` |

   **WHY:** The parent release tag is a complete rollback boundary because its tree records the exact child gitlink; the matching child tags provide independent integrity and recovery references.

6. **WHAT:** Reject the promotion before mutation when either release tag already exists in either repository.

   **WHY:** Release tags are immutable rollback boundaries and must never be moved or silently replaced.

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

5. **WHAT:** Roll back by checking out the parent release tag and initializing its recorded submodule revision.

   ```bash
   git switch --detach rel-<version>
   git submodule update --init --recursive
   ```

   **WHY:** The parent `rel-<version>` tree restores the matching `.decision-os` gitlink as one release boundary.

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
