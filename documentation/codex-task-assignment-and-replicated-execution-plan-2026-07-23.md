## A. Status and Architecture Decision

1. **Implementation status:** This plan is historical implementation intent. Current behavior is owned by [Epoch-4 task assignment, execution, and content](./documentation/architecture/epoch-4-task-assignment-execution-and-content.md); current production progress is owned by [the Epoch-4 iteration status](./working-documents/epoch-4-task-execution-iteration-status.md).
2. **The existing task-creation modal is the task-assignment control.** Its selected node must be persisted as task domain state. No second assignment modal is required.
3. **A task has one durable assigned node.** That node owns admission, scheduling, process execution, cancellation, recovery, and live diagnostics for every execution attached to the task.
4. **Task assignment and execution lifecycle belong in the replicated task-state algebra.** They must converge through the relay with the task, card, relationship, annotation, thread-note, and content-head state.
5. **Local execution must not depend on relay availability.** When the task is assigned to the current node, launch admission, durable queueing, scheduling, process spawn, status, cancellation, and recovery complete from local state. Federation publishes the resulting state when connectivity is available.
6. **A non-owner node must dispatch to the assigned node.** It must never substitute itself as executor. When the assigned node is unavailable, the request fails with `assigned_node_unreachable` and creates no execution.
7. **One replicated execution entity is the lifecycle authority.** The direct queue, mutable pipeline run status, task `executionIntent`, card execution leases, runtime maps, and log inference must stop competing as business-state authorities.
8. **Process state remains node-local.** PID, process start identity, child handles, local paths, timers, stream handles, and cancellation handles must never enter replicated state.
9. **The change requires task-state protocol, schema, and baseline epoch `4`.** Epoch `3` lacks task assignment and execution entities. The relay and both nodes must move to epoch `4` through an offline migration with rollback artifacts.

---

## B. Verified Correction: The Modal Already Exists

1. `frontend/src/app/responsive/application.js` implements `openNewTaskProjectModal()`.
2. The modal constructs one tab for each project replica, displays the node label and online state, and records the choice in `selectedReplicaNodeId`.
3. `chooseProject()` passes that value to `createTaskIntake(project.id, project.selectedReplicaNodeId)`.
4. `createTaskIntake()` uses the value as `replicaNodeId`, places it in the optimistic projection as `ownerNodeId`, sends the mutation through `ledgerMutation()`, and adds it to the navigation URL as `?replica=<nodeId>`.
5. **The UI therefore asks the correct product question, but the answer is discarded as task domain state.** The selected node currently controls replica routing and presentation provenance instead of durable task assignment.
6. The modal must retain its current interaction and visual boundary. Its node selection must be renamed at the data boundary from replica selection to task assignment and encoded in the task mutation.

---

## C. First Incorrect Transitions

1. **Creation loses assignment.**
   1. The browser sends the selected node only as request routing context.
   2. `create-task-intake` creates the card without an `assignment` lane.
   3. `task-domain-lane-encoder.ts` has no assignment encoder.
   4. `shared/task-current-state-core/entity.ts` validates lifecycle and `executionIntent`, but it defines no assignment contract.
   5. Result: both nodes receive the same task without the node selected by the operator.
2. **Local project authority overrides the selected node.**
   1. `create-http-server.ts` proxies a project-scoped request only when the project is not hosted locally.
   2. When the current node also hosts the project, the local project handles the request even when `replicaNodeId` names the peer.
   3. Result: opening the same replicated project from Workstation and Mobile makes each server present itself as the task owner.
3. **Projection provenance becomes task identity.**
   1. `federated-control-room-projection.ts` assigns `ownerNodeId` from the projection source node.
   2. `optimistic-task-projection.js` includes `ownerNodeId` in `taskIdentity()`.
   3. `pathForTask()` uses `task.ownerNodeId` as the replica route.
   4. Result: the same logical task can be counted and addressed as two node-owned tasks even though task assignment was never persisted.
4. **Admission and scheduling use different durable authorities.**
   1. Direct start and continuation persist a canonical record in `.decision-os/codex-executions.json`.
   2. The same controllers later append a second record to `.decision-os/codex-process-queue.json`.
   3. `codex-process-scheduler.ts` reads the legacy queue and mutable pipeline manifests, not the canonical execution store.
   4. A task-state projection failure can occur after canonical enqueue and before legacy queue insertion.
   5. Result: a durable execution can remain `queued` forever without any scheduler-visible work.
