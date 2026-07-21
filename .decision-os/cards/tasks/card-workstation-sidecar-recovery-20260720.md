Ledger: Tasks
Waiting since: 2026-07-20T12:39:15.000Z

## A. Objective

1. Pull Decision OS main and recover every workstation-owned migrated task card and thread sidecar that was left as an empty canonical placeholder.
2. Run the recovery for every workstation-local project that has a canonical Tasks ledger, including all source ledgers for admin, Ardaria, rudy, MOH, Search, and decision-os.
3. Preserve every non-empty destination and stop on conflicting source copies.

---

## B. Required process

1. Read every applicable AGENTS.md before changing each repository.
2. In the Decision OS repository, pull origin/main and verify commit 0af776df or its descendant is checked out.
3. Run migrate-master-tasks as a dry run and then with --write for every source-ledger / tasks-ledger pair. Set DECISION_OS_SERVER_URL and DECISION_OS_PROJECT_ID so Tasks mutations go through the running worker.
4. Record the exact restored card-file and thread-file counts per project.
5. Verify restored destination hashes match their retained source-domain sidecars and that no non-empty canonical sidecar was overwritten.
6. Commit only the recovered task sidecars and push the focused commit. Preserve unrelated operator changes.

---

## C. Restart and synchronization gate

1. Restart the workstation Decision OS server once recovery and push are complete, using the repository server procedure and the registered workstation port.
2. Verify the replacement process and HTTP Control Room route.
3. Verify the workstation projection has zero invalid Waiting since diagnostics for recoverable workstation-owned tasks.
4. Wait for federation anti-entropy, then verify mobile and workstation task totals, owner-node coverage, replica counts, projection conflicts, and restored content hashes are synchronized.
5. Do not mark this master task done. Reply in its thread with commands, counts, commit hashes, restart evidence, and final synchronization evidence.