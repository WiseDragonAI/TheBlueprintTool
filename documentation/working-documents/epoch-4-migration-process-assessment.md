# Epoch-4 Migration Process Assessment

## A. Repository Intent

1. **Epoch 4 must install one converged assignment and execution model across every registered project on a node.**
2. The offline migration must preserve task semantics, retained execution history, referenced content, and a byte-identical rollback path.
3. A node must not start the epoch-4 runtime until every registered project has passed one machine-verifiable migration transaction.
4. Workstation proof must exercise the real seven-project catalog topology before Mobile enters the maintenance window.

---

## B. Current Iteration Intent

1. `J.1` through `J.13` implement and verify the epoch-4 runtime model, assignment state, execution state, federation protocol, repository projections, and artifact collection.
2. `J.2` currently labels the offline migrator `verified`.
3. `J.14` is intended to install the same epoch-4 commit on Workstation and Mobile, migrate both catalogs offline, deploy the relay namespace, and prove three-party convergence.
4. The interrupted Workstation shadow run contradicts the `J.2` status. The runtime implementation is ahead of the process that installs it.

---

## C. Findings

1. **The semantic converter is substantially implemented. The node migration transaction is not safe enough to run again.**
   1. The project migrator deletes the active state root and rewrites Markdown, the task ledger, pipeline data, and legacy sidecars before final validation in [`task-current-state-migration.ts`](../../backend/src/business/task-state/helper/task-current-state-migration.ts).
   2. A late conversion failure therefore occurs after live mutation has started.
   3. The local `atomicWrite()` performs a temporary write and rename without file and parent-directory `fsync`. The final format marker uses the durable store path, so completion can become durable before earlier sidecars.
2. **The stopped shadow is a reproduced transaction failure, not epoch-4 proof.**
   1. `admin`, `rudy`, and `Ardaria` contain epoch-4 format markers.
   2. `decision-os`, `Search`, `MOH`, and `lys` retain epoch-3 format markers.
   3. No `node-migration-report.json` exists.
   4. Reinvocation rejects the first completed project with `task_current_state_already_migrated`.
   5. The same mixed-catalog limitation was recorded as an open corrective action after epoch 3 in [`epoch-3-production-cutover-2026-07-21.md`](../postmortem/epoch-3-production-cutover-2026-07-21.md).
3. **Node preflight is incomplete.**
   1. The node controller validates registry paths, then migrates projects serially in [`migrate-node-task-current-state.ts`](../../backend/src/business/task-state/controller/migrate-node-task-current-state.ts).
   2. Full semantic preparation occurs only when each project is reached.
   3. A defect in project four is therefore discovered after projects one through three have changed.
   4. There is no exclusive migration lock, durable phase journal, source manifest, source-drift check, automatic rollback, restart recovery, or completed-transaction verifier.
4. **The real Workstation catalog is rejected by the current path rule.**
   1. `/home/jbb/.decision-os/projects.json` registers `Ardaria_57`.
   2. `/home/jbb/Ardaria_57` is a symlink to `/media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7/Ardaria_57`.
   3. `registeredProjects()` resolves the symlink, detects a real path outside `/home/jbb`, and throws `node_task_migration_project_outside_catalog`.
   4. The stopped shadow copied that project into a normal contained directory. It did not reproduce the production topology.
5. **The GiB copies come from an incorrect rollback boundary.**
   1. The node controller recursively copies the complete master `.decision-os` directory even though migration does not mutate it.
   2. Each project migrator recursively copies the complete project `.decision-os` directory.
   3. The source catalog currently measures `497 MiB` for the master tree, `3.0 GiB` for `decision-os`, `878 MiB` for `MOH`, `550 MiB` for `rudy`, `192 MiB` for `admin`, and `99 MiB` for `lys`.
   4. The stopped backup directories measure `688 MiB` and `3.5 GiB`.
   5. These copies include voice uploads, images, historical runs, caches, prior rollback data, and settings that the migration does not mutate.
6. **Binary content is being handled three times.**
   1. Raw audio and image directories enter the recursive rollback copy.
   2. `restoreTaskContentObjects()` reinstalls every historical object without reachability filtering.
   3. The migrator captures every currently referenced resource into the new object store through one unbounded `Promise.all`.
   4. [`federation-content-manifest.ts`](../../backend/src/business/federation/helper/federation-content-manifest.ts) already records each resource as `{key, hash, bytes}` and reads the original path while verifying its hash.
   5. **Epoch-4 migration therefore does not need to copy raw media.** It must migrate the verified reference. Binary capture and garbage collection belong to the normal content lifecycle, outside schema migration.
7. **The generated proof fields are not independent verification.**
   1. `missingObjects` is emitted as literal `0`.
   2. `executionIndex.valid` is emitted as literal `true`.
   3. Missing execution artifacts are reported without blocking publication.
   4. Backup directories have no complete source manifest, verified checksums, byte count, durable completion marker, or executable restore verifier.
8. **The narrow semantic correction remains useful but does not repair this boundary.**
   1. The interrupted proof exposed an epoch-3 entity with stale `$entity:set` state and removed value lanes.
   2. The uncommitted correction converts that input to an epoch-4 causal tombstone and its focused migration test passes.
   3. It must remain a regression in the replacement migrator.

