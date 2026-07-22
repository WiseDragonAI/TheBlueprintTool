## A. Audit Verdict

1. **Decision OS has no single authoritative Codex execution record.** One visible run is split across replicated task fields, a direct-process queue, a pipeline manifest, in-memory runtime state, the operating-system process, log files, output Markdown, session-history fields, the Control Room cache, and frontend optimistic state.
2. **The screenshot is a real state-ordering defect, not only a missing timer style.** The pipeline manifest and operating-system process can become `running` before the replicated task projection is durably changed from `queued` to `running`. The process-start callback then invalidates the Control Room immediately. That invalidation can rebuild the old queued projection, and completion of the asynchronous task-state write does not publish another invalidation.
3. **The runtime pause boundary is violated.** The first pipeline task-projection write failed with `task_state_bootstrap_incomplete` and paused `codex-runtime:ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z`. The same pipeline continued through three completed skills and launched `implementation-orchestrator` because pipeline settlement directly calls `runNextPipelineSkill()` outside the paused global scheduler.
4. **The Control Room timer has a second independent defect.** Its renderer deliberately replaces the exact stopwatch with `Queued · waiting for execution` for queued work and `Codex Log · waiting` for waiting work. The metadata still calls the same interval `executing`, producing the contradictory combination shown in the screenshot.
5. **Replication carries intent but not verified executor identity.** An active structural `executionIntent` suppresses node-local observations and clears `executionNodeId` plus `executionNodeLabel`. Production projection always emits `executionObservation: null`; the non-null observation paths exercised by federation tests are not produced by production code.
6. **The current implementation is under-factored and over-modelled at the same time.** It has many representations of the same lifecycle but no shared transition kernel that owns their order. The complexity is therefore spent on reconciliation rather than on additional product capability.
7. **The runtime-incident task ownership defect is already corrected on the pulled revision.** Commit `5fdf4ff2` changed the target from the `admin` relative path to the stable Decision OS project ID. The live Control Room now reports `card-runtime-incident-review` under project `decision-os`, project ID `ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z`. Source comments and operation names still incorrectly say `admin`.
8. **Run rejection is silent on the served responsive card route.** A paused Decision OS Codex runtime rejects both skill and pipeline admission with HTTP `503` and `runtime-scope-paused` before any run is created. The responsive detail view writes that rejection into `.process-message`, while `setMobileCodexView()` keeps `.process-message` hidden in the same detail view. The button is re-enabled with no visible explanation.

---

## B. Scope and Evidence

1. **Operator symptom:** the referenced Control Room row showed `decision-os · Workstation · Tasks · 0m executing` together with `Queued · waiting for execution` and no exact stopwatch.
2. **Referenced task:** `card-6ce8b11a-e641-4ac9-b124-76c3a23035b4`, titled `Audit and factor application button ownership`, in the Decision OS `tasks` ledger.
3. **Referenced pipeline:** `codex-pipeline-1784743425249-a1ae192c`, titled `Full Exec`.
4. **First live sample:** the replicated intent was `running` from `2026-07-22T18:06:23.023Z`, while skill `task-dependency` owned PID `1976884`.
5. **Later live sample:** `task-dependency` had completed at `2026-07-22T18:09:14.118Z`; `task-group-completeness` was running as PID `1992109`; the task intent retained pipeline ID `codex-pipeline-1784743425249-a1ae192c` and changed at `2026-07-22T18:09:14.176Z`.
6. **Current Control Room identity:** the task is owned by node `workstation`, but `executionNodeId` and `executionNodeLabel` are empty even while the pipeline process is live.
7. **Current durable files:** `.decision-os/codex-pipelines.json` contains the pipeline lifecycle; `.decision-os/codex-process-queue.json` is empty because pipeline scheduling bypasses the direct-process queue.
8. **Current run artifacts:** each active pipeline skill has a raw `.jsonl`, a marker and diagnostic `.log`, a `.jsonl.telemetry.jsonl`, and a generated output-card Markdown file.
9. **Source review:** all admission, launch, continuation, pipeline, recovery, projection, federation, Control Room, polling, status-read, task-state, incident, and lifecycle schema paths named in section `R` were inspected.
10. **Historical review:** `documentation/task-lifecycle-refactor-full-chain-analysis.md`, `documentation/subtask-master-runtime-ownership-analysis.md`, and the prior lifecycle ownership task were compared with current `main` so repaired defects are not reported as current defects.
11. **Runtime health:** `/api/health` reports `degraded`, with three active incidents and paused components `codex-runtime:ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z` plus `federated-library-sync`.
12. **Exact pipeline incident:** `incident-96654e43-7e4a-4bc8-b08e-70e341d7a469` was recorded at `2026-07-22T18:03:45.413Z` for `persist-codex-ledger-projection` with `task_state_bootstrap_incomplete`.
13. **Stack traversal:** `assertWritable()` → `executeProjectionCommand()` → `persistTaskLedgerProjection()` → `persistLedgerProjection()` → `queueLedgerProjectionPersistence()` → `persistLedger()` → `projectPipelineSkillRun()` → `spawnPipelineSkillProcess()` → `runNextPipelineSkill()` → `runCodexProcessSchedule()`.
14. **Contradicted pause evidence:** after that incident, the same pipeline completed `task-list`, `task-dependency`, and `task-group-completeness`, then launched `implementation-orchestrator` as PID `2026937` at `2026-07-22T18:15:58.361Z`.
15. **Silent-run reproduction target:** `card-c2294c71-cb87-49d6-8886-002cd0f6b036`, titled `Design Context-First Gated Full Exec Chain`, on the operator-provided Decision OS card route. The served route returned HTTP `200` during reassessment.
16. **No admission record:** the card has no `executionIntent`, `codexActiveRunId`, or `codexActiveExecutionId`; the Control Room reports `task-waiting`; the direct queue is empty; and no pipeline run references this source card.
17. **Deterministic backend rejection:** `POST /api/codex/pipelines/runs` and `POST /api/codex/skills/process` both call `assertCodexRuntimeAvailable()` before their controllers. The active incident therefore makes every new run request return HTTP `503` with `error: runtime-scope-paused`, the incident ID, and the paused scope before durable admission.
18. **Deterministic hidden feedback:** the served responsive `startPipeline()` and `startSkill()` handlers catch that response and write the error into `.process-message`. The served `setMobileCodexView()` hides `.process-message` whenever the library is in its detail view, which is the view containing the start button.

