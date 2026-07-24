## A. Repository Intent

1. **Epoch 4 makes execution entities the only durable execution authority.**
2. Task cards retain task lifecycle and assignment state. They do not retain `executionIntent`, run ownership, process identity, queue state, or execution phase.
3. Offline migration must retire every active epoch-3 execution authority before the epoch-4 server is admitted.

---

## B. Current Iteration Intent

1. Commit `d144d1442c2e0702b6adba6c99dff17029e89d7d` installs the epoch-4 implementation and recoverable node migrator on Workstation `main`.
2. The Workstation server process started at `2026-07-24T08:43:10+07:00`.
3. The merge completed at `2026-07-24T08:48:35+07:00`.
4. The loaded backend is therefore the pre-merge epoch-3 runtime while the checkout now contains the epoch-4 frontend and backend files.
5. All seven registered project format markers remain `decision-os-task-state/3`.

---

## C. Findings

1. **The screenshot is an epoch-3 ownership conflict.**
   1. Task `card-bd584783-c1ae-4e9d-87c6-0fb45daec114` retains legacy `executionIntent.executionId = codex-execution-1784791404631-c98a5a47`.
   2. Execution `codex-execution-1784791404631-c98a5a47` has remained nonterminal at phase `queued`, revision `2`, since `2026-07-23T07:23:24.677Z`.
   3. The new request durably created `codex-execution-1784858311933-3bfdb13a` at phase `preparing`, revision `1`, on `2026-07-24T01:58:31.942Z`.
   4. The epoch-3 coordinator then attempted to project the new execution into the card.
   5. `projectExecutionIntent()` rejected the different execution ID because the old card intent remained active, producing `task_execution_intent_conflict:card-bd584783-c1ae-4e9d-87c6-0fb45daec114:codex-execution-1784791404631-c98a5a47`.
   6. The coordinator returned the durable-but-pending diagnostic before queueing or spawning the new execution.
   7. `Retry refresh` reloads server-confirmed state. It does not retry admission and cannot reconcile the epoch-3 dual write.
2. **The first incorrect transition predates the screenshot.**
   1. The original execution reached durable `queued` state but its separately written card intent remained `preparing`.
   2. It never reached an executor-owned `starting`, `running`, or terminal state.
   3. Its active card intent was never settled.
   4. For the new click, epoch 3 committed the new execution before checking and projecting card ownership.
   5. Every later epoch-3 execution for the task is therefore blocked after durable creation.
3. **The code correction is installed but not active.**
   1. Epoch 4 removes `executionIntent` from migrated cards.
   2. Epoch 4 converts every nonterminal legacy execution, including both IDs above, to terminal `interrupted` history.
   3. Epoch 4 admits new work through the replicated execution repository, which detects active execution state before accepting a competing request.
4. **The current state passes epoch-4 semantic preparation.**
   1. The read-only planner completed for all seven registered projects after the failed launch.
   2. Exact archive size is `11,577,183` bytes.
   3. Referenced workspace content is `993,873,984` bytes and remains in place.
   4. No migration, backup, shadow root, format marker, server stop, or server restart occurred during the planner run.

---

## D. Remediation Paths

1. **Rejected: clear this card’s `executionIntent` manually.**
   1. It edits causal state outside the command and migration contracts.
   2. It leaves both canonical epoch-3 execution records active.
   3. It repairs one symptom while every other stale epoch-3 execution remains exposed.
2. **Rejected: retry the launch on the currently loaded server.**
   1. The same active card intent deterministically rejects each new execution.
   2. Every retry adds another durable `preparing` execution record.
3. **Selected: perform the node-wide offline epoch-4 migration.**
   1. Quiesce the registered Workstation server through MultiTerm.
   2. Run the reviewed node migration with the explicit external backup root.
   3. Independently verify the transaction and all seven project format markers.
   4. Start the registered server from merged commit `d144d1442c2e0702b6adba6c99dff17029e89d7d`.
   5. Submit one fresh execution request for the task.

---

## E. Operator Decision Summary

1. **Yes, Workstation requires the manual offline node migration before epoch 4 can execute this task.**
2. This is one catalog migration, not a per-task repair.
3. Migration preserves the two failed attempts as terminal `interrupted` history. It does not automatically start the latest attempt.
4. After the verified epoch-4 restart, the operator must submit one fresh Run request.
5. The operator authorized the Workstation migration and registered-server restart on `2026-07-24`.

---

## F. Verified Workstation Cutover

1. **The successful node transaction is `ab0ab732-64d8-464b-b0e7-d2f1266681c4`.**
   1. Rollback root: `/media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7/decision-os-epoch4-rollbacks/workstation-20260724T035010Z`.
   2. The migration command and independent verifier both returned phase `verified`.
   3. All seven registered projects now expose `stateProtocol: decision-os-task-state/4`, `stateSchema: 4`, and `baselineEpoch: 4`.
   4. Every migration report has `missingObjects: 0` and `journalCount: 0`.
2. **The registered Workstation server restarted through MultiTerm.**
   1. Registered process: `decision-os-workstation`.
   2. Port: `50150`.
   3. Root route returned HTTP `200`.
   4. `/api/health` returned `ready` with zero active incidents and no paused scopes.
3. **The contradicted task state is repaired.**
   1. Card `card-bd584783-c1ae-4e9d-87c6-0fb45daec114` has no `executionIntent`.
   2. It is assigned to `workstation` and remains lifecycle `todo`.
   3. Executions `codex-execution-1784791404631-c98a5a47` and `codex-execution-1784858311933-3bfdb13a` are terminal `interrupted`.
   4. The epoch-4 execution repository reports no diagnostic for the task.
   5. A fresh operator Run request is required; migration does not replay a stale request.

---

## G. Binary-Content Audit

1. **Workstation-owned workspace content remains referenced in place.**
   1. The catalog referenced `993,873,984` workspace bytes.
   2. Those local audio and image files were not copied into rollback archives or epoch-4 object storage.
2. **Remote cached content is still duplicated by the successful migrator.**
   1. The Decision OS project installed `199` phone-owned managed assets totaling `389,746,672` bytes.
   2. The same immutable hashes already exist in `/home/jbb/.decision-os/cache/federation-content-current/objects`.
   3. This duplication is not required for task execution or causal state.
   4. The server is operational, but the remote-content materialization path remains technical debt.