---

## D. Remediation Paths

1. **Path rejected — retry the existing loop.**
   1. It cannot resume the mixed shadow.
   2. It still mutates each project before node-wide proof.
   3. It still rejects the real Workstation symlink topology.
   4. It repeats the GiB copies.
2. **Path rejected — add skip-already-migrated behavior.**
   1. Skipping format `4` does not prove that a previously interrupted project completed all sidecar writes.
   2. It converts an unknown partial state into an accepted result.
   3. It leaves rollback and crash recovery unsolved.
3. **Selected path — replace the loop with one node-scoped, write-ahead, resumable shadow-cutover transaction.**
   1. `inventory`: acquire an exclusive catalog migration lock, resolve every registered root including external symlinks, run pure semantic preparation for all projects, hash the exact mutation set, record the source state, and prove required capacity.
   2. `backup-verified`: archive only files in the mutation manifest, preserve absence markers and modes, verify each hash, and durably publish a backup completion marker. Raw media, caches, settings, runs, and prior rollback directories are excluded.
   3. `shadow-valid`: build every epoch-4 project state and rewritten sidecar in staging without modifying live paths. Preserve current media as verified `{key, hash, bytes}` references and copy no binary payload.
   4. `commit-started`: re-hash the source manifest and abort without mutation when source state has changed.
   5. `committing`: durably journal every filesystem swap before execution. Preserve legacy state through same-filesystem renames. A normal commit failure restores completed swaps automatically.
   6. `complete`: publish one node report only after all seven projects and every sidecar match the validated shadows.
   7. `verified`: run a separate verifier over live roots, semantic inventories, assignments, execution indexes, journals, media references, backup hashes, and the complete registered project inventory.
   8. Reinvocation before commit resumes recorded preparation. Reinvocation after interrupted commit performs deterministic rollback. Reinvocation after completion verifies and returns the existing result without recopying data.
   9. Runtime startup rejects a catalog with a nonterminal migration transaction.
   10. Process-level tests inject `SIGKILL`, `ENOSPC`, `EACCES`, rename failure, report failure, second-project failure, concurrent invocation, and source drift at the first relevant boundary.
   11. A large unrelated audio fixture and image fixture prove that neither rollback nor epoch-4 staging copies them.

---

## E. Operator Decision Summary

1. **Mobile is not the current blocker.**
2. The runtime refactor is close to installable, but `J.2` must be reopened because the current installer cannot safely establish epoch 4.
3. The shortest safe route is:
   1. Implement the selected transaction boundary while retaining the discovered causal-tombstone regression.
   2. Add the independent verifier, executable rollback, real-symlink fixture, interruption matrix, and binary-no-copy fixtures.
   3. Run a new Workstation-only shadow proof against the real seven-project topology.
   4. Prove complete migration, deterministic rollback, interrupted-run recovery, and a second idempotent invocation.
   5. Update the runbook and gate ledger from those results.
   6. Only then perform Mobile read-only preflight and request authorization for the production maintenance window.
4. **No further migration should run before steps 1 and 2 are implemented and verified.**

---

## F. Implemented Transaction and Workstation Proof

1. **The selected replacement is implemented.**
   1. All registered projects are semantically prepared before backup creation.
   2. The archive manifest contains only the task-state roots and sidecars the migration mutates, with absence markers, modes, byte counts, and SHA-256 hashes.
   3. Every epoch-4 project is built and verified in a shadow root before the first active filesystem swap.
   4. The node transaction durably records each swap intent, restores every completed swap after a normal failure, and deterministically rolls back an interrupted commit on recovery.
   5. A nonterminal admission marker pauses only the affected project task-state scope while health and diagnostics remain online.
2. **Binary migration has been removed.**
   1. Local audio and image resources retain `{key, hash, bytes}` heads that resolve to their existing workspace files.
   2. The content endpoint verifies the original file against the requested hash before serving it.
   3. Only reachable remote content objects are installed locally.
   4. A multi-MiB media fixture proves that raw audio and image bytes enter neither rollback storage nor the epoch-4 object directory.
3. **Deleted-task execution history is preserved.**
   1. The real Lys catalog contains terminal executions for deleted task `card-project-sync-8112b626-7a0c-4573-9031-f253eeb029d7`.
   2. Epoch-4 execution entities are independently indexed by immutable task ID and remain readable after task deletion.
   3. Migration retains those terminal entities and records the deleted task ID in `retainedDeletedTaskIds`.
4. **The Workstation read-only planner passes against the real topology.**
   1. Registered projects: `7`.
   2. Exact mutable archive: `11,576,346` bytes.
   3. Existing referenced workspace content: `993,873,984` bytes.
   4. The real external `Ardaria_57` symlink passes lexical registration and filesystem-identity verification.
   5. The planner created no backup, shadow, migration marker, format marker, or project mutation.
5. **Verification passed.**
   1. Focused migration regression: `11/11`.
   2. Full backend suite: `394/394`.
   3. Backend typecheck: passed.
6. **Production remains unchanged.**
   1. The registered Workstation server was not stopped, restarted, or replaced.
   2. No live migration was launched.
