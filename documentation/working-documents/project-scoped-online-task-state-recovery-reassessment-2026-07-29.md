## A. Repository Intent

1. **Task-state failures must remain project-scoped.** Unrelated projects, HTTP routes, diagnostics, federation traffic, and the server process remain available.
2. **Invalid durable state remains recoverable evidence.** Recovery builds and validates a shadow state, retains an exact rollback archive, then installs the validated state atomically.
3. **Epoch-4 state preserves causal history.** Lifecycle, assignment, relationship order, execution entities, content heads, and thread notes cannot be reconstructed by overwriting the current projection with legacy JSON.

---

## B. Current Iteration Intent

1. Reassess whether `task_state_offline_migration_required` requires a Decision OS server restart.
2. Determine whether the paused MOH project `ZGV2L01PSA` can be reconstructed and resumed while the master server remains online.
3. Select one recovery boundary that preserves MOH's partial epoch-4 state, restores missing legacy task semantics, and avoids an unrelated-project outage.

---

## C. Findings

1. **A server restart is not structurally required.**
   1. `pausedTaskProjects` already rejects MOH task-state access through `taskStateForProject()`.
   2. The master server continues serving unrelated projects and diagnostics.
   3. The project-scoped resume route already deletes one project state instance, recreates its project context, invalidates its Control Room projection, and reconciles federation.
   4. The missing boundary is a project-scoped recovery transaction between pause detection and runtime reinstallation.
2. **The visible diagnostics are derived from the legacy fallback, not independent card corruption.**
   1. MOH's legacy `tasks.json` contains `47` cards, `9` master tasks, and `38` subtask relationships.
   2. All `47` legacy cards lack epoch-4 lifecycle state.
   3. All `9` master tasks lack assignment state.
   4. All `38` subtask relationships lack positions.
   5. `control-room-projection-store.ts` renders those omissions as `invalid_lifecycle`, `missing_assignment`, and `invalid_subtask_position`.
3. **The active MOH root is a partial epoch-4 root, not an empty legacy root.**
   1. The required `format.json` marker is absent.
   2. The root retains `38` version-4 entities: `6` cards, `5` relationships, `2` executions, `12` resources, `7` thread notes, `5` ledger fields, and `1` annotation.
   3. Those entities contain newer MOH work that is absent from the legacy ledger.
   4. Rebuilding only from `tasks.json` would lose that newer state.
4. **The existing read-only migration plan rejects the partial root.**
   1. `prepareTaskCurrentStateMigrationPlan()` treats the active root as legacy when `format.json` is absent.
   2. It rejects the first version-4 entity with `invalid_legacy_task_entity`.
   3. `prepareProjectionSources()` also excludes roots containing current entities, so the partial version-4 root cannot enter through the projection-source path.
5. **The semantic restoration logic already exists.**
   1. `prepareTaskCurrentStateMigration()` derives lifecycle from existing lifecycle state, legacy status, card Markdown, then a deterministic backlog default.
   2. It assigns master tasks to the configured default node and preserves inherited subtask assignment.
   3. It deterministically orders missing relationship positions by existing position then relationship ID.
6. **The durable transaction machinery already exists.**
   1. `runTaskCurrentStateMigrationTransaction()` archives exact source bytes, builds a shadow root, revalidates source fingerprints, journals filesystem swaps, installs sidecars, verifies the installed root, and rolls back a normal failure.
   2. The node controller adds `assertCatalogOffline()`, making the shipped node command process-offline.
   3. The transaction helper itself is not inherently catalog-wide.
7. **Running the current single-project CLI beside the live server is not an acceptable recovery.**
   1. It has no server-owned project recovery lock.
   2. It does not dispose the project watcher and Codex timers before the commit window.
   3. It cannot salvage the partial version-4 root.
   4. It cannot atomically install the reopened `ProjectTaskState`, project context, Control Room slice, and federation state inside the running process.
8. **The current Control Room fallback amplifies one scoped incident.**
   1. The cache records `taskRoot: paused:ZGV2L01PSA`.
   2. It still materializes the legacy ledger as nine invalid queue cards.
   3. A paused authoritative task root should produce one project-level recovery state, not actionable task cards derived from a non-authoritative fallback.
9. **The current hot-resume path is incomplete for transactional replacement.**
   1. It reopens task state before disposing the old project context.
   2. `disposeProjectContext()` clears SSE clients without ending their responses, so context replacement can leave browser streams orphaned.
   3. It does not invalidate the Control Room project slice.
   4. It starts Codex execution recovery asynchronously through context creation instead of awaiting recovery before incident resolution.
   5. The migration admission marker is catalog-global and read only at startup; online repair needs a dynamically read project-scoped marker.

---

## D. Remediation Path

1. **Implement `recoverProjectTaskState()` as a server-owned, project-scoped transaction.**
2. Acquire one recovery lock for `projectId`.
3. Keep `pausedTaskProjects` populated so every MOH task write and execution admission remains rejected during recovery.
4. Dispose the MOH project context before the commit window, stopping its watcher, runtime timers, adopted-process monitors, cancellation deadlines, and SSE streams.
5. Validate every retained version-4 entity against schema `4`, project identity `ZGV2L01PSA`, causal clocks, hashes, and object references.
6. Prepare the legacy ledger with the canonical lifecycle, assignment, relationship-order, content, and execution migration helpers.
7. Build a shadow epoch-4 store from the prepared legacy baseline.
8. Merge the retained version-4 entities through the canonical task-state join so newer cards, relationships, executions, resources, ledger fields, and thread notes survive.
9. Require zero invalid entities, zero missing local objects, zero journals, valid execution indexes, complete master-task assignments, valid relationship positions, and a stable source fingerprint.
10. Commit through the existing archived, journaled filesystem transaction.
11. Open and validate the installed `ProjectTaskState` before resolving the incident.
12. Atomically reinstall the MOH project context, invalidate the MOH Control Room slice, publish the complete task delta, reconcile federation, await execution recovery, and schedule eligible Codex work.
13. Resolve `project-task-state:ZGV2L01PSA` only after the reopened projection and federation publication succeed.
14. Roll back the transaction and retain the pause when any validation, installation, publication, or reopening step fails.
15. Change the Control Room projection so a paused task root renders one project-level recovery diagnostic and does not materialize legacy fallback cards.

---

## E. Operator Decision Summary

1. **Revised decision:** do not require a Decision OS server restart for this recovery class.
2. **Recovery scope:** pause only MOH task-state mutations during the shadow build and atomic install.
3. **Recovery source:** merge the legacy ledger with the retained partial epoch-4 entities.
4. **Safety boundary:** preserve exact source bytes and use the existing rollback transaction.
5. **Implementation gap:** add partial-v4 salvage plus live project-context reinstallation; do not run the current migration CLI beside production.
