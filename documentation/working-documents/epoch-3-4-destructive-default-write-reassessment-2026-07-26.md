## A. Repository Intent

1. A projected Epoch 4 content head is authoritative when its mutable card, thread, image, or execution sidecar is absent from one node.
2. **Missing and stale local bytes must never be interpreted as empty, current, rejected, completed, or intentionally replaced state.**
3. Images, voice notes, messages, and execution requests must become durable on the accepting node before relay availability, provider work, execution dispatch, or event ingestion can affect their survival.
4. An incoming projection may replace local state only after proving causal acknowledgement of the locally persisted intent and a valid forward lifecycle transition.
5. A process-backed execution may become terminal only after its required immutable artifacts are durably reachable.

---

## B. Reassessment Scope

1. Reassessed merged commit `1e9013150675b9720267e2f94396c58d2972d72d` against `epoch-3-4-destructive-default-write-audit-2026-07-26.md`.
2. Traced every production caller of `applyLedgerMutation()`, `writeThreadNotesFile()`, `writeCardDescriptionFile()`, `materializeTaskMutationInputs()`, `shouldAcceptReplicatedTaskState()`, task execution terminal transitions, voice retry, image upload, remote execution dispatch, responsive projection installation, workspace-state normalization, and Epoch 4 current-state recovery.
3. Classified a behavior as fixed only when a production caller and a regression both prove the complete boundary.
4. The complete backend and frontend suites remaining green is not closure evidence for paths that no test invokes.

---

## C. Fixed Boundaries

1. **Hosted-project local note mutations are fixed.** The browser task mutation route and `persistTaskLedgerMutation()` call `materializeTaskMutationInputs()` before `applyLedgerMutation()`.
2. **The shared materializer is fail-closed for declared resources.** It requires one content value, verifies existing and fetched bytes, validates every input before installation, and atomically installs each file.
3. **Initial thread Codex admission is fixed.** Card and thread inputs are materialized and timestamp validation occurs before an absent sidecar is installed.
4. **Card Markdown replacement is atomic.** `writeCardDescriptionFile()` uses a new temporary file and rename.
5. **Normal process settlement is fixed** for initial thread runs, continuations, local pipeline skills, and federated pipeline skills: required JSONL and stderr artifacts are captured before replicated terminal lifecycle publication.
6. **The wide-canvas aggregate frontend causal floor is implemented** for complete active-ledger installation and event-triggered thread-slice installation.
7. **Exact successful mutation-response identity is checked.** A response task clock is accepted only when its `receipt.mutationId` matches the submitted mutation.
8. **Basic voice and execution backward-phase filtering is implemented** for the production call sites that invoke `shouldAcceptReplicatedTaskState()`.
9. **Pipeline-store and Epoch 4 entity parsing reject syntax-corrupt durable JSON.** This does not establish schema validation or current-state inventory completeness.

---

## D. Remaining Defects

1. **Critical — remote-replica note mutation still has the original stale-sidecar destruction path.**

   `create-http-server.ts:2054-2147` implements a second task mutation pipeline for remote-only projects. It fetches a thread only when the cache file is absent at `:2091`. It never verifies an existing cache file against `state.store.contentHeads(key)`, then passes the file to `applyLedgerMutation()` and captures the result as a new head.

   Exact remaining sequence:

   `new authoritative head arrives` → `older replica sidecar still exists` → `mutation hydrates older bytes` → `new note is appended to older thread` → `older thread plus new note becomes the next head`

2. **Critical — remote-replica card mutations do not use the shared resource boundary.**

   The same remote route materializes only `mutation.note.threadId`. `patch-card`, `delete-card-image`, and `paste-selection` do not preflight card Markdown. A remote `patch-card` description writes the replica-cache file, while `ProjectTaskState.executeMutation()` records content contributions only for note mutations and `delete-card-image`. The updated description therefore has no synchronously committed content head and can be replaced by the previous projected object.