---

## C. Current Identities and Their Meanings

1. **Task ID:** identifies the master task or subtask card.
2. **`executionIntent.id`:** is polymorphic. Voice admission initially uses a note ID, direct execution uses a run ID, and pipeline execution uses a pipeline-run ID.
3. **`codexThreadRunId`:** identifies the retained durable conversation session.
4. **`codexThreadRunIds`:** preserves ordered session history.
5. **`codexRunId`:** identifies the current direct run or current pipeline skill projected onto a card.
6. **`codexActiveRunId`:** is the current card execution lease's run ID.
7. **`codexActiveExecutionId`:** fences one exact attempt of a reusable run or session.
8. **Pipeline-run ID:** identifies a complete pipeline invocation.
9. **Pipeline skill run ID:** identifies one scheduled skill inside a pipeline invocation.
10. **Queue item ID:** identifies a direct thread start or continuation request; it is usually also the run ID.
11. **Operating-system PID plus process start time:** identifies the live process for adoption and protects against PID reuse.
12. **Frontend poller key:** combines project, replica, ledger, card, and run identity but is separate from the Control Room task identity.
13. **Consequence:** one operator action can require task ID, note ID, session run ID, attempt execution ID, pipeline-run ID, pipeline skill run ID, queue item ID, and PID. Translation among these identities is repeated in controllers and projections instead of being owned by one typed record.

---

## D. Current Status Vocabularies

1. **Replicated intent:** `waiting`, `queued`, `running`, `terminal`, `failed`.
2. **Shared run schema:** `pending`, `running`, `complete`, `failed`, `cancelled`.
3. **Direct durable queue:** `pending`, `running`, `interrupted`.
4. **Pipeline manifest:** `pending`, `running`, `complete`, `failed`, `cancelled` at pipeline, step, and skill levels.
5. **Status normalizer aliases:** `processing`, `in_progress`, `completed`, `succeeded`, `failure`, `error`, `canceled`, and `stale` are accepted by the compact reader.
6. **Control Room placement:** `task-waiting`, `task-execution`, `task-backlog`, `task-complete`.
7. **Voice state:** note transcription status, `codexQueueStatus`, a node-local voice observation, and replicated execution intent progress independently.
8. **Frontend widget state:** direct and pipeline widgets each maintain their own `pending`, `running`, terminal, and `unknown` handling.
9. **Consequence:** status normalization is a recurring implementation activity. A transition can be valid in one store and absent, renamed, or stale in another.

---

## E. Actual Direct and Continuation Lifecycle

