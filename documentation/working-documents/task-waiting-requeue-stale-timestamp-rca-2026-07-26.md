## A. Repository Intent

1. **Decision OS separates task lifecycle from execution lifecycle.** A master card owns durable `lifecycle`, while each Codex attempt owns a replicated execution entity with independent `metadata`, `lifecycle`, and `artifacts`.
2. **Execution phase is authoritative while work is active.** `TaskExecutionRouter` resolves every admitted execution to its master `taskId`, and the Control Room derives `task-execution` only from active replicated phases.
3. **Queue age is a task-lifecycle value.** After no active execution remains, the Control Room derives `task-waiting` and copies the master card's `lifecycle.waitingAt` into `waitingSince`.

---

## B. Current Iteration Intent

1. **Operator symptom:** `Task dates, daily reset, and Bunny indisposed mode` returned from `Exec` to `Queue` immediately after a Codex skill completed, but its row still displayed approximately `2h waiting`.
2. **Required proof:** identify the first incorrect transition, reproduce it with an automated test in an isolated worktree, and leave `main` unchanged.
3. **Evidence boundary:** this document diagnoses and reproduces the defect. It does not implement the correction.

---

## C. Verified Incident Chain

1. **The visible timestamp is stale durable state, not a formatter error.** The affected Lys master retained `lifecycle.waitingAt` at `2026-07-25T17:59:10.163Z`. Its latest temporary skill execution reached canonical `succeeded` with `finishedAt` at `2026-07-25T20:13:23.224Z`.
2. **The latest run used the card-skill route.** Its immutable manifest is `temporary: true` with `pipelineId: null`; its replicated execution is `kind: pipeline-skill`, its canonical `taskId` is the master, and its `ownerCardId` is the generated result card.
3. **Terminal projection removes the execution row first.** `selectedExecutionCandidate()` admits only active execution phases. When the run becomes `succeeded`, the Control Room stops selecting it and derives the master as `task-waiting`.
4. **Queue age then reads the unchanged card lifecycle.** `taskFrom()` copies only the master card's `lifecycle.waitingAt` into `waitingSince`; it does not derive Queue entry time from the terminal execution.
5. **The screenshot is the exact causal result.** The execution completed near `20:13`, disappeared from active selection, and exposed the still-persisted `17:59` task timestamp near `20:14`, which correctly rendered as approximately `2h waiting`.

---

## D. Root Cause

1. **A direct card skill is implemented as a temporary pipeline.** `startCardSkillProcessController()` always delegates `/api/codex/skills/process` to `startTemporaryPipelineRun()`, which constructs `temporary: true` pipeline topology.
2. **The pipeline runner discards the data needed for reconciliation.** At settlement, `codex-pipeline-runner.ts` has exact `settlement.finishedAt`, but its `onCodexRunSettled` event omits `finishedAt`, supplies the generated step output card as `cardId`, and includes `pipelineRunId`.
3. **The server excludes that event from its lifecycle mutation.** `onCodexRunSettled` calls `transitionCardLifecycle(cardId, 'todo', finishedAt)` only when `!event.pipelineRunId`, `ledgerId === 'tasks'`, and `status === 'complete'`.
4. **The pipeline branch only publishes presentation invalidation.** Even when `pipelineTerminal === true`, it publishes `pipeline-completed`, `pipeline-failed`, or `pipeline-cancelled` without mutating the master lifecycle.
5. **The previous correction covered a different execution path.** Commit `d7861de5` added the non-pipeline successful-settlement refresh and a continuation regression. It did not cover `/api/codex/skills/process`, whose compatibility surface is backed by a temporary pipeline.

---

## E. Adjacent Omissions

1. **Saved pipelines share the same missing terminal reconciliation.** Their terminal callbacks also carry `pipelineRunId` and bypass the only refresh branch.
2. **Failed and cancelled non-pipeline runs also return an open task to Queue with stale age.** The refresh predicate accepts only `complete`, while `failed` and `cancelled` terminal phases are no longer active.
3. **Early start and continuation failures omit `finishedAt`.** Their settlement notifications therefore cannot drive the existing timestamp mutation even after the status predicate is corrected.
4. **Scheduler dispatch failure omits terminal time.** It records a durable failed execution, then sends a settlement callback without the execution's canonical terminal timestamp.
5. **The pipeline callback is not awaited.** `notifyCodexLifecycle()` invokes the callback synchronously and ignores a returned promise. Adding an asynchronous lifecycle write behind that helper would violate the repository rule that every asynchronous operation ends at an explicit success-and-failure boundary.

---

## F. Reproduction

1. **The regression exercises the exact operator route.** The isolated test creates an open Tasks master with stale `waitingAt`, launches `/api/codex/skills/process`, waits for the temporary pipeline execution to become `succeeded`, and compares the master lifecycle with the execution's canonical `finishedAt`.
2. **The execution succeeds before the assertion.** The reproduced run reaches terminal `succeeded`; the failure is not caused by admission, scheduling, process launch, artifact publication, or projection lag.
3. **The assertion fails on the causal field.** Expected master `waitingAt` equals the new terminal `finishedAt`; actual master `waitingAt` remains `2026-07-25T17:59:10.163Z`.
4. **The test is intentionally red.** It is preserved on the analysis branch as executable proof and must turn green only with the lifecycle correction.

---

## G. Remediation Path

1. **Reconcile Queue entry from the canonical execution entity.** At terminal settlement, resolve the execution by `executionId`, read authoritative `metadata.taskId` and `lifecycle.finishedAt`, then await `transitionCardLifecycle(taskId, 'todo', finishedAt)` before publishing the terminal refresh.
2. **Use one terminal rule.** Reconcile every non-pipeline terminal execution that returns an open Tasks master to Queue. Reconcile a pipeline only when `pipelineTerminal === true`, preventing intermediate skills from resetting Queue age.
3. **Keep one write boundary.** Retain `ProjectTaskState.transitionCardLifecycle()` as the only task-lifecycle mutation. Its existing current-status guard prevents a late execution settlement from reopening a master already changed to `done`.
4. **Await and contain the mutation.** Replace fire-and-forget terminal notification with an awaited callback boundary whose failure is recorded against the owning project runtime.
5. **Add the complete regression set.** Cover temporary skill success, saved multi-step terminal success, subtask-origin master resolution, failed settlement, cancelled settlement, dispatch failure, Control Room `waitingSince`, and closed-master preservation.

---

## H. Operator Decision Summary

1. **The defect is a missing settlement-to-task reconciliation, not a UI age calculation bug.**
2. **The highest-yield correction is one canonical terminal reconciliation keyed by execution `taskId`.** This fixes the affected temporary skill path and removes the same stale-return behavior from saved pipelines and exceptional terminal paths.
3. **Implementation should begin only after accepting this boundary.** The red reproduction already fixes the acceptance point: a task that returns to Queue must use the terminal execution's canonical `finishedAt` as its new `waitingAt`.