5. **Process spawn can outrun durable lifecycle state.**
   1. Direct and pipeline paths invoke `executionCoordinator.spawned()` without awaiting it after the child exists.
   2. Pipeline task projection uses queued background persistence.
   3. Result: the operating-system process can run while replicated state still says `queued`, and a failed state write can leave a live child outside durable ownership.
6. **Relay convergence blocks local writes.**
   1. `taskStateForProject()` supplies `canWrite()` based on exact local-to-relay root convergence.
   2. `ProjectTaskState.assertWritable()` throws `task_state_bootstrap_incomplete` when that predicate is false.
   3. Result: a task assigned to the current node cannot reliably launch while the relay is offline, despite all execution inputs and process capacity being local.
7. **Admission rejection is hidden.**
   1. The Codex run routes call `assertCodexRuntimeAvailable()` before durable admission.
   2. A paused runtime returns HTTP `503` with `runtime-scope-paused`.
   3. The responsive start handlers write that response into `.process-message`.
   4. The active responsive detail view hides `.process-message`.
   5. Result: the button is re-enabled while the operator sees no execution and no error.
8. **Recoverable execution failures pause too much work.**
   1. A task-state projection failure registers a project-wide Codex runtime pause.
   2. An individual execution timeout registers the same project-wide pause.
   3. Result: one execution failure blocks unrelated admissions after the failed child has already settled.

---

## D. Target Task Assignment Contract

1. **D.1 — Reuse the existing creation modal.**
   1. Keep the current node tabs, online label, project choice, keyboard behavior, and modal structure.
   2. Rename `selectedReplicaNodeId` to `selectedAssignedNodeId`.
   3. Send `assignedNodeId` inside the `create-task-intake` command payload.
   4. Keep `replicaNodeId` only for content-source navigation and remote HTTP transport.
   5. Optimistically project `assignment.nodeId`, not `ownerNodeId`.
2. Add one atomic card lane:

   ```json
   {
     "assignment": {
       "nodeId": "workstation",
       "changedAt": "2026-07-23T00:00:00.000Z",
       "revision": 1
     }
   }
   ```

3. The effective assignment for a task graph is stored on the master task. Subtasks inherit it and do not create independent execution ownership.
4. Task reassignment is a dedicated task-state command. It increments the assignment revision and writes one atomic lane.
5. Reassignment is rejected with `task_execution_active` while any non-terminal execution exists for the task.
6. Concurrent offline assignment changes remain explicit task-state conflicts. A conflicted task rejects new admission with `task_assignment_conflict` until the operator resolves the assignment.
7. An execution already started before an assignment conflict continues on its recorded `executorNodeId`. The conflict blocks only new admission.
8. The logical task identity is `projectId`, `ledgerId`, and `cardId`. Assignment does not participate in identity.
9. `ownerNodeId` remains content and project provenance where that meaning is accurate. It must not be used as task assignment.
10. The Control Room displays `assignedNodeId`, `assignedNodeLabel`, and assigned-node online state from the node catalog. Workstation and Mobile must therefore show the same assignment and the same task count.

---

## E. Epoch-4 Replicated Data Model

1. Change the shared constants to:
   1. `taskStateProtocol = "decision-os-task-state/4"`.
   2. `taskCurrentStateVersion = 4`.
   3. `taskCurrentBaselineEpoch = 4`.
2. Add `execution` to `taskEntityTypes`.
3. Add an assignment validator for the atomic card lane. A missing assignment is valid only while reading unmigrated input inside the migration tool. It is invalid in an epoch-4 active store.
4. Remove `executionIntent` from card domain state after migration. Execution placement is derived from execution entities indexed by `taskId`.
5. Define each execution entity with three replicated lanes.
6. **Immutable metadata lane:**
   1. `executionId`.
   2. `requestId`.
   3. `sessionId`.
   4. `projectId`.
   5. `ledgerId`.
   6. `taskId`, set to the master-task ID for task execution and empty for a regular-ledger execution.
   7. `sourceCardId`.
   8. `ownerCardId`.
   9. `kind`.
   10. `requestedAt`.
   11. `model`.
   12. `effort`.
   13. `pipelineRunId`.
   14. `pipelineStepId`.
   15. `pipelineSkillRunId`.
   16. `predecessorExecutionId`.
   17. `restartOfExecutionId`.
