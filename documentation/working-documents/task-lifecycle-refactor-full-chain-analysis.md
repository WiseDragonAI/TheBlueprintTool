## A. Diagnostic Verdict

1. **The refactor is not complete against its canonical contract.** It introduced task events, a durable outbox, owner-qualified replica stores, content manifests, repair frames, snapshots, asynchronous archival, and optimistic UI fragments. Those components do not currently form one coherent task lifecycle.
2. **The principal defect is boundary composition.** Creation, activation, execution intent, Control Room projection, task replication, content replication, and remote readiness each make independent state decisions. Several transitions therefore become visible in the wrong order, publish an incomplete closure, lose execution identity, or claim readiness without convergence proof.
3. **The reported delayed Queue-to-Exec behavior is one observable consequence.** It is evidence of the incomplete local transition and projection contract, not the scope of the refactor.

---

## B. Canonical Architecture Being Assessed

1. `card-51612a1a-d9e5-4bb9-9beb-ed466dbf0628` requires typed task commands, exact-resource content commands, one local durability boundary, background delivery, hosted-local authority, explicit activation and execution state machines, and bounded maintenance.
2. `card-70107aab-0643-4069-8dae-5e07025970d8` requires immediate optimistic creation and execution, activation only after the first durable contribution, recoverable execution identity, and remote delivery only after local durability.
3. `card-3e39e2a1-fe3a-41d7-99a9-8caceac70b57` requires granular events, one projection update, one pending-acknowledgement update, hosted-local resolution, and causal revisions.
4. `card-3b113cfd-30be-4599-93c4-ac9c5691eab8` requires exact-gap remote repair, deduplicated pulls, project-scoped reconciliation, completion events, and bounded retry.
5. `card-c26d4516-8021-4109-b86b-ec7197f59a6f` requires one resource-specific readiness object with distinct task and content state and no contradictory synchronization claims.
6. `card-3c33dc20-067a-476f-b774-4c4e68b80bf9` requires selected-resource priority, bounded content progress, hash verification, and scoped invalidation.
7. `card-c7280f23-c0e5-4442-aac6-729d2963378f` requires bounded snapshot retention and startup, asynchronous archival, restore, and per-project convergence diagnostics.
8. `card-9225d91f-6439-4051-9dcd-a384603f22af` requires canonical `Tasks`, event-authority migration, exact task-closure migration, optimistic behavior, reload and offline behavior, archive restore, and two-node convergence proof.

---

## C. End-to-End Lifecycle Assessment

