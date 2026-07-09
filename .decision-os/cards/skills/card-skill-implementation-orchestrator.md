---
name: implementation-orchestrator
description: Orchestrate parallel implementation workers from complete independent task groups, collect their results, then coordinate test attribution, RCA, and repair loops. Use after task groups pass task-group-completeness and before any global test run.
---

# Implementation Orchestrator

## A. Scope

1. Launch implementation workers from **approved independent task groups** and coordinate the batch until every group has returned a result.
2. Own `dispatch`, `worker result collection`, `test attribution handoff`, `root-cause routing`, and `repair-loop coordination`.
3. Do not implement code directly unless the orchestrator is explicitly assigned an `implementation-worker` role for one group.

---

## B. Required Inputs

1. Read approved independent groups from `task-group-completeness`.
2. Read group ordering and blocking edges from `task-dependency`.
3. Read source `taskIds`, `targetPaths`, `acceptanceChecks`, and evidence links from `task-list`.
4. Identify the implementation worker skill used for each `dispatch`.
5. Identify the `test-failure-attribution` input format that receives the completed batch.

---

## C. Dispatch Workflow

1. Create one `dispatch package` per ready group with `groupId`, `taskIds`, `targetPaths`, `acceptanceChecks`, `sourceReferences`, and `forbiddenScopes`.
2. Start **one implementation worker per independent group** using available agent tooling.
3. Do not run `global tests` while implementation workers are active.
4. Track `worker status` with `pending`, `running`, `returned`, `blocked`, and `needs-repair`.
5. After every worker returns, collect `changedFiles`, `completedTaskIds`, `blockers`, and `assumptions`.
6. Send the completed batch to `test-failure-attribution` with `testCommands`, `changedFiles`, `completedTaskIds`, and worker notes.
7. For **clear group-owned failures**, create fix-worker `dispatch` entries and send ambiguous failures to `root-cause-analysis`.
8. Continue `repair dispatch` and `failure attribution` until all known failures are resolved. Stop when a blocker requires operator input.

---

## D. Output Contract

1. Produce `Dispatch Plan` with `groupIds`, `workerAssignments`, `taskIds`, and `targetPaths`.
2. Produce `Worker Results` with `returned` status, `changedFiles`, `completedTasks`, `blockers`, and `assumptions`.
3. Produce `Post-Batch Handoff` with `test-failure-attribution` input and `testCommands`.
4. Produce `Repair Loop` with `failureId`, `ownerGroup`, `actionTaken`, and `currentStatus`.
5. Produce `Operator Blockers` with only blockers that require **operator input** after `worker repair` and `root-cause-analysis` triage.

---

## E. Hard Rules

1. Do not run `global tests` while parallel workers are active.
2. Do not create `commits` while workers are active.
3. Keep each `dispatch` limited to one independent group; do not mix unrelated scopes.
4. Do not ask a worker to infer missing requirements that should have been handled by `task-group-completeness`.