7. **Atomic lifecycle lane:**
   1. `phase`.
   2. `phaseSince`.
   3. `startedAt`.
   4. `finishedAt`.
   5. `executorNodeId`.
   6. `providerSessionId`.
   7. `result`.
   8. `error`.
   9. `revision`.
8. The canonical phase set is `preparing`, `queued`, `starting`, `running`, `cancelling`, `succeeded`, `failed`, `cancelled`, and `interrupted`.
9. **Artifact-manifest lane:**
   1. Content-addressed JSONL head.
   2. Content-addressed stderr head.
   3. Content-addressed telemetry head.
   4. Content-addressed result-document head.
   5. Byte sizes and media types.
10. Live logs remain local to the executor. Terminal artifact heads use the existing lazy content-routing mechanism. Federation must not bulk-transfer growing process logs.
11. Maintain derived local indexes by `taskId`, `sessionId`, `pipelineRunId`, `phase`, and `executorNodeId`. Indexes are rebuildable and are not replicated authorities.
12. Keep one node-local process registry keyed by `executionId`. It contains PID, process start identity, child handles, artifact paths, deadlines, timers, stream handles, and abort controllers.

---

## F. Assignment-Aware Launch State Machine

1. Every launch surface calls one `TaskExecutionRouter`.
2. For a task-ledger card, the router loads the canonical task, resolves the master task, reads its conflict-free assignment, and creates an operator request ID before dispatch.
3. For a non-task ledger card, the router assigns the new execution to the current node and persists that node in the initial lifecycle lane. The coordinator rejects every later attempt to change `executorNodeId`. Non-task cards do not acquire task assignment state.
4. **Assigned node is local:**
   1. Persist the execution entity as `preparing`.
   2. Validate task state, admission policy, session ownership, pipeline dependencies, and local capacity.
   3. Transition to `queued`.
   4. Return the durable execution receipt immediately.
   5. Let the local scheduler claim it without any relay round trip.
5. **Assigned node is a connected peer:**
   1. Send one authenticated idempotent federation request to the assigned node.
   2. Include `requestId`, task identity, launch kind, selected model, selected effort, session identity, and pipeline identity.
   3. The assigned node performs the same local admission path.
   4. Return the owner node's durable execution receipt.
6. **Assigned node is unavailable:**
   1. Return HTTP `503` with `assigned_node_unreachable`.
   2. Include `assignedNodeId`.
   3. Create no execution entity.
   4. Preserve any already-completed voice transcript for explicit retry.
7. Idempotency is keyed by `projectId`, `taskId`, and `requestId`. Repeating the same request returns the original execution receipt and never starts a second process.
8. Remove relay-root equality from the local write predicate. Local corruption, unresolved assignment conflict, and incomplete epoch migration are the only task-state write blockers.
9. The federation replicator records locally dirty execution entities, republishes them when connected, and clears dirty state only after exact relay acknowledgement.
10. The scheduler claims only a `queued` execution whose `executorNodeId` equals the local node and whose predecessor has succeeded.
11. Claim writes durable `starting` before process creation.
12. Spawn writes the node-local process registry and then awaits durable `running`.
13. If durable `running` fails, terminate the child, settle the local registry, record an incident scoped to that execution, and keep the server available.
14. Process settlement writes one terminal lifecycle transition, finalizes artifact heads, clears the local process registry, and wakes the scheduler.
15. Every asynchronous publication, observation, timer, process callback, and cleanup promise ends at a contained failure boundary with execution context.

---

## G. Pipeline Execution Model

1. Pipeline definitions retain ordered steps, skill configuration, prompts, model selection, and effort selection.
2. Starting a pipeline creates an immutable `pipelineRunId` and pre-creates one execution entity for every skill.
3. Each execution records its immediate predecessor. The first skill is schedulable immediately; later skills remain `queued` but dependency-blocked.
4. Pipeline, step, and skill status are derived from their execution entities. `codex-pipelines.json` no longer stores mutable phase, PID, log path, result, and error authority.
5. The global scheduler uses the same execution index for direct runs, continuations, direct skills, saved pipelines, and project-sync skills.
6. A failed predecessor settles every dependent execution as `cancelled` with the stable reason `pipeline_dependency_failed`.
7. Restarting a pipeline creates a new `pipelineRunId` and new execution identities. The new run records `restartOfPipelineRunId`; every replacement execution records `restartOfExecutionId`.
8. Previous runs and artifacts remain immutable and inspectable.
9. Project-sync keeps its explicit plan-selected executor node. It uses the same execution entity and coordinator, while the pipeline plan supplies execution ownership instead of task assignment.

