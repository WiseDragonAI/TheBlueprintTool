## A. Repository Intent

1. **Task data must remain readable when one recoverable operation fails.**
2. **Concurrent card, content, annotation, execution, and relationship candidates are valid CRDT state.** They must remain explicit until a causal resolution supersedes them.
3. **No task may disappear without an explicit tombstone.** Invalid durable bytes must remain unchanged and diagnosable.
4. **A paused boundary must match the failing owner.** A remote frame, watcher, execution, content capture, or local mutation failure must not block unrelated reads.

---

## B. Current Iteration Intent

1. Reassess the recurring resolution conflicts, project-wide locks, and the Lys card reported lost on `2026-07-25`.
2. Identify the first incorrect transitions from repository code, live diagnostics, durable task state, and the recorded Codex run.
3. Select one structural remediation that keeps reads available, prevents silent card loss, and gives the operator an explicit conflict escape.
4. This document records diagnosis only. **No Lys runtime resume, conflict resolution, or durable-state mutation was performed.**

---

## C. Live State

1. The supplied Decision OS card route currently returns HTTP `200`.
2. Its Tasks navigation and card APIs currently return HTTP `200` with compact `x-decision-os-task-clock` headers. `TaskCurrentStateStore.clientClock()` removes synthetic `migration:*` dimensions before HTTP transport at `backend/src/business/task-state/helper/task-current-state-store.ts:303`; the server uses that projection at `backend/src/business/server/helper/create-http-server.ts:2135`, `:2697`, and `:2781`.
3. The Decision OS project has no unresolved pause incident. Its execution-conflict incidents are resolved.
4. Lys project `ZGV2L2x5cw` is currently paused. `GET /p/ZGV2L2x5cw/api/ledgers/tasks/navigation` returns HTTP `503` with:
   1. Incident: `incident-29566fdc-7310-4eec-8050-5d510bf67c03`
   2. Scope: `project-task-state:ZGV2L2x5cw`
   3. Operation: `handle-federated-state-frame`
   4. Code: `task_execution_conflict`
   5. Message: `task_execution_conflict:codex-skill-1784214470331-0edde1fc:execution:0:artifacts`
   6. First observation: `2026-07-25T21:22:38.644Z`
5. Lys currently contains `39` active published card entities and `1` locally held card. Its task state contains `30` explicit conflicts:
   1. `17` execution conflicts
   2. `6` card conflicts
   3. `6` thread-note conflicts
   4. `1` annotation conflict
6. Comparison with the byte-identical pre-recovery backup found **no durable card identity removed**. The visible loss is a projection rollback, not deletion of the card entity.

---

## D. Verified Lys Card Rollback

1. The affected card is `card-3df74ad9-e109-4452-a6dc-de81bd5d5564`.
2. The successful Codex run at `/home/jbb/lys/.decision-os/runs/codex-skills/tasks/codex-skill-1785001795762-9995c47c.jsonl` changed:
   1. Card title to `Task dates, daily reset, and Bunny indisposed mode`
   2. Zone `zone-b60ab6b8-8dfd-4000-b7c3-5927536cd058` to `Task scheduling and Bunny wellbeing`
   3. Card Markdown to a `4,974`-byte head with SHA-256 `58e112b6...`
3. The current card register retains both title candidates:
   1. `workstation:24` — `Task dates, daily reset, and Bunny indisposed mode`
   2. `phone:25` — `New task intake`
4. The current zone register retains both label candidates:
   1. `workstation:25` — `Task scheduling and Bunny wellbeing`
   2. `phone:25` — `New task intake`
5. The current content register retains both heads:
   1. Workstation — `58e112b6...`, `4,974` bytes, changed `2026-07-25T17:58:18.977Z`
   2. Phone — `5883987d...`, `229` bytes, changed `2026-07-22T12:36:30.881Z`