1. **Admission:** the controller takes a per-card admission lock, resolves the retained session, allocates `runId` plus `executionId`, writes card session and lease fields, and projects task intent.
2. **Queue durability:** a direct start or continuation is appended to `.decision-os/codex-process-queue.json` with `pending` status.
3. **Task durability:** the task projection is awaited before the request reports successful admission.
4. **Optimistic browser state:** voice-triggered execution separately places the task in Exec before confirmed server state.
5. **Scheduling:** the global scheduler compares the oldest pending direct queue entry with the oldest pending pipeline run.
6. **Claim:** the direct queue item becomes `running` before the queued controller is called again with `queueDispatch: true`.
7. **Launch projection:** the controller projects intent `running`, persists the task projection, then starts the shared process launch kernel.
8. **Live authority:** `runtime.codexSkillRuns[runId]` holds status, execution identity, timestamps, PID, and the non-enumerable child handle.
9. **Process identity:** the queue is updated with PID, Linux `/proc` start time, stdout path, and stderr path.
10. **Progress:** JSONL events are appended, diagnostic markers are appended to stderr, telemetry is appended separately, and frontend widgets poll detailed status.
11. **Settlement:** runtime state becomes terminal, a finish marker is appended, the queue item is removed, exact card ownership is cleared, replicated intent becomes terminal or failed, lifecycle events are published, and scheduling resumes.
12. **Failure behavior:** `clearCardCodexExecution()` catches every error and returns `false`. Callers therefore cannot distinguish removed projects, task-state write failure, malformed state, and stale ownership without inspecting secondary runtime diagnostics.

---

## F. Actual Pipeline Lifecycle

1. **Admission:** the pipeline controller creates all step output cards, allocates every skill run and execution ID, writes a pending pipeline manifest, projects source-card queue fields, and projects source intent `queued`.
2. **Scheduler authority:** pending pipeline runs live in `.decision-os/codex-pipelines.json`, not in `.decision-os/codex-process-queue.json`.
3. **Claim:** `markPipelineSkillStarted()` atomically replaces the pipeline manifest with the selected skill, step, and pipeline marked `running`.
4. **Task projection:** `projectPipelineSkillRun()` mutates the source card and output card, changes source intent to `running`, then calls `queueLedgerProjectionPersistence()`.
5. **Critical property:** `queueLedgerProjectionPersistence()` clones the ledger and starts persistence without returning a promise to the pipeline runner.
6. **Process launch:** the runner proceeds to prompt construction and process spawn without waiting for the replicated task transition.
7. **Immediate publication:** the spawn callback records the PID in the pipeline manifest and fires `onPipelineLedgerChange`, which invalidates the Control Room and publishes an SSE event.
8. **Missing publication:** completion of the queued task-state persistence has no callback that invalidates the Control Room.
9. **Progress:** the process launch kernel emits turn events; a turn-start callback triggers another invalidation and can later repair the stale queued view.
10. **Skill settlement:** runtime, output Markdown, stderr marker, pipeline manifest, source and output card leases, and task intent are updated through separate operations.
11. **Pipeline settlement:** parent status is recomputed from child skill statuses. A terminal parent triggers scheduling and terminal Control Room publication.
12. **Consequence:** the pipeline manifest is the scheduler authority, the card is the task-placement authority, runtime is the live process authority, and their transition is not one ordered commit.
13. **Pause registration:** a background projection failure invokes `onCodexBackgroundError`, sets `projectRuntime.codexRuntimePaused = true`, and records a paused runtime incident.
14. **Global scheduling gate:** the global scheduler excludes project contexts whose `codexRuntimePaused` flag is true.
15. **Pipeline bypass:** successful skill settlement invokes `runNextPipelineSkill()` directly without checking `codexRuntimePaused`.
16. **Observed result:** pausing blocks later work admitted through the scheduler but does not stop the already-running pipeline from starting its next skill. The health endpoint and pipeline endpoint therefore report incompatible control states.
17. **New admission behavior:** the HTTP admission routes reject while `codexRuntimePaused` is true before reading the payload and before creating pipeline, queue, card-lease, or task-intent state.
18. **Operator feedback behavior:** responsive skill and pipeline detail views hide the only element that receives the rejection message, so a correctly rejected request is presented as a no-op.

---

## G. Actual Voice Lifecycle

1. **Browser intent:** `navigateVoiceSubmission()` moves the task into Exec with `executionStatus: waiting` in `optimisticExecutionIntents`.
2. **Missing timestamp:** that optimistic object does not set `executionSince`; the exact Control Room timer therefore has no anchor during the first visible phase.
3. **Node-local observation:** the transcription controller writes `runtime.voiceCodexExecutionObservations[ledgerId\0cardId]`.
4. **Replicated intent callback:** transcription emits execution-intent events that the HTTP server converts into task-state transitions asynchronously.
5. **Second waiting transition:** after the upload controller returns, the HTTP handler explicitly transitions the same task to `waiting` again.
6. **Transcription completion:** the controller emits `queued`, starts the selected run or pipeline, then emits `queued`, `running`, or `failed` from the launch result.
7. **Consequence:** browser state, node-local voice observation, voice-note metadata, replicated intent, direct queue or pipeline manifest, and runtime process all represent one voice-to-Codex action. The duplicate waiting writers make ordering dependent on promise scheduling.

