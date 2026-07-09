---
name: implementation-orchestrator
description: Orchestrate parallel implementation workers from complete independent task groups, collect their results, then coordinate test attribution, RCA, and repair loops. Use after task groups pass task-group-completeness and before any global test run.
---

# Implementation Orchestrator

## A. Scope

1. **Purpose:** Launch implementation workers from approved independent task groups and coordinate the batch until every group has returned a result.
2. **Ownership:** Own dispatch, worker result collection, test attribution handoff, root-cause routing, and repair-loop coordination.
3. **Boundary:** Do not implement code directly unless the orchestrator is explicitly assigned an `implementation-worker` role for one group.

---

## B. Required Inputs

1. **Task groups:** Read the approved independent groups from `task-group-completeness`.
2. **Dependency graph:** Read group ordering and blocking edges from `task-dependency`.
3. **Task inventory:** Read source task ids, target paths, acceptance checks, and evidence links from `task-list`.
4. **Worker contract:** Identify the implementation worker skill used for each dispatch.
5. **Test contract:** Identify the `test-failure-attribution` input format that receives the completed batch.

---

## C. Dispatch Workflow

1. **Build packages:** Create one dispatch package per ready group with `groupId`, `taskIds`, target paths, acceptance checks, source references, and forbidden out-of-scope areas.
2. **Launch workers:** Start one implementation worker for each independent group using available agent tooling.
3. **Protect global tests:** Do not run global tests while implementation workers are active.
4. **Track status:** Use the exact worker statuses `pending`, `running`, `returned`, `blocked`, and `needs-repair`.
5. **Collect returns:** When every worker has returned, collect changed files, completed task ids, blockers, and assumptions.
6. **Handoff tests:** Send the completed batch to `test-failure-attribution` with the test commands, changed files, completed task ids, and worker notes.
7. **Route failures:** Dispatch fix workers for clear group-owned failures and dispatch `root-cause-analysis` for ambiguous failures.
8. **Close loop:** Continue repair dispatch and attribution until all known failures are resolved. Stop when a blocker requires operator input.

---

## D. Output Contract

1. **`Dispatch Plan`:** List group ids, worker assignments, task ids, and target paths.
2. **`Worker Results`:** List returned status, changed files, completed tasks, blockers, and assumptions.
3. **`Post-Batch Handoff`:** Provide `test-failure-attribution` input with test commands and changed-file scope.
4. **`Repair Loop`:** List failure id, owner group, action taken, and current status.
5. **`Operator Blockers`:** List only blockers that cannot be resolved through worker repair and `root-cause-analysis` triage.

---

## E. Hard Rules

1. **No global tests during workers:** Do not run global tests while parallel workers are active.
2. **No commits during workers:** Do not create commits while workers are active.
3. **No scope mixing:** Do not merge unrelated scopes into one worker dispatch.
4. **No requirement inference:** Do not ask a worker to infer missing requirements that should have been handled by `task-group-completeness`.