6. The local card and thread files still match the Workstation heads. **The acknowledged content is recoverable from current local bytes.**
7. `selectedCandidate()` sorts register dots lexicographically and selects the first candidate at `backend/src/business/task-state/helper/materialize-task-current-entity.ts:114`. Because `phone` sorts before `workstation`, the stale phone title and zone become visible.
8. `materializeTaskCurrentEntity()` records the conflict but installs that arbitrary candidate at `backend/src/business/task-state/helper/materialize-task-current-entity.ts:150`.
9. This is the first incorrect card transition: **an unresolved conflict is projected as a silent stale winner instead of retaining the last validated local value with a conflict state.**
10. A concurrent `$entity` live/tombstone conflict passes through the same selector. The same defect can hide an existing card without deleting its durable entity.

---

## E. Verified Project-Lock Chain

1. The incoming frame also installed an execution artifact conflict.
2. The pre-fix projection observer called throwing `executions.find()`. Commit `83e08d0a` removed that exact throw site.
3. The broader defect remains: the frame catch at `backend/src/business/server/helper/create-http-server.ts:1408` covers protocol validation, envelope validation, durable merge, projection materialization, content-manifest work, invalidation, event publication, and observer callbacks.
4. Any exception escaping that block calls `pauseTaskProject()`. `taskStateForProject()` then denies navigation, card, and thread access for the entire project at `backend/src/business/server/helper/create-http-server.ts:452`.
5. Local persistence materialization failures use the same project-wide pause at `backend/src/business/server/helper/create-http-server.ts:469`.
6. Watched task-content failures reach the same pause through `recordProjectBackgroundFailure()` at `backend/src/business/server/helper/create-http-server.ts:614`.
7. One catalog-wide `migrationAdmissionBlocked` marker is converted into a pause for every accessed project at `backend/src/business/server/helper/create-http-server.ts:452`.
8. Any `uncaughtException` or `unhandledRejection` installs `globalRuntimeIncident` at `backend/src/business/server/helper/create-http-server.ts:397`. Every non-health and non-diagnostic route is then rejected at `backend/src/business/server/helper/create-http-server.ts:1740`.
9. **The first incorrect availability transition is the conversion of an operation, peer-frame, or observer failure into a project-wide read denial.**
10. Runtime resume reopens the store and removes the pause. It does not resolve register candidates, content-head conflicts, missing object materialization, or execution writer ownership.

---

## F. Additional Loss Boundaries

1. The paused-project fallback reads retired aggregate `tasks.json` at `backend/src/business/server/helper/create-http-server.ts:639`.
2. Lys has `40` projected cards while its aggregate `tasks.json` has `29`. A paused fallback can therefore hide active task-state cards without durable deletion.
3. Four Lys card identities have phone-owned content heads whose objects and canonical Markdown are absent locally. Their identities existed before this incident. They are deferred-content materialization debt, not the card changed a few hours earlier.
4. The only held Lys card is `card-c0db71db-b66d-4ea8-ad45-d5d59ea7496d`, titled `Technical specification — task dates, recurrence, indisposed mode, and permissions`. Its Markdown exists locally, but its held marker remains because no content contribution activated publication.
5. Watcher ownership still reads aggregate ledgers at `backend/src/business/refresh/helper/resolve-card-content-change.ts:40`. Post-migration task Markdown can therefore receive no epoch-4 content owner.
6. `loadEntityFiles()` accepts missing current directories and missing shard files at `backend/src/business/task-state/helper/task-current-state-store.ts:174`.
7. The task-state format has no expected entity inventory. A missing shard can silently remove a card from projection without a tombstone or incident.
8. Create commands write card Markdown and an empty thread before replacing an equal card ID at `backend/src/business/ledger/helper/apply-ledger-mutation.ts:205`. A retry collision can overwrite content before state admission rejects the mutation.
9. No domain conflict-resolution API exists for card fields, annotations, entity presence, content heads, relationships, assignments, or executions.
10. Execution transition and artifact mutations do not require the writer to equal `lifecycle.executorNodeId` at `backend/src/business/task-state/helper/task-execution-repository.ts:288`. Phone and Workstation can create concurrent lifecycle and artifact candidates for the same execution.

---

## G. Selected Structural Remediation