---

## H. Complete Codepath Plan

1. **Task creation modal.**
   1. Update `frontend/src/app/responsive/application.js`.
   2. Replace replica-derived optimistic ownership with assignment.
   3. Preserve the current modal implementation.
   4. Extend the served browser test to prove the selected node is present in the command payload and optimistic task.
2. **Task creation command and CLI.**
   1. Extend the project-scoped task mutation schema with required `assignedNodeId`.
   2. Encode the assignment lane in `task-mutation-command.ts` and `task-domain-lane-encoder.ts`.
   3. Update `documentation/procedure/tasks/create-and-publish-tasks-from-cli.md`.
   4. Require CLI task creation to supply an assignment.
   5. Keep task publication as the existing second operation.
3. **Assignment validation and reassignment.**
   1. Add shared assignment parsing, validation, materialization, conflict reporting, and projection tests.
   2. Add a project-scoped reassignment command.
   3. Reject active-execution reassignment.
   4. Add explicit assignment-conflict resolution.
4. **Control Room identity and counting.**
   1. Remove projection-source node from task identity in `federated-control-room-projection.ts`.
   2. Build one canonical joined task projection per logical project.
   3. Stop emitting separate task rows from local and remote replicas.
   4. Enrich the single row with assignment and executor information.
   5. Verify identical task counts on Workstation and Mobile.
5. **Card routing.**
   1. Keep `replica` in URLs exclusively as a content-source and transport hint.
   2. Stop deriving it from task assignment.
   3. Make execution actions route through the assignment-aware launch router.
6. **Execution entity core.**
   1. Add epoch-4 execution types, lane validation, merge behavior, conflict rules, hashing, bucket summaries, serialization, and projection.
   2. Add local execution indexes and deterministic rebuild.
   3. Replace `.decision-os/codex-executions.json` with epoch-4 execution entities.
7. **Execution coordinator.**
   1. Make the coordinator the only writer of execution lifecycle state.
   2. Implement awaited `admit`, `enqueue`, `claim`, `spawned`, `settle`, `cancel`, `interrupt`, and `recover` transitions.
   3. Remove task `executionIntent` projection.
8. **Direct thread start.**
   1. Route `start-thread-codex-process-controller.ts` through `TaskExecutionRouter`.
   2. Delete legacy queue insertion.
   3. Return the durable receipt before scheduler execution.
9. **Thread continuation.**
   1. Route `continue-card-skill-run-controller.ts` through the same admission path.
   2. Preserve session identity in execution metadata.
   3. Remove its duplicated queue and spawn lifecycle.
10. **Direct skill start.**
    1. Keep the temporary one-step pipeline definition.
    2. Create its execution through the shared pipeline admission path.
    3. Remove mutable runtime lifecycle from the temporary pipeline record.
11. **Saved pipeline start.**
    1. Pre-create the execution topology in `start-codex-pipeline-run-controller.ts`.
    2. Remove first-skill-only canonical admission.
    3. Remove background task-projection persistence.
12. **Pipeline scheduling and settlement.**
    1. Replace `runNextPipelineSkill()` lifecycle authority with dependency-aware execution scheduling.
    2. Reuse `launch-codex-execution-process.ts` as the supervised process boundary.
    3. Await every execution transition.
13. **Federated project-sync skills.**
    1. Route `executeFederatedPipelineSkill()` through the execution coordinator.
    2. Keep the plan-selected executor as the explicit authority.
    3. Apply the same idempotency, lifecycle, cancellation, artifact, and recovery contracts.
14. **Pipeline restart.**
    1. Stop mutating the prior pipeline run.
    2. Create a linked replacement run with new execution IDs.
    3. Preserve prior terminal records and artifacts.
15. **Voice transcription and launch.**
    1. Keep transcription as note processing, not as an execution phase.
    2. Remove voice-authored task `executionIntent`.
    3. After successful transcription, call `TaskExecutionRouter`.
    4. Preserve a completed transcript when the assigned node is unreachable.
    5. Expose one retry action that reuses the same request ID.
16. **Cancellation.**
    1. Resolve the execution entity by exact ID.
    2. Route cancellation to `executorNodeId`.
    3. Persist `cancelling` before signalling the process.
    4. Escalate `SIGTERM` to `SIGKILL` at the bounded deadline.
    5. Persist the terminal cancellation state.