---

## H. Restart and Recovery Lifecycle

1. **Direct recovery:** the queue store validates PID plus process start time. A surviving process is adopted into memory and monitored every `250 ms`.
2. **Direct terminal recovery:** when the process is gone, JSONL terminal events are parsed. A valid terminal event settles the run; otherwise an exactly owned run becomes a continuation request.
3. **Pipeline recovery:** running pipeline skills independently validate PID plus process start time, repopulate runtime state, and install a separate adopted-process monitor.
4. **Pipeline terminal recovery:** when a process is gone, status is inferred from runtime and files, the manifest is reassessed, and the next skill may start.
5. **Startup ownership repair:** current startup code reconciles orphaned leases and now invalidates the Control Room after recovery.
6. **Duplicated recovery:** direct and pipeline adoption have separate monitors, timeout logic, settlement paths, scheduling callbacks, and error contexts despite operating on the same process-launch contract.
7. **Log authority leak:** recovery promotes parsed log events and stderr text patterns into terminal decisions. Logs therefore act as a fallback database despite also being diagnostic output.

---

## I. Control Room and Timer Root Cause

1. **Structural placement:** `control-room-projection-store.ts` places a task in Exec from the highest-priority active replicated intent found on the master or its relationship-backed subtasks.
2. **Timer anchor:** `executionSince` is `intent.startedAt`, falling back to `intent.changedAt`.
3. **Running presentation:** only a running row with `executionSince` reaches the `task-stopwatch` branch and receives a one-second update.
4. **Waiting presentation:** waiting rows show `Codex Log · waiting`; no stopwatch class is installed.
5. **Queued presentation:** queued rows show queue position or `Queued · waiting for execution`; no stopwatch class is installed.
6. **Metadata contradiction:** every `task-execution` row formats `executionSince` with `executionAge()` and labels it `executing`, including waiting and queued rows.
7. **Screenshot sequence:** the pipeline manifest and process had advanced, the Control Room projection still exposed `codexQueued`, the row selected the queued text branch, and metadata independently rendered the coarse execution age.
8. **Clock duplication:** Control Room uses a global one-second interval. Direct and pipeline Codex Log widgets use separate `requestAnimationFrame` or `33 ms` timeout clocks inside a `1,231`-line poller.
9. **Test gap:** frontend coverage proves `executionStopwatch()` formatting and checks that source contains `task-stopwatch`; it does not render and advance waiting, queued, running, transition, reload, and rejection states.

---

## J. Federation and Execution Context Root Cause

1. **Replicated truth:** task current state replicates `executionIntent` with only `id`, `state`, `changedAt`, `startedAt`, `settledAt`, and `error`.
2. **Missing assignment:** the intent does not contain `executionId`, executor node ID, executor node label, launch kind, pipeline skill ID, or a freshness timestamp.
3. **Local projector:** production `taskFrom()` always returns `executionObservation: null`.
4. **Federated projector:** if structural intent is active, it intentionally discards all observation members, sets `executionObservations: []`, and clears `executionNodeId` plus `executionNodeLabel`.
5. **Fallback tests:** federation tests manually construct non-null `executionObservation` values and prove logic that production never feeds.
6. **Rendered fallback:** the frontend falls back from empty execution-node fields to task owner fields. `Workstation` in the row therefore means repository/task owner, not verified executor.
7. **Liveness gap:** a replicated `running` intent can remain `running` without a matching process heartbeat. Startup reconciliation repairs known local orphans, but the Control Room projection itself cannot distinguish live, disconnected, recovering, and stale execution.
8. **Conflict suppression:** structural execution suppresses multi-node observation conflicts. The UI cannot report two nodes claiming the same execution while the structural intent remains active.

---

## K. Session, Log, and Artifact Traversal