1. **Maintain one validated immutable read snapshot per project.** Navigation, card, thread, and Control Room reads always serve this snapshot.
2. **Quarantine the failing lane only.** Separate pause states for local writes, remote ingest, content capture, execution, watcher processing, and migration admission. A lane incident must not deny reads.
3. **Reject malformed and incompatible remote frames at the peer-operation boundary.** Record the incident and preserve local project availability.
4. **Isolate post-commit observers.** Content-manifest application, invalidation, execution publication, and SSE delivery each require a non-throwing terminal boundary.
5. **Remove arbitrary conflict winners.** A conflicted entity retains its last validated displayed value and exposes every candidate plus conflict metadata.
6. **Keep presence non-destructive during conflict.** A live/tombstone conflict remains visible until explicit causal resolution confirms deletion.
7. **Add one causal conflict-resolution command.** It selects the retained candidate against an exact candidate set and writes a new local dot whose context covers every conflicting dot.
8. **Resolve content atomically.** Fetch the selected object, verify its hash and length, install the canonical card or thread sidecar atomically, then publish the covering resolution dot.
9. **Enforce execution writer authority.** Only `lifecycle.executorNodeId` may mutate lifecycle and artifact lanes.
10. **Replace independent mutable shards with manifest-pinned snapshots.** Store entity JSON by content hash; atomically publish a manifest containing entity inventory, object hashes, counts, buckets, and state root; retain the previous valid manifest.
11. **On invalid current state, serve the previous validated snapshot read-only.** Quarantine writes, preserve invalid bytes, and record the exact missing or invalid object.
12. **Remove aggregate `tasks.json` from epoch-4 fallback and watcher ownership.** Both consume the validated current-state snapshot.
13. **Reject non-identical create collisions before filesystem writes.** Publish structural state and verified content heads as one admitted operation.
14. **End the global zombie lock.** A recorded process-wide invariant failure is handed to the external supervisor for bounded restart; recoverable detached-operation failures remain contained to their owner.

---

## H. Required Failure Regressions

1. Merge a stale phone title and zone into a locally acknowledged Workstation rename. Reads remain HTTP `200`, the Workstation value remains displayed with conflict metadata, and the causal resolution supersedes both candidates.
2. Merge an execution artifact conflict. The execution lane quarantines, project navigation, card, and thread reads remain HTTP `200`, and diagnostics remain readable.
3. Throw independently from content-manifest work, invalidation, execution publication, and SSE delivery. Each failure remains inside its operation boundary.
4. Merge a live/tombstone conflict. The card remains visible until explicit deletion resolution.
5. Resolve a content-head conflict. The selected object is hash-verified, atomically installed, and survives reload.
6. Remove one current entity object. Startup rejects the incomplete manifest, preserves its bytes, serves the previous valid snapshot read-only, and records the missing object without losing the card.
7. Attempt a duplicate card create with different content. The command rejects before changing the existing card or thread bytes.
8. Attempt execution mutation from a writer other than `lifecycle.executorNodeId`. The repository rejects it without creating a conflict.
9. Inject malformed and incompatible peer frames. The peer operation fails while the local project remains readable.
10. Verify every detached asynchronous operation has a terminal failure boundary and that a genuine process-wide invariant produces supervisor-owned incident evidence and bounded restart.

---

## I. Operator Decision Summary

1. **The Lys report is confirmed.** The card was not deleted, but stale phone candidates silently replaced the acknowledged Workstation title and zone in the visible projection.
2. **The current Lys lock is confirmed.** One execution conflict escaped a projection observer and paused every Lys task route.
3. **Commit `83e08d0a` fixes one throw site, not the containment model.** Other frame, observer, watcher, materializer, migration, and global exception paths can still cause broad locks.
4. **The selected fix is one coherent boundary:** always-readable validated snapshots, lane-scoped quarantine, explicit causal conflict resolution, durable manifest inventories, atomic content installation, and repository-enforced execution writer authority.
5. The affected Lys card is recoverable from current Workstation bytes. Recovery must remain a separate operator-authorized mutation after a byte-identical task-state backup.