3. **High — legacy run-event persistence rejects only a missing sidecar, not a stale sidecar.**

   `persist-card-skill-run-events.ts:51-100` checks `existsSync()` and then hydrates the file. It does not compare the file hash and byte count with the active head. A stale existing thread can still be extended and published as a new valid contribution.

4. **Critical — create collisions remain destructive; deterministic pipeline output-card creation makes the collision reachable during retry.**

   `apply-ledger-mutation.ts:205-232` treats `create-card`, `create-task-intake`, and `create-master-task` as upserts. It writes supplied card content and an empty thread before replacing any entity with the same ID. `task-mutation-command.ts:140-180` does not require entity absence.

   `create-codex-pipeline-step-cards.ts:35-60` supplies deterministic output IDs with `comment.what: "\n"`, making this generic collision reachable during retry.

   A restart after output-card creation and before manifest or execution admission can retry the same reserved run identity, replace an existing output card body with `"\n"`, and leave rollback unable to restore the overwritten sidecar bytes.

5. **High — card copy silently drops non-materialized source content.**

   `apply-ledger-mutation.ts:502-528` removes the copied card's source `contentFile` before `duplicateCardContentFile()` reads it. `duplicateCardContentFile()` returns without error when neither a mutable source file nor inline `comment.what` exists. The copied card is committed without the authoritative source body.

6. **High — the recurring runtime-incident card bypasses materialization.**

   `synchronize-runtime-incident-review-task.ts:152-164` calls `readCardDescription()`. A missing sidecar becomes `""`, which forces a generated replacement body through direct `applyLedgerMutation()` and `executeMutation()`. Existing immutable content is not resolved before replacement.

7. **Critical — the demanded entity-receipt acceptance gate is not integrated.**

   `task-projection-acceptance.ts` defines pending receipts for `message`, `image`, `voice`, `queued-execution`, `pipeline`, and `content-head`. Production has no pending-receipt store. Its only two call sites pass `pendingReceipt: null`.

   The unit tests exercise receipt acknowledgement and explicit retry only by calling the helper directly. No production path supplies the tested receipt state.

8. **High — execution snapshot installation bypasses lifecycle acceptance.**

   `bind-thread-codex-run-log.ts:90-105` assigns every completed task execution summary directly. The status-aware helper is used only to decide whether an event should trigger a refetch at `:173-182`; it does not decide whether the fetched summary may replace installed execution state.

9. **High — pipeline and explicit-retry acceptance are unimplemented production branches.**

   No production caller invokes `shouldAcceptReplicatedTaskState()` with `domain: "pipeline"`. No production caller supplies a pending receipt with `intent: "retry"`. The explicit-retry regression therefore proves dead helper behavior rather than the operator interaction.

10. **High — backend voice lifecycle remains revision-only and can regress durable state.**

    `applyNotePatch()` reads the mutable sidecar before the shared materializer runs and rejects only when `currentRevision > incomingRevision` at `start-voice-upload-orchestration-controller.ts:116-127`. It has no forward status transition table and accepts equal revisions.

    Concurrent retry and original orchestration can share revision numbers. A later equal-revision `queued`, `transcribing`, or `finalizing` patch can replace a durable terminal transcription. The frontend filter cannot repair the already-persisted backend regression.

11. **Critical — the responsive/mobile surface bypasses the new causal gate.**

    `surface-runtime.ts:27-29` and `boot-application.ts:22-23` route every non-wide surface through `responsive/application.js`. Its mutation coordinator at `:650-693` discards `mutationId`, receipt, and task-clock data. Navigation installation at `:2719-2745` has no task-clock admission. `responsive/thread.js:306-345` installs refreshed thread state without the wide-canvas gate, and its SSE handler at `:430-447` invokes that path directly.

12. **High — execution recovery still publishes terminal state before artifacts and its callers ignore partial recovery failure.**

    `recover-task-executions.ts:54-72` transitions an execution to `interrupted` before capturing registered JSONL and stderr files. Capture failure is added to `result.failed`, but startup and operator-resume callers at `create-http-server.ts:1120-1132,1684-1705` ignore the result and may resume the runtime.