1. **Session pointer:** the card retains the current session run ID, ordered historical run IDs, and per-run output mappings.
2. **Execution segments:** one retained session can contain several execution attempts. Stderr markers record segment start, turn start, and execution finish with the run and execution IDs.
3. **Raw event stream:** `.jsonl` is the physical Codex stdout stream. Event identity uses its physical line number so continuation cursors remain stable.
4. **Diagnostic stream:** `.log` combines Decision OS lifecycle markers with Codex stderr diagnostics.
5. **Telemetry stream:** `.jsonl.telemetry.jsonl` records per-tool timestamps, duration, command metadata, result, and byte counts.
6. **Result artifact:** the generated output-card Markdown contains the skill result and appended lifecycle prose.
7. **Detailed read cost:** every status poll synchronously reads and parses the complete JSONL, complete stderr log, and complete telemetry file before filtering returned events by `since`.
8. **Detailed status precedence:** exact in-memory status wins, pending direct queue wins next, matching pipeline skill status wins next, inferred terminal files win next, and interrupted or inferred status is last.
9. **Detailed inference:** stderr failure text can override JSONL when stderr modification time is newer; JSONL `turn.completed` produces completion; a `running` event becomes `unknown` after `120` seconds without file writes.
10. **Direct recovery inference:** the direct queue has a separate JSONL-only terminal parser.
11. **Pipeline recovery inference:** the pipeline runner has another terminal parser using JSONL plus stderr regular expressions.
12. **Historical timing:** finish time can come from the durable finish marker, telemetry completion, the next segment start, or final artifact modification time.
13. **Consequence:** raw logs, marker logs, telemetry, mutable manifests, and runtime memory are all queried to reconstruct a lifecycle that should already exist as one durable record.
14. **Performance consequence:** a one-second poll repeatedly reparses files that grow for the entire session. The `since` cursor bounds response events but does not bound server-side reads.

---

## L. Authority Matrix

1. **Task lifecycle authority:** epoch-3 task current-state CRDT.
2. **Control Room execution placement authority:** replicated card `executionIntent` selected across a master and its linked subtasks.
3. **Exact active card owner:** `codexActiveRunId` plus `codexActiveExecutionId`.
4. **Direct queue authority:** `.decision-os/codex-process-queue.json`.
5. **Pipeline scheduling authority:** `.decision-os/codex-pipelines.json`.
6. **Live process authority:** `runtime.codexSkillRuns`, child handle, PID, and process start time.
7. **Pipeline aggregate authority:** status recomputed in the pipeline manifest from skill records.
8. **Terminal fallback authority:** JSONL terminal events, stderr marker lines, stderr regexes, exit code, and file modification times.
9. **Session-history authority:** card `codexThreadRunId`, ordered run IDs, and per-run output mappings.
10. **Detailed widget authority:** `read-card-skill-run-controller.ts`, which resolves runtime, queue, pipeline manifest, artifacts, card lease, inferred status, and telemetry on every read.
11. **Compact widget authority:** runtime first, pipeline manifest second, direct queue third.
12. **Task UI authority:** cached Control Room DTO plus optimistic execution and task-intent maps.
13. **Log UI authority:** independent direct or pipeline pollers plus terminal summary caches.
14. **Executor label authority:** absent for structural execution; the UI displays repository owner as fallback.
15. **Result:** there is no one place where `queued → starting → running → terminal` is committed, versioned, and then projected outward.

---

## M. Missing Factorization and Code Quality

1. **Large lifecycle files:** nine central files total `7,647` lines. `application.js` is `3,029` lines, the Codex poller is `1,231`, the pipeline runner is `842`, the Control Room store is `617`, and the direct queue is `466`.
2. **Weak typing:** `48` Codex and Control Room production files declare `type AnyRecord = Record<string, unknown>` despite shared execution types existing.
3. **Filesystem coupling:** the Codex business package contains `108` synchronous filesystem call sites. State transition, artifact persistence, inference, and diagnostics are interleaved.
4. **Duplicated lifecycle controllers:** thread start and continuation each own admission, task projection, queue behavior, prompt construction, runtime mutation, retry, settlement, cleanup, and notification.
5. **Partial launch factorization:** `launchCodexExecutionProcess()` centralizes process mechanics, but its callers still independently decide lifecycle order and persistence.
6. **Duplicated durable schedulers:** direct requests and pipelines use different persisted stores, then a third scheduler reads both and reconstructs FIFO order by timestamp.
7. **Duplicated adopted-process monitors:** direct and pipeline recovery repeat PID checking, timeout termination, terminal inference, and rescheduling.
8. **Duplicated status reducers:** compact status, detailed status, pipeline reassessment, recovery, Control Room, federation, and frontend widgets each normalize or derive status.
9. **Duplicated clocks:** task rows, direct log widgets, and pipeline log widgets own independent elapsed-time implementations.
10. **Fire-and-forget state mutation:** pipeline task projection and event projection persistence use queued promises. Errors are recorded after callers have already advanced and published lifecycle state.
11. **Pause bypass:** pipeline chaining calls the next skill directly, outside the only scheduler check for `codexRuntimePaused`.
12. **Silent failure:** exact execution cleanup catches all exceptions and returns `false`; callers frequently continue settlement and scheduling.
13. **No effective lifecycle revision:** the compact endpoint returns `lifecycleRevision`, but current runtime and pipeline records normally provide no revision, so the live response reports `0`.
14. **Misleading compatibility fields:** cards retain current lease, current run, queued pipeline, pipeline metadata, session history, and legacy execution fields. Each mutation must delete, preserve, or translate overlapping fields.
15. **Misleading source language:** runtime-incident code comments and error operation names still say `admin` after project ownership moved to Decision OS.
16. **Test-only architecture:** federation observation tests exercise manually manufactured values that production projection cannot produce.
17. **Source-pattern verification:** the responsive timer test checks text patterns in source. It does not prove the rendered interaction or transition ordering.
18. **Hidden admission failure:** the responsive Codex detail state hides `.process-message`, but both run handlers use that node as their only rejection surface. There is no persistent run-attempt receipt because the backend correctly rejects before admission, and there is no visible incident link because the frontend discards the returned `incidentId` and `scope`.