17. **Session deletion.**
    1. Publish execution tombstones and session deletion state before local cleanup.
    2. Reject deletion while an execution remains active.
    3. Garbage-collect local artifacts through the explicit project-scoped maintenance command after the operator-provided retention cutoff and recorded replicated-root convergence.
18. **Compact status.**
    1. Read the execution entity and node observation.
    2. Return the canonical phase, timestamps, revision, assignment, executor, and valid actions.
    3. Remove legacy normalization aliases after migration.
19. **Detailed status and live logs.**
    1. Resolve `executorNodeId` from the execution entity.
    2. Serve locally on the executor.
    3. Proxy authenticated reads from non-executor nodes.
    4. Read terminal artifacts by exact content hash after settlement.
20. **Control Room and SSE.**
    1. Derive task placement from execution entities indexed by task.
    2. Publish one revisioned lifecycle event after each committed transition.
    3. Display exact active-phase timers anchored to `phaseSince`.
    4. Reconcile frontend state by execution revision.
21. **Optimistic launch.**
    1. Generate `requestId` before the network call.
    2. Move the task to Exec immediately with phase `preparing`, the durable assigned node, and a local timestamp.
    3. Reconcile success against the returned request ID and execution revision.
    4. On rejection, remove the optimistic state, reload canonical state, and display the server error in the active detail view.
22. **Global capacity.**
    1. Count local `starting` and `running` executions in the canonical execution index.
    2. Include node-message child processes in the same node-local capacity limiter.
    3. Keep node-message lifecycle outside task execution entities because node messages are not task-bound.
23. **Startup recovery.**
    1. Replace direct queue recovery, pipeline resume, and execution-ownership reconciliation with one recovery pass.
    2. Validate every locally assigned active execution against the process registry and PID start identity.
    3. Adopt a matching process.
    4. Settle a missing process as `interrupted`.
    5. Wake the scheduler for locally assigned queued work.
24. **Timeouts and failures.**
    1. Scope process timeouts to the exact execution.
    2. Never pause unrelated project execution after one task failure.
    3. Persist the incident and terminal execution error.
    4. Keep health, diagnostics, federation, unrelated projects, and unrelated tasks available.
25. **Legacy removal.**
    1. Delete `.decision-os/codex-process-queue.json` reads and writes after epoch-4 migration.
    2. Remove mutable pipeline runtime authority.
    3. Remove task `executionIntent`.
    4. Remove card execution lease fields once all action guards read execution entities.
    5. Remove log-derived business settlement.
    6. Retain only session history fields that identify provider conversation continuity.
26. **Non-task card execution.**
    1. Cover direct thread, direct skill, saved pipeline, continuation, cancellation, status, restart, and deletion for regular-ledger cards.
    2. Set `executorNodeId` to the admitting local node because regular-ledger cards have no task assignment.
    3. Replicate the resulting execution entity through the project epoch-4 store.
    4. Keep subsequent control and status requests routed to the recorded executor.
27. **Definition and settings endpoints.**
    1. Keep project and server skill-library CRUD outside execution lifecycle state.
    2. Keep project and server pipeline-definition CRUD outside execution lifecycle state.
    3. Keep `/api/settings/codex-processes` as node-local capacity configuration.
    4. Add regressions proving these endpoints cannot create, mutate, cancel, or settle execution entities.
28. **Debug and diagnostic endpoints.**
    1. Keep `/api/debug/codex-continue` as telemetry-only input.
    2. Remove debug control-flow dependencies from continuation correctness.
    3. Require incident and health routes to remain readable during every injected execution failure.
29. **Server restart boundary.**
    1. Stop admitting work before shutdown.
    2. Bound scheduler, child, artifact, and federation drains.
    3. Preserve durable queued and active execution state.
    4. Let the unified recovery pass adopt or interrupt exact executions after supervisor restart.

---

## I. File-Level Implementation Map