13. **High — cancellation signal failure still publishes terminal state with live evidence uncaptured.**

    `cancel-task-execution.ts:75-85` transitions to `cancelling`, fails to signal the registered process, then publishes `failed` without finalizing its artifacts. The previous artifact RCA explicitly identified this path, but the merged pass did not change it.

14. **Critical — pasted-image intent is not durable before upload.**

    `paste-thread-image-controller.ts:49-65` keeps the pending note and image only in runtime memory plus a temporary blob URL, uploads the binary, then persists the note in a second request. Reload or process loss between those requests loses the visible image intent and leaves an unreferenced captured asset.

15. **High — the image upload transaction does not implement the open asset contract.**

    `create-http-server.ts:3966-3995` creates the original and preview before acknowledgement, but deletes the already-persisted original when preview generation or content-head persistence fails. The image master task requires retaining the original and recovering derivative work independently.

16. **Critical — remote assigned execution waits for the network before any origin-node execution record exists.**

    `task-execution-router.ts:535-544` dispatches directly to the assigned remote node. `routeBatch()` does the same at `:563-578`. The origin node does not first persist a `preparing` execution intent. An unavailable relay returns `503` with no durable run request on the accepting node.

17. **High — voice Run and Pipeline intent is persisted but not restart-driven.**

    The voice note stores `codexQueueRequestId`, launch mode, target card, and pipeline before transcription. `finishVoiceUploadOrchestration()` then continues as an in-memory detached promise. No startup scanner resumes queued voice transcription or admits the stored execution request after a backend restart.

18. **Medium — card content acknowledgement still races watcher publication.**

    Hosted-project `patch-card` writes Markdown before `ProjectTaskState.executeMutation()`. Card description changes are not captured by `executeMutation()` and depend on the asynchronous file watcher. The HTTP mutation receipt can therefore acknowledge the structural mutation before the new resource head is journaled.

19. **Open by explicit decision — federated image optimization is not complete.**

    Master task `card-a7aec888-a4a8-4333-a2e3-98d57cfcf9b8` is currently `todo`. Its acceptance criteria still require offline local image intent, restart survival, preview-first demand, original-on-detail demand, deterministic derivatives, cross-node proof, and performance evidence.

20. **Critical — the shared text, voice, image, and file note path discards the mutation receipt.**

    `send-active-ledger-mutation.ts:10-23` treats a bare successful HTTP status as acknowledgement. It does not assign a mutation ID, read the task-clock header, verify the response receipt, or persist a pending entity receipt. `create-note-controller.ts:18-23` then clears `optimistic`. A delayed pre-mutation thread projection is consequently eligible for installation and `merge-local-thread-notes.ts:64-68` drops the acknowledged local note because it is no longer marked optimistic.

21. **Critical — pipeline source and predecessor Markdown are read without materialization, after output cards are already written.**

    `codex-pipeline-runner.ts:132-140,269-288` converts an absent source or predecessor sidecar into `""`. `start-codex-pipeline-run-controller.ts:230-253` creates the pipeline output cards before this input is validated. A valid immutable input can therefore become an empty skill prompt after the pipeline has already mutated the ledger.

22. **Critical — raw voice audio is federated despite the explicit transcript-only contract.**

    `federation-content-manifest.ts:39-45,86-128` resolves every `voiceFileRef` and adds the audio bytes as a `managed-asset`. `federation-content-lane.test.ts:32-56` explicitly expects the WAV path in the manifest. The implementation currently synchronizes the raw voice payload, not only its transcription.

23. **High — watcher ownership still comes from stale aggregate `tasks.json`.**

    `resolve-card-content-change.ts:40-113` builds ownership by reading ledger JSON files. Epoch 4 task mutations update task-current-state and intentionally do not rewrite `tasks.json`. A direct edit to Markdown owned by a task created after migration can therefore have no watcher owner and produce no content-head contribution.