---

## N. Over-Engineering Assessment

1. **The process kernel is justified.** Process-group termination, stream ingestion, exact execution fencing, output limits, and restart adoption solve real runtime requirements.
2. **The task CRDT is justified.** It is the production task and federation authority and must remain independent from node-local process handles.
3. **The pipeline definition model is justified.** Ordered steps and skill configuration are product data.
4. **The runtime status duplication is not justified.** Direct queue, pipeline run status, runtime map, card lease fields, card Codex fields, log markers, inferred file status, Control Room status, and widget status all describe the same active attempt.
5. **Pipeline runtime status does not belong in the pipeline definition store.** Keeping definitions plus mutable run, step, skill, PID, file, and error state in one manifest forces the pipeline runner to duplicate the direct execution engine.
6. **Lifecycle Markdown is not an authority.** Appending terminal text to output cards creates another state representation and makes user-facing output participate in recovery diagnostics.
7. **Telemetry should not reconstruct business time.** Telemetry timestamps are valuable evidence but should not be required to calculate the authoritative attempt lifecycle.
8. **The federated observation abstraction is incomplete rather than useful complexity.** It adds reconciliation branches and tests without a production producer.
9. **The current design pays for both replicated intent and runtime observation while delivering only replicated intent.** It loses executor identity and still retains the unused observation reconciliation surface.

---

## O. Target Technical Architecture

1. **Create one typed `ExecutionRecord` contract.** It contains `executionId`, `sessionId`, `taskId`, `ownerCardId`, `kind`, `pipelineRunId`, `pipelineStepId`, `pipelineSkillRunId`, `phase`, `requestedAt`, `phaseSince`, `startedAt`, `finishedAt`, `executorNodeId`, `result`, `error`, and monotonic `revision`.
2. **Use one canonical phase set:** `preparing`, `queued`, `starting`, `running`, `succeeded`, `failed`, `cancelled`, `interrupted`.
3. **Persist all operational attempts in one atomic execution store.** Direct runs, continuations, voice-triggered launches, local pipeline skills, and federated pipeline skills use the same records and FIFO scheduler.
4. **Keep pipeline definitions and topology in the pipeline store.** Derive pipeline, step, and skill presentation from execution records instead of persisting a second mutable lifecycle authority.
5. **Keep session history separate from execution attempts.** A session can have sequential attempts. Session selection controls displayed history; the active execution record controls action availability and liveness.
6. **Implement one `ExecutionCoordinator`.** It exclusively owns `admit`, `prepare`, `enqueue`, `claim`, `spawn`, `turnStarted`, `settle`, `cancel`, `interrupt`, `recover`, and `deleteSession`.
7. **Make transition ordering explicit:** persist the execution-store transition, await the task-state projection, update runtime handles, then publish one revisioned lifecycle event. Process spawn occurs only after durable `starting` state.
8. **Make task intent a typed replicated projection.** It carries `executionId`, `phase`, `requestedAt`, `phaseSince`, `executorNodeId`, `changedAt`, `settledAt`, and terminal error. It no longer uses note, session, and pipeline IDs polymorphically.
9. **Publish one live execution observation.** The assigned executor emits `executionId`, `executorNodeId`, `phase`, `observedAt`, and `expiresAt`. The observation is matched to the replicated intent by exact execution ID.
10. **Make Control Room state deterministic:** structural intent owns requested work; a matching fresh observation proves live execution; missing or expired observation yields `interrupted` and recovery diagnostics.
11. **Project one shared execution DTO.** Control Room, card navigation, federation, compact status, detailed status, SSE, desktop, and responsive views consume the same normalized phase, identities, timestamps, executor, revision, and valid actions.
12. **Render one timer component.** Every active phase displays an exact `MM:SS` timer anchored to `phaseSince`; metadata names the actual phase. The log widget consumes the same clock helper.
13. **Keep raw artifacts non-authoritative.** JSONL, stderr, and telemetry remain append-only evidence. Output Markdown contains only task results. Recovery reads the execution store first and uses process identity to settle interruption; regexes do not determine business status.
14. **Use one recovery monitor.** It adopts every live execution record by PID plus process start time and runs the same coordinator settlement path used before restart.
15. **Remove compatibility fields after migration.** Retain session history and the single replicated intent. Remove legacy execution status, duplicated current-run pipeline fields, and queue-specific card state once all consumers use the execution DTO.