1. **Shared task-state core:** `shared/task-current-state-core/model.ts`, `entity.ts`, materialization, hashing, conflict, and type exports.
2. **Backend task state:** `backend/src/business/task-state/helper/task-current-state-types.ts`, `task-current-state-store.ts`, `project-task-state.ts`, `task-domain-lane-encoder.ts`, `task-current-state-migration.ts`, and command schemas.
3. **Relay:** `federation-relay/src/protocol.ts`, `state-entity-frames.ts`, Durable Object state handling, health metadata, compatibility rejection, and relay tests.
4. **Federation node:** `backend/src/business/federation/helper/federation-task-state-replicator.ts`, `federation-node-connector.ts`, execution observations, authenticated internal dispatch, and lazy content retrieval.
5. **Execution engine:** `backend/src/business/codex/helper/codex-execution-coordinator.ts`, `codex-execution-store.ts`, `codex-process-scheduler.ts`, `launch-codex-execution-process.ts`, the new task execution router, local process registry, and recovery monitor.
6. **Direct controllers:** `start-thread-codex-process-controller.ts`, `continue-card-skill-run-controller.ts`, direct skill start, compact status, detailed status, cancellation, and session deletion.
7. **Pipeline controllers:** pipeline start, runner, cancellation, restart, resume removal, project-sync execution, pipeline DTO projection, and pipeline status.
8. **Voice controllers:** upload orchestration, transcription completion, execution retry, and voice observation removal.
9. **Server composition:** `backend/src/business/server/helper/create-http-server.ts`, runtime initialization, route dispatch, task-store write readiness, Control Room invalidation, SSE, and diagnostic containment.
10. **Control Room:** `control-room-projection-store.ts`, `federated-control-room-projection.ts`, project catalog joining, task count derivation, assignment presentation, and execution presentation.
11. **Frontend:** `frontend/src/app/responsive/application.js`, `optimistic-task-projection.js`, thread execution controls, pipeline controls, status polling, error presentation, and voice navigation.
12. **Documentation and CLI:** task creation procedure, federation runbook, offline migration runbook, production cutover plan, and execution incident recovery documentation.

---

## J. Implementation Sequence

1. **J.1 — Freeze epoch-4 contracts.** Add assignment and execution schemas, phase transitions, conflict rules, indexes, wire frames, and protocol compatibility tests.
2. **J.2 — Build the offline migrator.** Convert epoch-3 task entities, card execution state, canonical execution records, pipeline runs, and queue entries into epoch-4 assignment and execution entities. Produce validation reports and byte-preserving rollback backups.
3. **J.3 — Persist task assignment.** Connect the existing modal, command API, CLI flow, task materialization, reassignment command, and Control Room assignment fields.
4. **J.4 — Install the replicated execution repository.** Implement execution entities, indexes, coordinator transitions, artifact manifests, and the node-local process registry.
5. **J.5 — Install assignment-aware admission.** Add local admission, authenticated remote dispatch, idempotency, offline owner rejection, and relay-independent local writes.
6. **J.6 — Replace direct execution authority.** Move thread start and continuation to the execution scheduler and delete their legacy queue dependency.
7. **J.7 — Replace pipeline execution authority.** Pre-create execution topology, derive pipeline status, implement immutable restarts, and remove mutable scheduler state from pipeline manifests.
8. **J.8 — Move exceptional launch paths.** Convert direct skills, voice handoff, and project-sync federated skills to the same coordinator.
9. **J.9 — Replace control paths.** Convert cancellation, session deletion, detailed status, compact status, live logs, terminal artifacts, SSE, and Control Room projection.
10. **J.10 — Replace recovery.** Install one execution recovery monitor and remove queue recovery, pipeline resume, and ownership reconciliation.
11. **J.11 — Complete optimistic frontend behavior.** Implement request-ID optimism, revision reconciliation, rejection rollback, visible errors, assignment display, and executor-aware action routing.
12. **J.12 — Delete legacy authorities.** Remove `executionIntent`, legacy process queue, mutable pipeline lifecycle, card execution leases, duplicate voice observations, and log-derived settlement.
13. **J.13 — Run failure and convergence verification.** Complete the verification matrix in section `L`.
14. **J.14 — Execute the epoch-4 production cutover.** Follow section `K` on Workstation, Mobile, and the relay.

---

## K. Offline Migration and Production Cutover