24. **High — pipeline and continuation output-card writes are still non-atomic.**

    `codex-pipeline-runner.ts:100-107,452` and `continue-card-skill-run-controller.ts:64-71` use read-plus-direct `writeFileSync()` for watcher-visible card Markdown. A crash during either write can leave a truncated mutable file that a watcher later captures as authority.

25. **Critical — workspace-state and canvas reads still contain destructive schema-default cascades.**

    `read-canonical-decision-os-state.ts:22-26` passes JSON-valid non-object or schema-invalid state to `normalize-decision-os-state.ts:18-31`, which converts it to an empty ledger registry. `/decision-os/*` invokes that reader with `writeBack: true` at `create-http-server.ts:4073-4076`. `ensure-ledgers-canvas-document.ts:44-93` then prunes ledger cards against the empty registry and writes the canvas. `ensure-projects-canvas-document.ts:35-73` similarly replaces invalid canvas collections during ordinary reads.

    Exact remaining sequence:

    `durable state is JSON-valid but schema-invalid` → `reader substitutes empty collections` → `ordinary GET invokes ensure` → `ensure treats emptiness as authoritative` → `valid canvas entities are deleted`

26. **High — settings saves preserve syntax errors but overwrite JSON-valid schema-invalid roots.**

    `save-codex-process-settings.ts:38-66` and `save-federation-settings.ts:29-53` cast parsed JSON directly to a record. Arrays and primitives are not rejected before object spreading and atomic replacement of `.settings.json`. The invalid original bytes are not preserved and the owning scope is not paused.

27. **Critical — Epoch 4 current-state startup has no durable inventory completeness check.**

    `task-current-state-store.ts:174-185` silently skips missing `current/<entity-type>` directories and missing shard files. `validateFormat()` at `:223-231` validates protocol fields but does not verify an inventory or current root. Startup can therefore install a partial projection in which tasks, notes, resources, or executions disappear without a tombstone or incident.

28. **High — Epoch 4 migration permits terminal executions with missing primary artifact heads.**

    `prepare-epoch4-execution-migration.ts:422-465,529-549` reports missing JSONL and stderr files but still emits terminal execution entities whose artifact manifest contains null primary heads. This violates artifact-before-terminal at the migration boundary.

29. **Critical — remote-project voice, image, file, and execution requests still cross the network before local persistence.**

    The remote-project branch handles only task JSON mutation locally, then proxies other project-sensitive endpoints at `create-http-server.ts:2150`. A disconnected owner or relay therefore prevents the accepting node from durably recording the voice upload, image intent, file intent, or queued execution request.

30. **Medium — a local note command does not require an existing thread ownership reference.**

    `materialize-task-mutation-inputs.ts:25-32` selects no resource when `ledger.threadFiles[threadId]` is absent. `apply-ledger-mutation.ts:410-500` can then create a canonical thread file for the supplied ID. A mistyped or stale thread identity is accepted as a new empty ownership boundary instead of failing before mutation.

---

## E. Test Coverage Gaps

1. No regression mutates a remote-replica thread with a stale existing sidecar.
2. No regression proves remote card-description mutation publishes a new verified resource head.
3. No regression retries deterministic pipeline-card admission after the card file exists and the manifest is absent.
4. No regression copies a card whose body exists only in the immutable object store.
5. No production integration test stores and consumes a pending entity receipt.
6. No production integration test admits an explicit retry through the receipt gate.
7. No execution-summary test rejects a fetched backward lifecycle.
8. No backend voice test rejects equal-revision or higher-revision backward lifecycle patches.
9. No recovery test observes artifact heads before `interrupted`.
10. No cancellation test proves signal failure remains nonterminal until artifact capture.
11. No browser persistence test reloads between image capture, asset upload, and note commit.
12. No two-node test proves a remote execution request is durable before relay dispatch.
13. No responsive/mobile integration test rejects a projection below the acknowledged mutation clock.
14. No shared-note integration test binds text, voice, image, and file acknowledgement to an exact receipt.
15. No pipeline test starts with source or predecessor content available only as an immutable object.
16. No federation test enforces exclusion of raw voice audio.
17. No watcher test captures a direct edit to a post-migration task absent from aggregate `tasks.json`.
18. No crash-boundary test proves pipeline and continuation output-card writes are atomic.
19. No recovery test rejects JSON-valid schema-invalid state, canvas, or settings without changing their bytes.
20. No startup test removes one current-state shard and proves the project pauses instead of installing a partial projection.
21. No migration test rejects a terminal execution with absent primary artifacts.