---

## P. Required Implementation Sequence

1. **Specify and test the transition table.** Add shared types, legal transitions, terminal invariants, timestamp rules, executor assignment, revision increments, and exact identity fencing.
2. **Add the unified execution store.** Provide atomic replacement, corruption detection, FIFO queries, exact execution lookup, and bounded startup loading.
3. **Migrate live state on startup.** Convert direct queue entries and active pipeline skills into execution records, verify exact card leases, retain rollback backups, and reject contradictory duplicates into incident diagnostics.
4. **Introduce the coordinator behind existing endpoints.** Preserve request and response contracts while direct start, continuation, cancel, and settlement delegate to the shared lifecycle.
5. **Move pipeline skills to the coordinator.** Keep pipeline topology; remove pipeline-specific spawn, monitor, timeout, PID, and terminal inference logic.
6. **Make task projection awaited.** Delete fire-and-forget lifecycle persistence. Publish Control Room invalidation only after task-state durability returns the committed projection.
7. **Enforce one pause gate in the coordinator.** A paused runtime prevents every claim and chained pipeline transition; the active process settles without launching a successor until the scoped runtime is explicitly resumed.
8. **Add executor assignment and heartbeat.** Replicate assigned node in intent, emit a matching live observation, and surface stale execution explicitly.
9. **Replace Control Room derivation.** Consume the shared execution DTO and remove the structural-intent branch that clears executor identity.
10. **Replace frontend status and admission-failure branching.** Use one phase presenter and timer for preparing, queued, starting, and running states; remove the contradictory coarse `executing` label. Keep the run feedback region visible in the detail state. Present paused-runtime HTTP `503` responses as `Decision OS execution is paused` with the returned scope and incident ID, then leave the run button available only after the runtime resumes.
11. **Consolidate status readers and pollers.** Detailed event reads append diagnostics to the shared DTO; they do not recalculate lifecycle status.
12. **Remove obsolete representations.** Delete direct queue runtime status, mutable pipeline skill runtime status, log-derived business status, node-local voice execution maps, legacy card execution fields, and manual status alias normalization.
13. **Correct runtime-incident naming.** Replace remaining `admin` comments and operation labels with `Decision OS project` and add a regression over the live project name plus project ID.
14. **Run migration and recovery verification.** Prove queued, running, terminal, cancelled, interrupted, adopted, pipeline-step, voice-preparation, and federation cases across restart.
15. **Run served interaction verification.** Gate requests to prove optimistic display before response, confirmed persistence after reload, rejected-request reconciliation, exact timer continuity, node label correctness, and two-node convergence.

---

## Q. Acceptance Proofs

1. **Ordering:** no SSE revision can describe `running` before the matching execution record and task intent are durable.
2. **Monotonicity:** clients ignore events and poll responses whose lifecycle revision is below the current execution revision.
3. **Identity:** one exact `executionId` is present in the execution store, task intent, runtime handle, event, API DTO, and executor observation.
4. **Queue timer:** a queued row displays an exact timer from its persisted `phaseSince` and remains correct after reload.
5. **Running timer:** the queued-to-running transition changes the phase label and timer anchor once, without displaying a stale queued branch.
6. **Executor:** workstation and phone views display the same assigned node while a matching fresh observation exists.
7. **Disconnect:** expiry of the executor observation produces `interrupted`, not indefinite `running`.
8. **Recovery:** restart adopts a surviving PID without changing execution identity, revision order, phase start, or timer.
9. **Terminal settlement:** process exit produces one terminal transition and clears active ownership only for the matching execution.
10. **Pipeline:** parent and step presentation are derived from the same skill execution records used by the scheduler.
11. **Voice:** one preparing intent advances through queued and running without a second waiting writer.
12. **Artifacts:** removing lifecycle marker text from output Markdown does not change status or recovery.
13. **Federation conflict:** two fresh executor observations for the same execution produce one explicit conflict diagnostic.
14. **Rejection:** failed admission restores server-confirmed task state and leaves no queue record, active lease, optimistic map entry, or phantom timer.
15. **Coverage:** tests exercise rendered timers and transition ordering; no acceptance proof relies only on source-pattern assertions.
16. **Pause:** a forced task-projection failure pauses the runtime before process spawn; a failure after spawn lets the current attempt settle and proves no successor starts until explicit resume.
17. **Visible rejection:** from the served card route, a paused-runtime skill and pipeline admission each display the returned scope and incident ID beside the start action; neither request creates a queue item, pipeline run, card lease, or task intent.

