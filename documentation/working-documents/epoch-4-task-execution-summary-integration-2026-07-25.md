## A. Repository Intent

1. **Epoch 4 replicates task execution identity, lifecycle, ownership, and artifact heads as execution entities.**
2. **Frontend task views consume deterministic projections of replicated state.**
3. **Executor-local log bytes remain artifacts and load only when an execution is selected.**

---

## B. Current Iteration Intent

1. **A task can own several sessions.**
2. **A session can own several executions.**
3. **The task panel first receives the complete lightweight hierarchy.**
4. **The selected execution then receives one structured incremental log packet.**

---

## C. Existing Epoch 4 Coverage

1. **No new session entity is required.** Each replicated execution metadata lane already contains `taskId`, `sessionId`, `executionId`, `kind`, `requestedAt`, predecessor identity, and restart identity.
2. **Lifecycle already synchronizes.** Each execution lifecycle lane contains phase, phase timestamp, start timestamp, finish timestamp, executor node, provider session identity, result, error, and revision.
3. **Terminal artifact availability already synchronizes.** Each execution artifact lane contains content-addressed heads for JSONL, stderr, telemetry, and result.
4. **The repository already exposes `byTaskId(taskId)` and `bySessionId(sessionId)` indexes.**
5. **Session deletion already tombstones the session executions and publishes one session-deletion resource.**
6. **Live process paths remain node-local in the runtime process registry.**

---

## D. Missing Projection

1. **The backend lacks one task-scoped execution-state summary DTO.**
2. **The frontend reconstructs session history from card fields instead of consuming `executions.byTaskId(taskId)`.**
3. **Execution-change invalidation does not provide the task identity required to refresh the selected task summary.**
4. **Detailed log reads remain session-scoped instead of exact-execution-scoped.**

---

## E. Integration Path

1. **Define `TaskExecutionStateSummaryDto` in the shared frontend-backend schema.**
2. **Project it directly from `executions.byTaskId(taskId)`.**
3. **Group the ordered execution records by `metadata.sessionId`.**
4. **Order sessions by their first execution request timestamp.**
5. **Order executions by `requestedAt` and `executionId`.**
6. **Select the active execution from phases `preparing`, `queued`, `starting`, `running`, and `cancelling` only when exactly one active execution exists.**
7. **Surface an execution conflict and leave active selection unset when several active executions exist.**
8. **When no execution is active, select the latest execution as the default history entry.**
9. **Return `taskId`, state root, active session identity, active execution identity, sessions, execution summaries, artifact availability, and execution conflicts.**
10. **Do not return stdout paths, stderr paths, JSONL positions, process handles, and raw artifact bytes.**
11. **Expose the projection at `GET /api/tasks/:taskId/execution-state`.**
12. **Serve this endpoint from the local replicated Epoch 4 state on every converged node.**
13. **Enrich the existing execution-change event with `taskId`, `executionId`, lifecycle revision, and project state root.**
14. **Refetch the task summary when that event matches the open task.**
15. **Use `GET /api/task-executions/:executionId/log` only after an execution is selected.**
16. **For a live local execution, parse the runtime-owned artifact and return a structured packet.**
17. **For a live remote execution, proxy the exact execution request to its assigned executor.**
18. **For a terminal execution, resolve the replicated JSONL artifact head through the content-addressed object store and build the same packet locally.**
19. **Keep the log cursor opaque and keep physical artifact positions inside the backend packet builder.**

---

## F. State Boundaries

1. **Replicated:** task identity, session identity through execution metadata, execution identity, lifecycle, executor assignment, result, error, artifact hashes, revisions, and deletion tombstones.
2. **Derived:** task summary, session grouping, active selection, chronological ordering, available actions, aggregate counts, and artifact availability.
3. **Executor-local:** child process handle, PID verification runtime, mutable live JSONL bytes, stderr bytes, telemetry bytes, and incremental parser cursor.
4. **Content-addressed:** finalized JSONL, stderr, telemetry, and result objects referenced by replicated artifact heads.

---

## G. Verification

1. **Two nodes with the same Epoch 4 root return byte-equivalent task execution summaries.**
2. **One task with two sessions and two executions per session returns the exact hierarchy and ordering.**
3. **A continuation remains in its existing session.**
4. **A fresh run creates a new session under the same task.**
5. **An active execution becomes the default selection on every node.**
6. **A terminal task defaults to its latest execution.**
7. **Selecting one execution fetches only that execution log packet.**
8. **A live remote log request reaches the exact executor.**
9. **A terminal remote log loads from the replicated artifact head after the executor is offline.**
10. **No frontend response exposes artifact paths and physical line boundaries.**

---

## H. Operator Decision Summary

1. **Integrate the hierarchy as a read projection over existing Epoch 4 execution entities.**
2. **Do not add a replicated session entity.**
3. **Do not put live log events into the Epoch 4 CRDT.**
4. **Synchronize artifact hashes at settlement and load structured logs only for the selected execution.**