---

## F. Required Remediation

1. **Make one asynchronous task-command boundary mandatory.** Every hosted, remote-replica, internal automation, pipeline-card, card-copy, note, voice, and legacy run-event mutation must declare every resource it reads and pass through verified materialization before any sidecar write.
2. **Remove content writes from `applyLedgerMutation()`.** Derive intended bytes in memory, persist the task mutation plus resource head through the task-state journal, atomically install the sidecar, then acknowledge the request.
3. **Reject create collisions before writing.** A `create-card` whose ID already exists must return the existing idempotent result only when the complete submitted identity matches. Every other collision returns `409` without changing content.
4. **Persist entity-scoped optimistic receipts on both frontend surfaces.** Store them by project, entity, mutation ID, lifecycle attempt, and task clock. Apply the acceptance boundary to complete ledgers, thread slices, voice status, execution summaries, pipeline summaries, mutation responses, rejection responses, and relay refreshes.
5. **Make explicit retry a durable lifecycle attempt.** The retry command must create and acknowledge a new attempt identity before a terminal state can move to `queued`.
6. **Enforce voice lifecycle transitions in the backend authority.** Materialize first, compare attempt identity plus revision plus status rank, reject backward and equal-revision conflicting patches, then persist.
7. **Persist image intent before binary work.** Create the pending note and asset identity first, retain the original independently from preview generation, resume incomplete derivation after restart, and attach the final asset heads through the same mutation receipt.
8. **Persist remote execution intent on the accepting node before dispatch.** The assigned node claims the replicated `preparing` execution and advances it to `queued`; relay unavailability leaves a durable pending request instead of returning an unrecorded failure.
9. **Resume durable voice work after restart.** Scan pending voice attempts, reopen retained backend audio, continue transcription, then admit the stored Run or Pipeline request idempotently.
10. **Apply artifact-before-terminal ordering to recovery and cancellation.** Capture available evidence first, retain process registration on capture failure, then publish `interrupted`, `failed`, or `cancelled`.
11. **Exclude raw voice audio from federation manifests.** Replicate the thread-note metadata and transcription while retaining audio only on the accepting node.
12. **Validate durable roots before normalization or merge.** JSON-valid schema-invalid state, canvas, settings, current-state inventories, and migration artifacts must pause their owning scope without changing source bytes.
13. **Build watcher ownership from the Epoch 4 projection.** Aggregate `tasks.json` must not determine ownership after cutover.
14. **Make every watcher-visible Markdown replacement atomic.**
15. Add the twenty-one missing regressions in Section E before another completion claim.

---

## G. Operator Decision Summary

1. **No — the pass did not fix every root cause and smell.**
2. It fixed the highest-frequency hosted-project thread and initial Codex destruction path.
3. It did not establish the required universal invariant because responsive/mobile, shared note submission, remote replicas, internal writers, pipeline inputs and retries, card copy, voice recovery, execution recovery, image intent, remote execution admission, workspace normalization, and current-state startup still bypass parts of it.
4. The receipt-aware helper and its tests overstate production integration: receipt ownership, pipeline acceptance, explicit retry, and responsive installation are not connected to runtime state.
5. Raw voice audio currently synchronizes across nodes, contrary to the transcript-only requirement.
6. The root causes remain: multiple mutation authorities, multiple projection-install authorities, default-on-missing persistence, no durable optimistic receipt owner, no durable pending-work recovery owner, and no repository-level artifact-before-terminal constraint.
7. The next correction must consolidate mutation, projection, recovery, and validation authority. More caller-specific guards preserve the same defect class.