---

## R. Evidence Register

1. `backend/src/business/codex/helper/project-card-execution-intent.ts` — replicated intent state and timestamp rules.
2. `shared/task-current-state-core/entity.ts` — allowed atomic execution-intent keys.
3. `backend/src/business/task-state/helper/task-domain-lane-encoder.ts` — execution-intent encoding.
4. `backend/src/business/task-state/helper/project-task-state.ts` — direct intent transition command queue.
5. `backend/src/business/task-state/helper/persist-ledger-projection.ts` — awaited and fire-and-forget projection paths.
6. `backend/src/business/codex/controller/start-thread-codex-process-controller.ts` — direct admission, queueing, launch, retry, and settlement.
7. `backend/src/business/codex/controller/continue-card-skill-run-controller.ts` — continuation lifecycle.
8. `backend/src/business/codex/helper/codex-process-queue.ts` — direct durability, process identity, recovery, and adopted monitor.
9. `backend/src/business/codex/helper/codex-process-scheduler.ts` — merged FIFO scheduling across two durable stores.
10. `backend/src/business/codex/helper/codex-pipeline-runner.ts` — pipeline task projection race, launch, reassessment, and settlement.
11. `backend/src/business/codex/helper/resume-codex-pipeline-runs.ts` — pipeline adoption and recovery monitor.
12. `backend/src/business/codex/helper/codex-runtime-run-store.ts` — in-memory attempt state and callbacks.
13. `backend/src/business/codex/helper/launch-codex-execution-process.ts` — shared process mechanics.
14. `backend/src/business/codex/controller/read-card-skill-run-controller.ts` — multi-source detailed status inference.
15. `backend/src/business/codex/controller/read-compact-run-status-controller.ts` — runtime, manifest, and queue precedence.
16. `backend/src/business/transcription/controller/start-voice-upload-orchestration-controller.ts` — voice observation and intent writers.
17. `backend/src/business/server/helper/control-room-projection-store.ts` — structural task execution projection.
18. `backend/src/business/server/helper/federated-control-room-projection.ts` — structural intent precedence and executor suppression.
19. `backend/src/business/server/helper/create-http-server.ts` — lifecycle callbacks, invalidation, SSE, voice transitions, and startup recovery.
20. `frontend/src/app/responsive/application.js` — optimistic execution, row rendering, metadata, SSE refresh, and Control Room clock.
21. `frontend/src/app/responsive/control-room.js` — elapsed formatting and local task projection.
22. `frontend/src/runtime/codex/effect/poll-card-skill-run.ts` — direct and pipeline log pollers plus independent clocks.
23. `frontend/test-responsive/mobile-control-room.test.mjs` — timer format and source-pattern coverage gap.
24. `backend/test/unit/server/helper/federated-control-room-projection.test.ts` — manually manufactured observation paths.
25. `backend/test/server/runtime-failsafe.integration.test.ts` — corrected runtime-incident project ownership.
26. Commit `5fdf4ff2` — corrected runtime-incident task ownership from admin to Decision OS.
27. Commit `dec8c959` — introduced replicated Codex execution intent and structural precedence.
28. Commit `87f3706c` plus merge `68122629` — added startup Control Room invalidation after execution recovery.
29. `backend/src/business/codex/helper/read-card-skill-run-event-lines.ts` — complete-file JSONL parsing on every detailed status read.
30. Runtime incident `incident-96654e43-7e4a-4bc8-b08e-70e341d7a469` — verified task-state bootstrap failure and complete pipeline call stack.
31. `backend/src/business/server/helper/create-http-server.ts:323` and admission routes at lines `2296` and `2460` — paused-runtime gate and HTTP `503` response contract.
32. `frontend/src/app/responsive/codex.js:296` and `frontend/src/app/responsive/codex-view.js:7` — run rejection written to `.process-message` and the same node hidden in detail state.
33. `.decision-os/tasks.json` plus `.decision-os/codex-process-queue.json` and `.decision-os/codex-pipelines.json` — no durable admission for `card-c2294c71-cb87-49d6-8886-002cd0f6b036` after the reported click.