1. Stop Workstation and Mobile servers. Confirm no child execution remains live.
2. Create complete byte-preserving rollback backups on both nodes.
3. Run the epoch-4 migrator independently on Workstation and Mobile.
4. Assign every legacy task without durable assignment to `workstation`. Using the same deterministic default on both nodes prevents migration-created assignment conflicts.
5. Convert active legacy execution evidence only while servers are stopped. Set non-terminal legacy attempts to `interrupted`; do not resurrect a process from file state.
6. Convert pipeline history into immutable execution history. Preserve original IDs, timestamps, results, errors, and artifact hashes where available.
7. Require each migration report to prove protocol, schema, and epoch `4`; zero missing objects; valid semantic inventories; complete assignment coverage; valid execution indexes; and a complete rollback backup.
8. Deploy the epoch-4 relay against a new versioned Durable Object namespace. Retain the epoch-3 namespace unchanged for rollback.
9. Start Workstation. Let it publish its migrated state to the empty epoch-4 relay namespace.
10. Require Workstation and relay roots to match.
11. Start Mobile. Let automatic anti-entropy merge the independently migrated Mobile state through the relay.
12. Require Workstation, Mobile, and relay roots to match for every project.
13. Require byte-identical canonical projections, identical task counts, identical assignment labels, entities from both migrations, and explicit retention of real concurrent conflicts.
14. On Workstation, disconnect the relay and launch a Workstation-assigned task. Require immediate local admission, local execution, durable completion, server availability, and later relay publication after reconnection.
15. From Mobile, launch a Workstation-assigned task while both nodes are connected. Require authenticated dispatch, one execution ID, execution only on Workstation, and synchronized running state on both nodes.
16. Disconnect Workstation. From Mobile, attempt a Workstation-assigned task. Require visible `assigned_node_unreachable`, no execution entity, and no Mobile process.
17. Reassign an idle task to Mobile. Launch it from Workstation and require execution only on Mobile.
18. Read a Mobile-owned terminal artifact from Workstation and a Workstation-owned terminal artifact from Mobile. Require exact-hash lazy retrieval without bulk log transfer.
19. Restart each node once. Require identical roots, task counts, assignments, terminal histories, queued ownership, and automatic federation afterward.
20. Retain both node backups and the epoch-3 relay namespace until every verification gate passes.

---

## L. Verification Matrix

1. **Creation assignment:** select Mobile in the existing modal; inspect the command; reload both nodes; require `assignment.nodeId = "phone"` on both.
2. **CLI assignment:** create and publish a task with `assignedNodeId`; require the held-state publication contract and replicated assignment.
3. **Logical identity:** require one Control Room row per task and equal counts on both nodes.
4. **Optimistic launch timing:** delay the admission response; require the task to enter Exec before response settlement.
5. **Optimistic success:** release the response; require reconciliation to the canonical execution ID and revision; reload; require persisted state.
6. **Optimistic rejection:** reject admission; require removal of optimistic state, canonical reload, and a visible error in the active detail view.
7. **Offline local execution:** cut relay connectivity; launch a locally assigned task; require completion without federation.
8. **Remote owner dispatch:** launch a peer-assigned task; require one authenticated admission on the assigned node and no local child.
9. **Remote owner unavailable:** require `assigned_node_unreachable`, no execution entity, and no child.
10. **Idempotency:** repeat one request ID across retry and reconnect; require one execution and one child.
11. **Assignment conflict:** produce concurrent assignment changes; require explicit conflict, blocked new admission, and no duplicate execution.
12. **Active reassignment:** attempt reassignment during `starting`, `running`, and `cancelling`; require `task_execution_active`.
13. **Direct start:** require durable `queued`, scheduler claim, `starting`, `running`, and terminal settlement from one execution entity.
14. **Continuation:** require session reuse with a new execution ID and no legacy queue entry.
15. **Direct skill:** require the temporary pipeline to use the shared execution scheduler.
16. **Saved pipeline:** require all skill executions to exist at admission and only dependency-ready work to start.
17. **Pipeline failure:** fail one skill; require dependents to settle `cancelled` without process creation.
18. **Pipeline restart:** require new run and execution IDs linked to immutable prior history.
19. **Project sync:** require the plan-selected executor and shared coordinator lifecycle.
20. **Voice local owner:** transcribe and launch locally with one execution entity.
21. **Voice remote owner:** transcribe, dispatch to the assigned node, and preserve the transcript.
22. **Voice owner unavailable:** preserve the transcript, show retry, create no execution, and start no child.
23. **Cancellation:** require durable `cancelling` before signal and terminal `cancelled` after child settlement.
24. **Process-start persistence failure:** inject failure after spawn; require child termination, exact execution incident, terminal state, and server availability.
25. **Task-state persistence failure:** preserve invalid bytes, pause only the affected project state scope, keep diagnostics and unrelated execution online.
26. **Relay publication failure:** complete locally assigned work, retain dirty execution entities, reconnect, and converge automatically.
27. **Client disconnect:** abort the request boundary without cancelling an already admitted execution.
28. **Server close:** abort downstream waits, settle monitors, retain durable queued work, and recover after restart.
29. **Recovery adoption:** restart with a matching PID and start identity; require one adopted process and no duplicate child.
30. **Recovery interruption:** restart without the recorded process; require `interrupted` and preserved artifacts.
31. **Live status:** read from the non-executor; require authenticated proxy to the exact executor.
32. **Terminal status:** stop the executor; require terminal metadata and artifacts from replicated state plus lazy content.
33. **Session deletion:** require replicated tombstones before artifact garbage collection; prove pre-cutoff retention, converged-root admission, shared-hash retention, eligible byte deletion, retry idempotency, and byte-identical causal state.
34. **Capacity:** fill local capacity with mixed task execution and node-message work; require bounded queueing and no oversubscription.
35. **Timeout containment:** time out one execution; require exact child termination, persisted incident, unrelated launches, health route, diagnostics, and federation availability.
36. **Convergence:** require equal roots, equal task counts, equal assignments, equal execution histories, and byte-identical projections on Workstation, Mobile, and relay.
37. **Served interaction:** verify the existing modal, optimistic transition, success persistence, rejection reconciliation, remote dispatch, timers, cancellation, and assignment display on the operator-facing route.