1. **Task creation — partial.** `create-task-intake` is routed through granular task events, creates the card, annotation, thread reference, and `replicationState: local-only`, and places its initial outbox entries in `held`. The frontend inserts the new task only into `state.ledger`; it does not apply the same transition to `state.controlRoom.allTasks` and `state.controlRoom.queue`. Dependent calls are not serialized behind the creation acknowledgement because `createTaskIntake()` discards the mutation promise.
2. **Local durability — partial.** `project-task-state.ts` writes the outbox first as a recovery journal and appends the event batch second. This supports restart replay after an interrupted append. It is not the specified single transaction: the outbox, event segment, projection, compatibility ledger, and exact content sidecars are separate filesystem commits. Every accepted batch also rewrites `projection.json` and `tasks.json`.
3. **Task event authority — partial.** Known mutation actions now produce scoped structural events. The authority corrupts nested identity because `flatten()` drops every key named `id`, including `executionIntent.id`. Projection imports remain available through `/api/task-state/commit`, so aggregate projections can still generate event changes outside the original domain command path.
4. **Activation — contradicted.** Creation events are held and `recordContentContribution()` releases the task after an exact-resource contribution. Every non-create command defaults to `replication: pending`. A model patch and an execution-intent mutation against a `local-only` task can therefore publish before the held creation closure. `activateTask()` also persists `releaseTask()` before appending the activation event; a crash between those writes can publish the closure while the durable card remains `local-only`. Activation is neither the single publication gate nor one crash-safe transition.
5. **Execution admission and ownership — contradicted.** The gesture path waits for browser audio persistence before invoking the local handoff. A newly created task is absent from `state.controlRoom.allTasks`, so `navigateVoiceSubmission()` cannot create its immediate Exec row. The optimistic map has no durable intent identity, no reload restoration, no exact failure reconciliation, and no complete launch-control lock. On the server, nested intent IDs are removed from event projection, weakening `transitionExecutionIntent()` ownership checks.
6. **Control Room projection — contradicted.** `persistLedgerMutationAndRespond()` invalidates the Control Room cache before awaiting the task command. The scheduled microtask can rebuild the old projection and clear the dirty marker before the event commit. The mutation path has no post-commit invalidation. The 30-second dependency reconciliation then becomes the dependable correction, which explains delayed visibility in Queue.
7. **Task and content publication — contradicted.** The durable outbox separates response durability from peer and relay delivery and tracks acknowledgement debt. Pre-activation task mutations use `pending`, so publication can expose later events without the held creation closure. Task content also has a direct bypass: `publishCard()` calls `federation.publishContentChange()`, and voice persistence can invoke it before `recordContentContribution()` activates the task. A crash in that interval advertises content while task creation remains held.
8. **Remote repair — contradicted.** Task repair has event batches, hourly hash buckets, missing-bucket requests, chunked verified snapshots, acknowledgements, and owner-qualified stores. The HTTP repair path requests a full checkpoint only when no projection exists; the checkpoint response contains the newest snapshot without its uncovered event tail. A partial projection can therefore be served without proving the exact gap converged, and a snapshot below the maintenance threshold can remain stale on this path. Concurrent HTTP checkpoint pulls are not deduplicated. Global relay and peer reconciliation also advertises every local project, contrary to the scoped-repair acceptance condition.
9. **Federation ownership and convergence diagnostics — contradicted.** HTTP reads correctly prefer a hosted-local project, but `taskStoreForProject()` selects the local store by project ID before evaluating owner identity. Incoming events from a remote owner with the same local project ID can therefore append into the hosted-local authority. Separately, `federation-task-state-replicator.ts` keys its `convergence` map only by peer ID while each value contains one project ID. A second project frame from the same peer overwrites the first project's diagnostic state.
10. **Task and content readiness — contradicted.** Remote task readiness becomes `synchronized` when any projection exists and the owner is online. Overall readiness becomes `synchronized` when bytes exist, even when the content replica state is `stale`. The backend can consequently return a top-level synchronized status with a stale content substate. This violates the resource-specific readiness contract.
11. **Frontend synchronization contract — contradicted.** Backend `202` reads return `{ ok, error, state }`. The frontend passes `pending.replica` to `renderTaskReplicaShell()`, but that property is absent. The browser discards the server's task/content readiness detail and renders a generic shell.
12. **Content scheduling and integrity — substantially implemented.** The content replica store uses owner, project, key, and hash identity; verifies downloaded objects; retains verified stale bytes; prioritizes selected resources; and retries independently. The scheduler reserves bounded content work during task-state debt. Manifests include card Markdown, thread Markdown, linked assets, and voice references.
13. **Scoped invalidation — partial.** Federation projection changes invalidate a project and emit a project-qualified browser event. The local mutation path invalidates at the wrong time. The remote content callback initiates task checkpoints and content synchronization at node scope rather than the exact changed resource because the notification carries no resource identity.
14. **Snapshot retention and startup — missing.** `loadSnapshots()` synchronously enumerates, reads, parses, and verifies the complete snapshot directory during store construction. The current workspace contains `473` snapshot files using approximately `215M`. Retention runs only after snapshot creation and installation. Maintenance below the event-tail threshold does not prune the existing backlog.
15. **Archival and restore — partial.** Task-state artifacts are queued to an asynchronous archiver using nonblocking child processes, and a verified restore helper exists. The restore helper is not wired into task-state bootstrap or an operator recovery path. Archived-file memory is not durable, so restart can enqueue the same retained corpus again. Interactive mutation code no longer performs the earlier synchronous main-branch completion commit.
16. **Migration — contradicted as an atomic authority transition.** The migration reports moving 24 cards, 6 zones, 18 relationships, 24 card resources, 7 thread resources, one queue item, and one pipeline run. Its implementation writes `tasks.json`, `specs.json`, queues, pipelines, and sidecars before calling `/api/task-state/commit`; an authority-commit failure does not roll back those writes. Membership also expands to cross-related `codex-skill-run` cards beyond the canonical relationship-backed `subtask` closure.
17. **Behavioral verification — incomplete.** The immediate Exec test is a source-pattern assertion and encodes navigation after durable browser persistence, which contradicts the canonical timing. No served-browser test gates creation, audio persistence, upload, transcription, and launch while asserting immediate local creation, one intent, Exec placement, Codex Log selection, and launch locking. Backend tests cover individual stores and lanes but do not cover the full task-content-readiness lifecycle across two nodes and restart.

---

## D. First Incorrect Transitions