---

## M. Incident Closure Map

1. **Workstation and Mobile task-count disagreement:** section `D` removes replica provenance from task identity; sections `H.4` and `L.3` require one logical row and equal counts.
2. **Run button appeared to do nothing:** sections `C.4` and `C.7` record the stranded admission plus hidden rejection paths; sections `H.21`, `L.4`, `L.5`, and `L.6` require immediate visible intent, canonical reconciliation, and visible rejection.
3. **Two competing execution queues:** sections `A.6`, `F`, `G`, and `H.25` replace the direct queue plus pipeline scheduler split with one replicated execution index.
4. **Queued execution without scheduler work:** sections `F.4`, `F.10`, `H.8`, and `H.23` make the scheduler consume the same durable entity written by admission.
5. **Process running while the Control Room says queued:** sections `F.11` through `F.14` impose `starting` before spawn and await `running` before publication.
6. **Relay outage blocked local execution:** sections `A.4`, `F.8`, `K.14`, and `L.7` remove relay convergence from local admission.
7. **Execution failure crashed or paused unrelated runtime:** sections `C.8`, `F.13`, `H.24`, `L.24`, `L.25`, and `L.35` contain failures to the exact execution and preserve server diagnostics.
8. **Stale node ownership in the task UI:** sections `B`, `C.2`, `C.3`, and `D` persist the modal choice as assignment and keep replica routing separate.
9. **Card deletion remained visible and unclickable:** `documentation/master-task-deletion-control-room-sync-analysis-2026-07-21.md` remains the owning report for optimistic deletion and held-state invalidation. This plan changes its pending-intent key from replica-qualified identity to `projectId`, `ledgerId`, and `cardId`, then requires its open served Workstation and Mobile deletion verification during `J.13`.
10. **Task deletion must not delete execution evidence accidentally:** sections `H.17`, `L.33`, and `K.20` require replicated tombstones, active-execution rejection, retained terminal history, and delayed artifact garbage collection.

---

## N. Completion Gates

1. **No launch controller writes a second queue authority.**
2. **No scheduler reads `.decision-os/codex-process-queue.json` and no scheduler reads mutable pipeline phase.**
3. **No task identity includes projection source node.**
4. **No execution action routes from the URL replica selector.**
5. **No local task-state write requires relay convergence.**
6. **No process spawn precedes durable `starting`.**
7. **No process-start callback leaves an unobserved lifecycle promise.**
8. **No log file determines authoritative business state.**
9. **No task failure pauses unrelated task execution. No task failure terminates the server.**
10. **Workstation and Mobile report the same task count, assignment, execution phase, executor, and terminal history.**
11. **A locally assigned task launches and completes while the relay is offline.**
12. **A remotely assigned task runs only on its assigned node.**
13. **The existing creation modal persists the selected assignment across reload, restart, and federation convergence.**
14. **Epoch-3 rollback remains intact until the complete production matrix passes.**
15. **Session deletion retains artifacts before the explicit cutoff and the collector deletes only unreferenced bytes after the recorded converged root is supplied.**