1. **Creation-to-local-projection:** the accepted intake updates the active ledger but not the Control Room task projection used by the next optimistic transition.
2. **Gesture-to-execution-intent:** the intent transition occurs after browser persistence instead of synchronously at the gesture boundary.
3. **Local-command-to-Control-Room:** cache invalidation occurs before event durability, allowing the old projection to clear the invalidation.
4. **Local-only-to-publication:** mutations after creation can enter the pending outbox before activation releases the creation closure.
5. **Activation-to-durable-state:** held entries are released before the activation event is durable.
6. **Content-durability-to-publication:** task content can publish through a direct federation callback before task activation.
7. **Event-encoding-to-ownership:** nested execution intent identity is removed while structural fields are flattened.
8. **Federation-owner-to-store:** project ID can select a hosted-local store before remote owner identity is considered.
9. **Replica-presence-to-readiness:** any partial task projection is promoted to synchronized without convergence evidence.
10. **Content-bytes-to-readiness:** stale verified bytes are promoted to synchronized overall readiness.
11. **Migration-files-to-authority:** source and destination files change before the task-event authority accepts the closure.

---

## E. Root Cause

1. **There is no single lifecycle reducer shared across client state, server command state, replication state, and readiness state.** Each layer infers lifecycle from a different proxy: UI collection membership, browser upload completion, card `replicationState`, outbox lane state, event presence, owner connectivity, content-byte presence, and runtime process observation.
2. **The refactor separated subsystems without completing the state-machine boundaries between them.** The resulting system has durable components but lacks one authoritative transition contract connecting task creation, activation, execution, replication, repair, and rendering.
3. **Several tests validate component shape instead of lifecycle behavior.** Those tests allowed contradictory timing and readiness semantics to pass despite the canonical acceptance cards.

---

## F. Structurally Correct Remediation Path

1. **Define one durable task lifecycle identity.** Generate the task ID and execution-intent ID at the initiating client transition, preserve both through event encoding, persistence, runtime ownership, reconciliation, reload, and terminal cleanup.
2. **Apply one optimistic task reducer.** The reducer must update canonical Tasks, Control Room Queue and Exec, selected task, selected Codex Log, and launch occupancy in one synchronous transition.
3. **Make the server command queue own dependent ordering.** Creation, first contribution, execution admission, and later patches for one task must serialize behind the same task command identity.
4. **Make activation the publication gate.** Every task event and exact content entry produced while `replicationState` is `local-only` must remain held. The first successfully durable contribution must commit the activation event and full-closure release in one transaction. Remove the direct task-content federation callback.
5. **Move Control Room invalidation after event durability.** Publish one scoped browser change after the committed projection is visible.
6. **Base remote readiness on checkpoint convergence.** A remote task becomes synchronized only when the peer-project checkpoint is proven converged. Content readiness must preserve `available`, `stale`, `synchronizing`, and `error` without promoting byte presence to synchronized.
7. **Key authority, convergence, and repair by owner and project.** Incoming federation events must resolve through `{ownerNodeId, localProjectId}`. Diagnostics and repair deduplication must retain independent state for every owner-project pair.
8. **Align the `202` browser contract.** Render the backend `state` object directly and preserve the active route plus optimistic edits during scoped installation refresh.
9. **Bound persistence maintenance.** Load only the newest valid snapshot on startup, prune historical snapshots in finite maintenance batches, and remove compatibility aggregate rewrites from the acknowledgement path.
10. **Make migration server-owned and transactional.** Validate the exact closure first, append authoritative task events, verify the destination projection, then commit source removal, destination resources, queues, pipelines, and sidecar relocation together.
11. **Wire restore into bootstrap.** Restore the newest verified writer-owned archive before relay reconciliation and persist an archival checkpoint so restart does not re-enqueue the retained corpus.
12. **Prove the lifecycle at asynchronous boundaries.** Add served-browser coverage with gated requests, backend restart recovery, rejected contribution recovery, held publication ordering, partial-projection repair, stale-content rendering, concurrent views, archive restore, migration rollback, and two-node convergence.

---

## G. Diagnostic Conclusion

1. **The refactor delivered a component framework, not the completed lifecycle architecture.** Content integrity, fairness, asynchronous archival, owner-qualified caches, and granular task events are meaningful foundations.
2. **Creation, execution, activation, projection visibility, convergence proof, readiness, and bounded startup remain incorrect against the canonical cards.** These are central invariants, so the master refactor cannot be considered complete.
3. **The highest-yield correction is the lifecycle identity and transition boundary.** Fixing that boundary first gives every later layer one task and one intent to persist, publish, repair, render, and reconcile.
