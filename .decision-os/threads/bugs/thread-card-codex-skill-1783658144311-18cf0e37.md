# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-1","timestamp":"2026-07-10T04:35:47.731Z","status":"running","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"1","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-2","timestamp":"2026-07-10T04:35:47.731Z","status":"running","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"2","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-3","timestamp":"2026-07-10T04:35:56.068Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"3","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’m using the named `code-quality-improver` skill to inspect the implementation’s modified files, make only evidence-backed structural or clarity fixes, rerun the focused verification, commit the completed iteration, and write the operator result card without touching the source card or ledger JSON.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-4","timestamp":"2026-07-10T04:35:57.502Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"4","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,240p' /home/jbb/.codex/skills/code-quality-improver/SKILL.md && git status --short && git diff --stat && git log -5 --oneline\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,240p' /home/jbb/.codex/skills/code-quality-improver/SKILL.md && git status --short && git diff --stat && git log -5 --oneline"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-5","timestamp":"2026-07-10T04:35:57.502Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"5","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,240p' /home/jbb/.codex/skills/code-quality-improver/SKILL.md && git status --short && git diff --stat && git log -5 --oneline\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,240p' /home/jbb/.codex/skills/code-quality-improver/SKILL.md && git status --short && git diff --stat && git log -5 --oneline"`
Status: completed
Exit code: 0

````text
---
name: code-quality-improver
description: Analyze and directly correct code quality issues in files modified during an implementation. Use when Codex must improve clean architecture, clean code, file separation, comments, and factorization while preserving intended behavior.
---

# Code Quality Improver

## A. Analyze And Fix

1. **Modified-file correction** means analyze and correct the files modified during this implementation, then ensure the whole iteration follows the rules below.

---

## B. What Is Clean Architecture?

1. **File separation** means each file type has a role when that role belongs in the architecture. A `controller` owns behavior and branching, a `helper` is a small `sync` or `async` function that returns implementation work results such as parsing, validation, data loading, `IO`, formatting, normalization, calculation, and derivation, an `effect` is a final output call, a `component` renders UI, a `test` proves behavior, a `fixture` provides test setup/data, and `state` holds runtime values. Do not retrofit every codebase into all these file types; for example, `component` has no place in a backend.
2. **Directory separation** means files are correctly placed in subdirectories that group common functionality together. As the codebase and features expand, it is natural to create more subdirectories and more levels of subdirectories so ownership stays readable.
3. **Goal-oriented controllers** own one operation lifecycle. A `controller` keeps the behavior decisions and branching, calls `helper` functions for implementation work, and calls `effect` functions for final output.
4. **Behavior preservation** keeps working code working while improving ownership. A quality refactor changes structure, names, imports, comments, and tests only where there is evidence that the current shape hurts clarity, safety, speed, or maintenance.

---

## C. What Is Clean Code?

1. **One function per file** is the default.
2. **Small readable units** keep a `controller` at a maximum of approximately `300` LOC and keep each `helper` focused on one derivation, validation, parser, loader, formatter, or calculation. Split when a file starts owning several jobs.
3. **Mandatory comments** means every file needs a `WHAT`/`WHY` header and every branch needs a `WHAT`/`WHY` comment.

---

## D. Factorization

1. **Smallest useful correction** fixes the nearest real ownership problem. Prefer a targeted `controller` split, `helper` extraction, comment repair, import correction, and focused test update over broad rewrites, unrelated renames, new frameworks, and speculative cleanup.
2. **Clean ownership** means each file has one clear responsibility, visible from its `path`, `name`, imports, and tests. Use the repo's own vocabulary first; do not force external architecture terms into a codebase that already has coherent names. The ownership of `data` and modifications must not be split across parallel sibling `controllers`.
3. **Controller nesting** should be avoided; ideally, `controllers` stay parallel. When parallel `controllers` make ownership unclear for `state`, `data`, and modifications, use a `waterfall` `caller` to `callee` structure so ownership is readable from the `stack trace`.
 M .decision-os/cards/skills/card-skill-executor-implement.md
 M .decision-os/cards/skills/card-skill-executor-spec.md
 M .decision-os/cards/skills/card-skill-feature-analyzer.md
 M .decision-os/ledgers-canvas.json
 M .decision-os/runs/codex-skills/skills/codex-skill-1783500587763-e734fec7.jsonl
 M .decision-os/runs/codex-skills/skills/codex-skill-1783500587763-e734fec7.log
 M .decision-os/runs/codex-skills/skills/codex-skill-1783500587763-e734fec7.md
 M .decision-os/runs/codex-skills/skills/codex-skill-1783503301885-0800fad0.jsonl
 M .decision-os/runs/codex-skills/skills/codex-skill-1783503301885-0800fad0.md
 M .decision-os/runs/codex-skills/skills/codex-skill-1783596089570-85eceea5.md
 M .decision-os/skills.json
 M .decision-os/state.json
 M .decision-os/tasks-system.json
 M .decision-os/threads/skills/thread-card-c48369dc-1d97-4c6c-ab36-fd01d819d03a.md
 M .decision-os/threads/skills/thread-card-skill-executor-implement.md
 M .decision-os/threads/skills/thread-card-skill-executor-spec.md
 M .decision-os/threads/skills/thread-card-skill-feature-analyzer.md
 M .decision-os/threads/skills/thread-card-skill-feature-planner.md
 M .decision-os/threads/skills/thread-card-skill-implementation-orchestrator.md
 M .decision-os/threads/skills/thread-card-skill-ticket-solver.md
 M .decision-os/threads/tasks-system/thread-card-codex-skill-1783429520950-bad8c87c.md
 M frontend/src/runtime/card/effect/resize-selected-card.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-down.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-move.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-up.ts
 M frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
 M frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
 M frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
 M frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
 M frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
 M frontend/src/runtime/selection/effect/move-selected.ts
 M frontend/src/runtime/state.ts
 M frontend/src/runtime/zone/effect/resize-selected-zone.ts
 M frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
 M frontend/test/runtime/canvas-pan-performance.integration.test.ts
 M frontend/test/runtime/drag-release-freeze.integration.test.ts
 M frontend/test/runtime/ledger-content-refresh.integration.test.ts
 M package.json
 M tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
?? .decision-os/bugs.json
?? .decision-os/cards/bugs/
?? .decision-os/cards/skills/card-5f44b483-86f4-4144-a497-b5e88bea52b8.md
?? .decision-os/cards/skills/card-98070d2c-e147-47b4-b2dd-616a38aaa28d.md
?? .decision-os/cards/skills/card-b1ccfc6f-dbda-409c-949d-b6f5a1caf4c9.md
?? .decision-os/cards/skills/card-bc15e93f-febb-4ca2-be92-9927f628c5ed.md
?? .decision-os/cards/skills/card-skill-code-quality-report.md
?? .decision-os/cards/skills/card-skill-implementation-worker.md
?? .decision-os/cards/skills/card-skill-quality-improvement-orchestrator.md
?? .decision-os/cards/skills/card-skill-quality-improvement-worker.md
?? .decision-os/cards/skills/card-skill-root-cause-analysis.md
?? .decision-os/cards/skills/card-skill-task-dependency.md
?? .decision-os/cards/skills/card-skill-task-group-completeness.md
?? .decision-os/cards/skills/card-skill-task-list.md
?? .decision-os/cards/skills/card-skill-test-failure-attribution.md
?? .decision-os/cards/tasks-system/card-5483453a-172e-44cb-9f25-3d9ad69c36cf.md
?? .decision-os/cards/tasks-system/card-83a2bf48-f8b7-4d7a-b566-b6133b1520c8.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443352880-df6faf0b.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443977270-47f9133f.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783496502245-a5e66232.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783502837104-b19e9e59.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783530524112-61491e77.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783577864069-8ee729ab.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783577881108-c8db844f.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783588674300-560cc5db.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783590897494-9dd2d021.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783591708289-5fd90c7c.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783595913386-e48acfb6.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783611545211-2a80d2ff.md
?? .decision-os/cards/tasks-system/card-e2cfbc8b-5c26-4fd1-a68d-0f2bd10cb885.md
?? .decision-os/cards/ux/
?? .decision-os/runs/codex-skills/bugs/
?? .decision-os/runs/codex-skills/skills/codex-skill-1783502442976-6a35722a.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783502442976-6a35722a.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783502442976-6a35722a.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503287807-7f582d60.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503287807-7f582d60.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503287807-7f582d60.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503513198-b5b9a85e.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503513198-b5b9a85e.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503513198-b5b9a85e.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504256943-c9bea42a.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504256943-c9bea42a.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504256943-c9bea42a.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504259043-dfa18c30.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504259043-dfa18c30.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504259043-dfa18c30.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783518893695-4bd58a9d.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783518893695-4bd58a9d.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783518893695-4bd58a9d.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783575881639-ff6eb75e.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783575881639-ff6eb75e.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783575881639-ff6eb75e.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783583923095-6b27daee.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783583923095-6b27daee.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783583923095-6b27daee.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783589922957-864e7bb8.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783589922957-864e7bb8.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783589922957-864e7bb8.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783591962144-75235572.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783591962144-75235572.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783591962144-75235572.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783595986671-340f42bc.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783595986671-340f42bc.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783595986671-340f42bc.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596089570-85eceea5.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596089570-85eceea5.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596093573-a037eeea.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596093573-a037eeea.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596093573-a037eeea.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596100402-f1141ac6.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596100402-f1141ac6.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596100402-f1141ac6.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596105902-590900c8.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596105902-590900c8.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596105902-590900c8.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596108971-d6eefe24.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596108971-d6eefe24.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596108971-d6eefe24.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783616081067-24f9c553.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783616081067-24f9c553.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783616081067-24f9c553.md
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783443352880-df6faf0b.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783443352880-df6faf0b.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783443647691-91eae060.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783443647691-91eae060.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783443977270-47f9133f.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783443977270-47f9133f.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783495869207-759e2295.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783495869207-759e2295.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783496502245-a5e66232.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783496502245-a5e66232.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783502837104-b19e9e59.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783502837104-b19e9e59.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783530524112-61491e77.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783530524112-61491e77.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783577864069-8ee729ab.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783577864069-8ee729ab.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783577881108-c8db844f.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783577881108-c8db844f.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783588674300-560cc5db.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783588674300-560cc5db.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783590897494-9dd2d021.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783590897494-9dd2d021.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783591708289-5fd90c7c.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783591708289-5fd90c7c.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783595913386-e48acfb6.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783595913386-e48acfb6.log
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783611545211-2a80d2ff.jsonl
?? .decision-os/runs/codex-skills/tasks-system/codex-skill-1783611545211-2a80d2ff.log
?? .decision-os/runs/codex-skills/ux/
?? .decision-os/thread-images/thread-card-skill-task-group-completeness/
?? .decision-os/threads/bugs/
?? .decision-os/threads/skills/thread-card-5f44b483-86f4-4144-a497-b5e88bea52b8.md
?? .decision-os/threads/skills/thread-card-98070d2c-e147-47b4-b2dd-616a38aaa28d.md
?? .decision-os/threads/skills/thread-card-b1ccfc6f-dbda-409c-949d-b6f5a1caf4c9.md
?? .decision-os/threads/skills/thread-card-bc15e93f-febb-4ca2-be92-9927f628c5ed.md
?? .decision-os/threads/skills/thread-card-skill-code-quality-report.md
?? .decision-os/threads/skills/thread-card-skill-implementation-worker.md
?? .decision-os/threads/skills/thread-card-skill-quality-improvement-orchestrator.md
?? .decision-os/threads/skills/thread-card-skill-quality-improvement-worker.md
?? .decision-os/threads/skills/thread-card-skill-root-cause-analysis.md
?? .decision-os/threads/skills/thread-card-skill-task-dependency.md
?? .decision-os/threads/skills/thread-card-skill-task-group-completeness.md
?? .decision-os/threads/skills/thread-card-skill-task-list.md
?? .decision-os/threads/skills/thread-card-skill-test-failure-attribution.md
?? .decision-os/threads/tasks-system/thread-card-5483453a-172e-44cb-9f25-3d9ad69c36cf.md
?? .decision-os/threads/tasks-system/thread-card-83a2bf48-f8b7-4d7a-b566-b6133b1520c8.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783443352880-df6faf0b.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783443647691-91eae060.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783443977270-47f9133f.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783495869207-759e2295.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783496502245-a5e66232.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783502837104-b19e9e59.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783530524112-61491e77.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783577864069-8ee729ab.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783577881108-c8db844f.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783588674300-560cc5db.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783590897494-9dd2d021.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783591708289-5fd90c7c.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783595913386-e48acfb6.md
?? .decision-os/threads/tasks-system/thread-card-codex-skill-1783611545211-2a80d2ff.md
?? .decision-os/threads/tasks-system/thread-card-e2cfbc8b-5c26-4fd1-a68d-0f2bd10cb885.md
?? .decision-os/threads/ux/
?? .decision-os/ui-mockups/reusable-step-pipelines/
?? .decision-os/ux.json
?? node_modules/
?? package-lock.json
 .../cards/skills/card-skill-executor-implement.md  |  298 +++
 .../cards/skills/card-skill-executor-spec.md       |  523 +++++
 .../cards/skills/card-skill-feature-analyzer.md    |  118 +
 .decision-os/ledgers-canvas.json                   |   54 +-
 .../codex-skill-1783500587763-e734fec7.jsonl       |   48 +
 .../skills/codex-skill-1783500587763-e734fec7.log  |    1 +
 .../skills/codex-skill-1783500587763-e734fec7.md   |    3 +
 .../codex-skill-1783503301885-0800fad0.jsonl       |    4 +
 .../skills/codex-skill-1783503301885-0800fad0.md   |    3 +
 .../skills/codex-skill-1783596089570-85eceea5.md   |    3 +
 .decision-os/skills.json                           |  290 ++-
 .decision-os/state.json                            |   18 +
 .decision-os/tasks-system.json                     |  245 +-
 ...ad-card-c48369dc-1d97-4c6c-ab36-fd01d819d03a.md |   42 +
 .../skills/thread-card-skill-executor-implement.md | 1502 ++++++++++++
 .../skills/thread-card-skill-executor-spec.md      | 1389 +++++++++++
 .../skills/thread-card-skill-feature-analyzer.md   | 2477 ++++++++++++++++++++
 .../skills/thread-card-skill-feature-planner.md    |  306 +++
 ...hread-card-skill-implementation-orchestrator.md |  121 +
 .../skills/thread-card-skill-ticket-solver.md      | 1537 ++++++++++++
 ...read-card-codex-skill-1783429520950-bad8c87c.md |   22 +-
 .../runtime/card/effect/resize-selected-card.ts    |   35 +-
 .../gesture/controller/handle-pointer-down.ts      |   14 +-
 .../gesture/controller/handle-pointer-move.ts      |    2 +-
 .../gesture/controller/handle-pointer-up.ts        |    5 +-
 .../effect/commit-selected-ledger-geometry.ts      |    6 +-
 .../ledger/effect/load-active-ledger-state.ts      |   13 +-
 .../ledger/helper/active-ledger-geometry.ts        |   28 +-
 .../refresh/controller/refresh-runtime-state.ts    |    1 -
 .../effect/subscribe-ledger-content-events.ts      |    6 +-
 .../src/runtime/selection/effect/move-selected.ts  |   47 +-
 frontend/src/runtime/state.ts                      |   58 +-
 .../runtime/zone/effect/resize-selected-zone.ts    |   34 +-
 ...ctive-ledger-zone-lifecycle.integration.test.ts |   65 +
 .../canvas-pan-performance.integration.test.ts     |  613 ++++-
 .../drag-release-freeze.integration.test.ts        |  726 +++++-
 .../ledger-content-refresh.integration.test.ts     |  220 +-
 package.json                                       |    4 +-
 ...-canvas-continuity-during-operator-work.spec.ts |  230 +-
 39 files changed, 10941 insertions(+), 170 deletions(-)
03af919 Add thread Codex controls and reset run state
e195f16 Add fresh Codex session action
91d9186 Add Codex model controls to run widget
0611ad7 Append worker results as markdown sections
0d50677 Remove subagent prompts from orchestrator output
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-6","timestamp":"2026-07-10T04:36:03.513Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"6","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_2"} -->

The worktree contains substantial unrelated Decision OS state, so I will isolate this pass to the 19 implementation files, `package-lock.json`, and the requested result card. I will preserve every other modified and untracked path.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-7","timestamp":"2026-07-10T04:36:08.726Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"7","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc 'find .. -name AGENTS.md -print && git diff --numstat -- frontend/src/runtime frontend/test/runtime package.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts && wc -l frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'find .. -name AGENTS.md -print && git diff --numstat -- frontend/src/runtime frontend/test/runtime package.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts && wc -l frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-8","timestamp":"2026-07-10T04:36:09.771Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"8","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc 'find .. -name AGENTS.md -print && git diff --numstat -- frontend/src/runtime frontend/test/runtime package.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts && wc -l frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'find .. -name AGENTS.md -print && git diff --numstat -- frontend/src/runtime frontend/test/runtime package.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts && wc -l frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: completed
Exit code: 0

````text
../tmp/reference-architecture-analysis-2026-05-10-1/repos/turborepo/examples/with-nextjs-elysia/apps/web/AGENTS.md
../tmp/reference-architecture-analysis-2026-05-10-1/repos/turborepo/AGENTS.md
../tmp/reference-architecture-analysis-2026-05-10-1/repos/bulletproof-react/AGENTS.md
../EditoDoc/AGENTS.md
../uml-designer/AGENTS.md
../controlBP/uml/AGENTS.md
../controlBP/AGENTS.md
../decision-os/.worktrees/front-back-scaffold/generator-cli/AGENTS.md
../decision-os/generator-cli/AGENTS.md
../decision-os/AGENTS.md
23	12	frontend/src/runtime/card/effect/resize-selected-card.ts
13	1	frontend/src/runtime/gesture/controller/handle-pointer-down.ts
1	1	frontend/src/runtime/gesture/controller/handle-pointer-move.ts
3	2	frontend/src/runtime/gesture/controller/handle-pointer-up.ts
3	3	frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
11	2	frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
23	5	frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
0	1	frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
3	3	frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
29	18	frontend/src/runtime/selection/effect/move-selected.ts
57	1	frontend/src/runtime/state.ts
25	9	frontend/src/runtime/zone/effect/resize-selected-zone.ts
65	0	frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
612	1	frontend/test/runtime/canvas-pan-performance.integration.test.ts
668	58	frontend/test/runtime/drag-release-freeze.integration.test.ts
215	5	frontend/test/runtime/ledger-content-refresh.integration.test.ts
3	1	package.json
226	4	tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
    92 frontend/src/runtime/state.ts
    64 frontend/src/runtime/gesture/controller/handle-pointer-down.ts
    58 frontend/src/runtime/gesture/controller/handle-pointer-move.ts
    89 frontend/src/runtime/gesture/controller/handle-pointer-up.ts
    11 frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
    54 frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
   152 frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
    34 frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
   184 frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
    77 frontend/src/runtime/selection/effect/move-selected.ts
    70 frontend/src/runtime/card/effect/resize-selected-card.ts
    70 frontend/src/runtime/zone/effect/resize-selected-zone.ts
   602 frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
   877 frontend/test/runtime/canvas-pan-performance.integration.test.ts
   785 frontend/test/runtime/drag-release-freeze.integration.test.ts
   314 frontend/test/runtime/ledger-content-refresh.integration.test.ts
   233 tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
  3766 total
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-10","timestamp":"2026-07-10T04:36:16.060Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"10","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' AGENTS.md && git diff -- frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' AGENTS.md && git diff -- frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-11","timestamp":"2026-07-10T04:36:16.060Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"11","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' AGENTS.md && git diff -- frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' AGENTS.md && git diff -- frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts"`
Status: completed
Exit code: 0

````text
# decision-os Agent Instructions

## Language Policy

- All agent responses MUST be written in English only.
- The operator may speak or write in French; do not mirror the operator's language.
- decision-os `# AGENT` thread replies must be in English, even when the corresponding `# OPERATOR` note is French.
- Do not write French acknowledgements such as `Traité`; use English equivalents such as `Treated`.

## KNOWLEDGE

### Anti Specs

- **Rule.** Never write anti-specs: generic process claims that spend operator tokens and attention without adding a concrete requirement, constraint, decision, evidence, or action.
- **Don't.** `Good PRDs do not exist to create paperwork. They align teams around the customer problem, goals, requirements, risks, constraints, dependencies, and success measures before execution.`
- **Do.** `PRD purpose: capture the requested decision, user need, current technical context, current UX context, constraints, evidence, risks, options, recommendation, acceptance criteria, and next operator gate.`

### No Suppositions

- **Rule.** Never write suppositions when the answer can be verified from the repo, tools, CLI, docs, runtime state, or available evidence. Search, inspect, run the relevant command, and report the finding.
- **Don't.** `If ledger-cli does not expose that query, then the missing piece is a CLI contract.`
- **Do.** `Finding: ledger-cli exposes no zone-context query. Evidence: rg found no command handler or help entry for zone context under cli/. Required action: add the ledger-cli query contract.`
- **Blocker.** When evidence cannot be obtained, state the verified blocker and ask one concrete operator question. Do not replace missing evidence with conditional analysis.

### No Or In Plans

- **Rule.** Never leave unresolved alternatives with `or` in a final implementation plan, recommendation, acceptance criteria, or `# AGENT` answer. Pick the single best solution from the evidence. Options are valid only inside explicit questions to the operator.
- **Don't.** `Add headers or query params: x-ledger-id, x-thread-id, x-card-id, x-note-id, x-queue-codex.`
- **Do.** `Add required headers to /api/voice-upload: x-ledger-id, x-thread-id, x-card-id, x-note-id, x-queue-codex.`

### Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

## decision-os Server Procedure

decision-os serves the active `.decision-os` workspace by resolving the workspace root from the process
current working directory. Always start the server from the target project workspace, not from the
decision-os repo, unless the operator explicitly wants to inspect the repo's own ledgers.

For this decision-os repo workspace, use port `50150`. Port `4174` is registered to
`Ardaria_57` in multiterm state; do not start this repo on `4174`.

```bash
cd /home/jbb/dev/EditorBP/decision-os
setsid sh -c 'cd /home/jbb/dev/EditorBP/decision-os && exec env PORT=50150 /home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs >> /tmp/decision-os-50150.log 2>&1' </dev/null >/dev/null 2>&1 &
```

Then verify both the process and HTTP route:

```bash
ps -ef | rg 'decision-os-server|server.ts|50150' | rg -v rg
curl -sS -I http://127.0.0.1:50150/specs
```

Expected routes for decision-os:

```text
http://127.0.0.1:50150/specs
http://127.0.0.1:50150/data
http://127.0.0.1:50150/performances
http://127.0.0.1:50150/tasks-system
```

## Background Launch Rules

- Use the repo launcher: `/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs`.
- Run it from the target workspace cwd so `.decision-os/state.json` resolves correctly.
- Use `setsid sh -c 'cd <workspace> && exec env PORT=<port> <launcher> >> <log> 2>&1' </dev/null >/dev/null 2>&1 &`
  for a real background server.
- Redirect stdout and stderr to a workspace-specific log under `/tmp`.
- Verify with `curl -I` before reporting the URL.
- Do not rely on a plain foreground command for operator-facing server sessions.
- Do not rely on a fragile one-liner that only backgrounds the wrapper without verifying the child server stayed alive.

## Launcher Notes

The launcher derives decision-os runtime paths from its own location and sets:

```bash
DECISION_OS_FRONTEND_ROOT=/home/jbb/dev/EditorBP/decision-os/frontend
TSX_TSCONFIG_PATH=/home/jbb/dev/EditorBP/decision-os/backend/tsconfig.json
```

To inspect the underlying command without starting the server:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs --print-command
```

## Voice Transcription

Voice transcription is configured per target workspace through:

```text
<workspace>/.decision-os/.settings.json
```

Minimal settings:

```json
{
  "decisionOsFrontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "openaiApiKey": "sk-..."
}
```

Supported aliases are also accepted:

```json
{
  "frontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "DECISION_OS_FRONTEND_ROOT": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "OPENAI_API_KEY": "sk-...",
  "OPENAI_TRANSCRIPTION_MODEL": "gpt-4o-mini-transcribe"
}
```

Keep this file local and ignored. Do not commit API keys or uploaded voice files.

## Operator Keys

The in-app Keys panel should list the current keyboard contract:

```text
A       Open or focus the thread panel.
X       Start or stop the active voice note.
Esc     Cancel voice capture, close thread tooling, or clear selection.
Del     Confirm deletion for the selected card, zone, or group.
Ctrl+C  Copy the selected cards, zones, and groups.
Ctrl+V  Paste the copied selection.
Ctrl+D  Resize selected cards to their content and selected zones to contained cards.
```

## Commit Hygiene

- Never finish a feature with implementation changes left uncommitted.
- After implementing and verifying a feature, create focused commits before reporting the feature complete.
- When the operator asks to push committed work, push with the Wise SSH key:

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' git push
```

## Debugging

- Solve one problem at a time instead of trying to fix everything.
- List all possible options.
- Find what is wrong in the chain at a fundamental level.
- Choose one thing with the most yield, the least effort, the smallest amount of LOC, and the most structurally correcting change.
- After choosing a direction, expand your knowledge and check everything related so you do not miss critical elements.
- Correcting means fixing the technical debt.
- Do not propose hiding, disabling, or bypassing the behavior under investigation as an optimization. That is avoiding the bug, not solving it, unless the operator explicitly asks for a degraded-mode tradeoff.

## Code Smells

- It is a code smell to do expensive operations for many more elements than are needed in the end.

## Card Image Assets

Markdown image assets can be referenced from the active workspace `.decision-os` directory:

```markdown
![Campaign UI Summary](.decision-os/ui-mockups/campaign-ui-3-summary.png)
```

The backend serves image files from `/.decision-os/...` for the active workspace only. Adjacent standalone images, including image-only lines separated by blank lines, render as a carousel. Image frames resize by width, derive height from the loaded image aspect ratio, and persist dimensions in the card JSON under `imageSizes`, keyed by the markdown image URL.
diff --git a/frontend/src/runtime/card/effect/resize-selected-card.ts b/frontend/src/runtime/card/effect/resize-selected-card.ts
index cbed1af..6236385 100644
--- a/frontend/src/runtime/card/effect/resize-selected-card.ts
+++ b/frontend/src/runtime/card/effect/resize-selected-card.ts
@@ -6,12 +6,16 @@ import { activeLedgerCardMap, ledgerCardGeometry, patchLedgerCardGeometry, type
 import { renderGeometry } from '../../canvas/helper/render-density.js';
 
 export function resizeSelectedCard(dx: number, dy: number): void {
-  const card = state.pointer?.target as HTMLElement | null;
-  if (!card) return;
-  const current = state.activeLedger && card.dataset.cardId
-    ? ledgerCardGeometry(activeLedgerCardMap().get(card.dataset.cardId) ?? {})
-    : { x: card.offsetLeft, y: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
-  const handle = state.pointer.resizeHandle as HTMLElement | null;
+  const pointer = state.pointer;
+  const savedCard = pointer?.target as HTMLElement | null;
+  const cardId = String(pointer?.targetId || savedCard?.dataset.cardId || '');
+  const card = resolveCurrentCardNode(cardId, savedCard);
+  const ledgerCard = state.activeLedger && cardId ? activeLedgerCardMap().get(cardId) : undefined;
+  if (!card && !ledgerCard) return;
+  const current = ledgerCard
+    ? ledgerCardGeometry(ledgerCard)
+    : { x: card?.offsetLeft ?? 0, y: card?.offsetTop ?? 0, width: card?.offsetWidth ?? 0, height: card?.offsetHeight ?? 0 };
+  const handle = pointer?.resizeHandle as HTMLElement | null;
   const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
   const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
   const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
@@ -35,14 +39,21 @@ export function resizeSelectedCard(dx: number, dy: number): void {
   }
   if (south) nextHeight = Math.max(minHeight, current.height + dy);
   const geometry = { x: nextLeft, y: nextTop, width: nextWidth, height: nextHeight };
-  if (state.activeLedger && card.dataset.cardId) {
-    const ledgerCard = activeLedgerCardMap().get(card.dataset.cardId);
-    if (ledgerCard) patchLedgerCardGeometry(ledgerCard, geometry);
-  }
-  patchCardBox(card, geometry);
+  if (ledgerCard) patchLedgerCardGeometry(ledgerCard, geometry);
+  if (card) patchCardBox(card, geometry);
   renderRelationshipOverlay();
   renderCanvasControlOverlay();
-  telemetry('render-card-layer', { spec: '60000006', resized: card.dataset.cardId, geometry });
+  telemetry('render-card-layer', { spec: '60000006', resized: cardId, geometry });
+}
+
+function resolveCurrentCardNode(cardId: string, savedCard: HTMLElement | null): HTMLElement | null {
+  if (!cardId) return savedCard;
+  if (savedCard?.dataset.cardId === cardId && savedCard.isConnected !== false) return savedCard;
+  return document.querySelector(`[data-card-id="${cssEscape(cardId)}"]`) as HTMLElement | null;
+}
+
+function cssEscape(value: string): string {
+  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
 }
 
 function patchCardBox(card: HTMLElement, geometry: LedgerGeometry): void {
diff --git a/frontend/src/runtime/gesture/controller/handle-pointer-down.ts b/frontend/src/runtime/gesture/controller/handle-pointer-down.ts
index ec154aa..3d4935a 100644
--- a/frontend/src/runtime/gesture/controller/handle-pointer-down.ts
+++ b/frontend/src/runtime/gesture/controller/handle-pointer-down.ts
@@ -3,7 +3,7 @@
  * WHY: Drag, pan, resize, draw, and edit control flow must share one canonical pointer entrypoint.
  */
 import { canvas } from '../../dom.js';
-import { state } from '../../state.js';
+import { createPointerSelectionSnapshot, state } from '../../state.js';
 import { derivePointerIntent, isForcedPanPointer } from '../helper/derive-pointer-intent.js';
 import { canvasPoint } from '../../canvas/helper/canvas-point.js';
 import { patchBox } from '../../canvas/effect/patch-box.js';
@@ -43,6 +43,14 @@ export function handlePointerDown(event: PointerEvent): void {
   const preserveSelection = shouldPreservePointerSelection(state.selection, targetKind, targetId, event.shiftKey);
   if ((intent === 'drag' || intent === 'group') && !preserveSelection) selectTarget(targetKind, targetId, event.shiftKey);
   if (intent === 'resize') selectTarget(targetKind, targetId, false);
+  if (state.pointer && (intent === 'drag' || intent === 'group' || intent === 'resize')) {
+    state.pointer.selectionSnapshot = createPointerSelectionSnapshot({
+      selection: state.selection,
+      targetKind,
+      targetId,
+      ledgerStateId: currentLedgerStateId()
+    });
+  }
   if (intent === 'marquee' || intent === 'draw-card' || intent === 'draw-zone' || intent === 'draw-group') {
     const marquee = document.querySelector('.marquee') as HTMLElement;
     marquee.hidden = false;
@@ -50,3 +58,7 @@ export function handlePointerDown(event: PointerEvent): void {
   }
   canvas.setPointerCapture?.(event.pointerId);
 }
+
+function currentLedgerStateId(): string {
+  return String(state.activeLedgerId || (state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab || ''));
+}
diff --git a/frontend/src/runtime/gesture/controller/handle-pointer-move.ts b/frontend/src/runtime/gesture/controller/handle-pointer-move.ts
index cdf90c4..3576a1a 100644
--- a/frontend/src/runtime/gesture/controller/handle-pointer-move.ts
+++ b/frontend/src/runtime/gesture/controller/handle-pointer-move.ts
@@ -42,7 +42,7 @@ export function handlePointerMove(event: PointerEvent): void {
   }
   telemetry('canvas-pointer-move', { intent: state.pointer.intent, dx, dy, canvasDx, canvasDy });
   if (state.pointer.intent === 'drag' || state.pointer.intent === 'group') {
-    moveSelected(canvasDx, canvasDy);
+    moveSelected(canvasDx, canvasDy, state.pointer.selectionSnapshot ?? state.selection);
     telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy });
   }
   if (state.pointer.intent === 'resize') {
diff --git a/frontend/src/runtime/gesture/controller/handle-pointer-up.ts b/frontend/src/runtime/gesture/controller/handle-pointer-up.ts
index 8cf9892..08348ed 100644
--- a/frontend/src/runtime/gesture/controller/handle-pointer-up.ts
+++ b/frontend/src/runtime/gesture/controller/handle-pointer-up.ts
@@ -70,17 +70,18 @@ export async function handlePointerUp(event: PointerEvent): Promise<void> {
     return;
   }
   if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {
+    const gestureSelection = pointerSession.selectionSnapshot ?? state.selection;
     const canvasDx = releaseCanvas.x - pointerSession.currentCanvas.x;
     const canvasDy = releaseCanvas.y - pointerSession.currentCanvas.y;
     if (canvasDx || canvasDy) {
-      if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy);
+      if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);
       if (pointerIntent === 'resize') {
         if (pointerSession.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);
         else resizeSelectedZone(canvasDx, canvasDy);
       }
     }
     finishPointer(event);
-    releaseRendered = await commitSelectedLedgerGeometry();
+    releaseRendered = await commitSelectedLedgerGeometry(gestureSelection);
   }
   if (pointerIntent === 'pan' || pointerIntent === 'marquee') finishPointer(event);
   persistState();
diff --git a/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts b/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
index 3dee821..b16dbd0 100644
--- a/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
+++ b/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
@@ -1,10 +1,10 @@
-import { state } from '../../state.js';
+import { state, type SelectionState } from '../../state.js';
 import { commitActiveLedgerMutation } from './commit-active-ledger-mutation.js';
 import { selectedLedgerGeometryPayload } from '../helper/active-ledger-geometry.js';
 
-export async function commitSelectedLedgerGeometry(): Promise<boolean> {
+export async function commitSelectedLedgerGeometry(selection: Partial<SelectionState> = state.selection): Promise<boolean> {
   if (!state.activeLedger) return false;
-  const geometry = selectedLedgerGeometryPayload();
+  const geometry = selectedLedgerGeometryPayload(selection);
   const hasGeometry = Object.values(geometry).some((records) => Object.keys(records).length > 0);
   if (!hasGeometry) return false;
   return commitActiveLedgerMutation({ action: 'patch-geometry', geometry }, { render: true });
diff --git a/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts b/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
index 6915db1..2fda505 100644
--- a/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
+++ b/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
@@ -2,7 +2,8 @@
  * WHAT: Loads the active route ledger from the backend.
  * WHY: Server ledgers are authoritative, while optimistic thread notes must survive stale refreshes.
  */
-import { state } from '../../state.js';
+import { emptySelectionState, restoreSelectionFromPointerSnapshot, state } from '../../state.js';
+import { pruneSelectionToActiveLedger } from '../helper/active-ledger-geometry.js';
 import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
 import { mergeLocalCanvasStateIntoLedger } from '../helper/merge-local-canvas-state.js';
 import { mergeLocalThreadNotes } from '../helper/merge-local-thread-notes.js';
@@ -13,10 +14,12 @@ export async function loadActiveLedgerState(): Promise<void> {
   const endpoint = ledgerEndpointForTab(state.activeTab);
   const ledgerStateId = state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab;
   const canMergeLocalCanvas = Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
+  const canPreserveSelection = canMergeLocalCanvas;
   const localLedger = canMergeLocalCanvas ? state.activeLedger : null;
   if (!endpoint) {
     state.activeLedger = null;
     state.activeLedgerId = '';
+    state.selection = emptySelectionState();
     refreshZoneAttributionCache('missing-ledger-tab');
     telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false, source: 'missing-ledger-tab' });
     return;
@@ -25,6 +28,7 @@ export async function loadActiveLedgerState(): Promise<void> {
   if (!response?.ok) {
     state.activeLedger = null;
     state.activeLedgerId = '';
+    state.selection = emptySelectionState();
     refreshZoneAttributionCache('load-failed');
     telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false });
     return;
@@ -40,6 +44,11 @@ export async function loadActiveLedgerState(): Promise<void> {
     if (state.canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...localViewport } };
   } else if (state.canvasMode === 'ledgers') Object.assign(state.viewport, ledger?.viewport ?? state.viewport);
   else Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? ledger?.viewport ?? state.viewport);
-  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  if (canPreserveSelection) {
+    state.selection = pruneSelectionToActiveLedger(state.selection);
+    restoreSelectionFromPointerSnapshot(ledgerStateId);
+  } else {
+    state.selection = emptySelectionState();
+  }
   telemetry('load-ledger-state', { activeTab: state.activeTab, canvasMode: state.canvasMode, ok: Boolean(ledger), cards: ledger?.cards?.length ?? 0, relationships: ledger?.relationships?.length ?? 0 });
 }
diff --git a/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts b/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
index 6fa8216..61c4476 100644
--- a/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
+++ b/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
@@ -1,4 +1,4 @@
-import { state } from '../../state.js';
+import { cloneSelectionState, state, type SelectionState } from '../../state.js';
 
 export type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
 export type LedgerGeometry = { x: number; y: number; width: number; height: number };
@@ -106,11 +106,29 @@ export function patchLedgerAnnotationGeometry(annotation: LedgerRecord, geometry
   return ledgerAnnotationGeometry(annotation);
 }
 
-export function selectedLedgerGeometryPayload(selection = state.selection): {
+export function pruneSelectionToActiveLedger(selection: Partial<SelectionState> = state.selection): SelectionState {
+  const current = cloneSelectionState(selection);
+  const cards = activeLedgerCardMap();
+  const annotations = activeLedgerAnnotationMap();
+  return {
+    cardIds: current.cardIds.filter((id) => cards.has(id)),
+    zoneIds: current.zoneIds.filter((id) => {
+      const annotation = annotations.get(id);
+      return Boolean(annotation && annotation.variant !== 'group');
+    }),
+    groupIds: current.groupIds.filter((id) => {
+      const annotation = annotations.get(id);
+      return Boolean(annotation && annotation.variant === 'group');
+    })
+  };
+}
+
+export function selectedLedgerGeometryPayload(selection: Partial<SelectionState> = state.selection): {
   cards: Record<string, LedgerGeometry>;
   zones: Record<string, LedgerGeometry>;
   groups: Record<string, LedgerGeometry>;
 } {
+  const current = cloneSelectionState(selection);
   const cards = activeLedgerCardMap();
   const annotations = activeLedgerAnnotationMap();
   const payload = { cards: {}, zones: {}, groups: {} } as {
@@ -118,15 +136,15 @@ export function selectedLedgerGeometryPayload(selection = state.selection): {
     zones: Record<string, LedgerGeometry>;
     groups: Record<string, LedgerGeometry>;
   };
-  for (const id of selection.cardIds as string[]) {
+  for (const id of current.cardIds) {
     const card = cards.get(id);
     if (card) payload.cards[id] = ledgerCardGeometry(card);
   }
-  for (const id of selection.zoneIds as string[]) {
+  for (const id of current.zoneIds) {
     const annotation = annotations.get(id);
     if (annotation) payload.zones[id] = ledgerAnnotationGeometry(annotation);
   }
-  for (const id of selection.groupIds as string[]) {
+  for (const id of current.groupIds) {
     const annotation = annotations.get(id);
     if (annotation) payload.groups[id] = ledgerAnnotationGeometry(annotation);
   }
diff --git a/frontend/src/runtime/refresh/controller/refresh-runtime-state.ts b/frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
index facdb16..30212ed 100644
--- a/frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
+++ b/frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
@@ -25,7 +25,6 @@ export async function refreshRuntimeState(): Promise<void> {
     if (state.canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...localViewport } };
   } else if (state.canvasMode === 'ledger') Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? persisted.viewport ?? { x: 0, y: 0, scale: 1 });
   applyRailCollapsedState(persisted.railCollapsed === true);
-  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
   hydratePersistedGeometry(persisted.geometry);
   await loadActiveLedgerState();
   telemetry('load-ledger-state', { specId: '50000006', restored: Boolean(persisted.geometry || persisted.viewport) });
diff --git a/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts b/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
index dcf293d..9455c59 100644
--- a/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
+++ b/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
@@ -8,7 +8,7 @@ import { resumeExternallyStartedCardSkillRun } from '../../codex/effect/poll-car
 import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
 import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
 import { persistState } from '../../persistence/effect/persist-state.js';
-import { state } from '../../state.js';
+import { cloneSelectionState, selectionStatesEqual, state } from '../../state.js';
 import { telemetry } from '../../telemetry/effect/telemetry.js';
 import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
 
@@ -116,10 +116,10 @@ async function reloadThreadContent(reason: string): Promise<void> {
     return;
   }
   threadRefreshInFlight = true;
-  const selection = state.selection;
+  const selection = cloneSelectionState(state.selection);
   try {
     await loadActiveLedgerState();
-    state.selection = selection;
+    if (!state.pointer && selectionStatesEqual(state.selection, selection)) state.selection = cloneSelectionState(selection);
     renderThreadPanel();
     telemetry('thread-content-refresh', { reason });
   } finally {
diff --git a/frontend/src/runtime/selection/effect/move-selected.ts b/frontend/src/runtime/selection/effect/move-selected.ts
index 4546946..95a6c41 100644
--- a/frontend/src/runtime/selection/effect/move-selected.ts
+++ b/frontend/src/runtime/selection/effect/move-selected.ts
@@ -1,4 +1,4 @@
-import { state } from '../../state.js';
+import { cloneSelectionState, state, type SelectionState } from '../../state.js';
 import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
 import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
 import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
@@ -6,38 +6,37 @@ import { telemetry } from '../../telemetry/effect/telemetry.js';
 import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, patchLedgerAnnotationGeometry, patchLedgerCardGeometry } from '../../ledger/helper/active-ledger-geometry.js';
 import { renderGeometry } from '../../canvas/helper/render-density.js';
 
-export function moveSelected(dx: number, dy: number): void {
+export function moveSelected(dx: number, dy: number, selection: Partial<SelectionState> = state.selection): void {
+  const movingSelection = cloneSelectionState(selection);
   if (state.activeLedger) {
-    moveSelectedLedgerGeometry(dx, dy);
+    moveSelectedLedgerGeometry(dx, dy, movingSelection);
   } else {
-    moveSelectedDomGeometry(dx, dy);
+    moveSelectedDomGeometry(dx, dy, movingSelection);
   }
-  telemetry('render-card-layer', { moved: state.selection.cardIds });
-  telemetry('render-zone-layer', { moved: state.selection.zoneIds });
-  telemetry('render-group-layer', { moved: state.selection.groupIds });
-  renderZoneLabelOverlay();
-  renderRelationshipOverlay();
-  renderCanvasControlOverlay();
+  telemetry('render-card-layer', { moved: movingSelection.cardIds });
+  telemetry('render-zone-layer', { moved: movingSelection.zoneIds });
+  telemetry('render-group-layer', { moved: movingSelection.groupIds });
+  renderMovementOverlays(movingSelection);
 }
 
-function moveSelectedLedgerGeometry(dx: number, dy: number): void {
+function moveSelectedLedgerGeometry(dx: number, dy: number, selection: SelectionState): void {
   const cards = activeLedgerCardMap();
   const annotations = activeLedgerAnnotationMap();
-  for (const id of state.selection.cardIds as string[]) {
+  for (const id of selection.cardIds) {
     const card = cards.get(id);
     if (!card) continue;
     const geometry = ledgerCardGeometry(card);
     patchLedgerCardGeometry(card, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
     patchNodePosition(document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
   }
-  for (const id of state.selection.zoneIds as string[]) {
+  for (const id of selection.zoneIds) {
     const annotation = annotations.get(id);
     if (!annotation) continue;
     const geometry = ledgerAnnotationGeometry(annotation);
     patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
     patchNodePosition(document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
   }
-  for (const id of state.selection.groupIds as string[]) {
+  for (const id of selection.groupIds) {
     const annotation = annotations.get(id);
     if (!annotation) continue;
     const geometry = ledgerAnnotationGeometry(annotation);
@@ -46,11 +45,11 @@ function moveSelectedLedgerGeometry(dx: number, dy: number): void {
   }
 }
 
-function moveSelectedDomGeometry(dx: number, dy: number): void {
+function moveSelectedDomGeometry(dx: number, dy: number, selection: SelectionState): void {
   const selected = [
-    ...state.selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
-    ...state.selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
-    ...state.selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
+    ...selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
+    ...selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
+    ...selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
   ].filter(Boolean) as HTMLElement[];
   selected.forEach((node) => {
     node.style.left = `${node.offsetLeft + dx}px`;
@@ -58,6 +57,18 @@ function moveSelectedDomGeometry(dx: number, dy: number): void {
   });
 }
 
+function renderMovementOverlays(selection: SelectionState): void {
+  const visibleSelection = state.selection;
+  state.selection = selection;
+  try {
+    renderZoneLabelOverlay();
+    renderRelationshipOverlay();
+    renderCanvasControlOverlay();
+  } finally {
+    state.selection = visibleSelection;
+  }
+}
+
 function patchNodePosition(node: HTMLElement | null, x: number, y: number): void {
   if (!node) return;
   const renderedGeometry = renderGeometry({ x, y, width: 0, height: 0 });
diff --git a/frontend/src/runtime/state.ts b/frontend/src/runtime/state.ts
index 88513df..b580078 100644
--- a/frontend/src/runtime/state.ts
+++ b/frontend/src/runtime/state.ts
@@ -1,3 +1,59 @@
+export type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };
+
+export type PointerSelectionSnapshot = SelectionState & {
+  targetKind: string;
+  targetId: string;
+  ledgerStateId: string;
+};
+
+function selectionIds(values: unknown): string[] {
+  return Array.isArray(values) ? values.map((value) => String(value)).filter(Boolean) : [];
+}
+
+export function emptySelectionState(): SelectionState {
+  return { cardIds: [], zoneIds: [], groupIds: [] };
+}
+
+export function cloneSelectionState(selection: Partial<SelectionState> | null | undefined = emptySelectionState()): SelectionState {
+  return {
+    cardIds: selectionIds(selection?.cardIds),
+    zoneIds: selectionIds(selection?.zoneIds),
+    groupIds: selectionIds(selection?.groupIds)
+  };
+}
+
+export function createPointerSelectionSnapshot(input: {
+  selection: Partial<SelectionState>;
+  targetKind: string;
+  targetId: string;
+  ledgerStateId: string;
+}): PointerSelectionSnapshot {
+  return {
+    ...cloneSelectionState(input.selection),
+    targetKind: input.targetKind,
+    targetId: input.targetId,
+    ledgerStateId: input.ledgerStateId
+  };
+}
+
+export function selectionStatesEqual(left: Partial<SelectionState> | null | undefined, right: Partial<SelectionState> | null | undefined): boolean {
+  const a = cloneSelectionState(left);
+  const b = cloneSelectionState(right);
+  return arraysEqual(a.cardIds, b.cardIds) && arraysEqual(a.zoneIds, b.zoneIds) && arraysEqual(a.groupIds, b.groupIds);
+}
+
+export function restoreSelectionFromPointerSnapshot(ledgerStateId = ''): boolean {
+  const snapshot = state.pointer?.selectionSnapshot;
+  if (!snapshot) return false;
+  if (ledgerStateId && snapshot.ledgerStateId !== ledgerStateId) return false;
+  state.selection = cloneSelectionState(snapshot);
+  return true;
+}
+
+function arraysEqual(left: string[], right: string[]): boolean {
+  return left.length === right.length && left.every((value, index) => value === right[index]);
+}
+
 export const state: any = {
   routePath: globalThis.window?.location?.pathname ?? '/',
   projectName: 'Project',
@@ -24,7 +80,7 @@ export const state: any = {
   viewports: { specs: { x: 0, y: 0, scale: 1 }, data: { x: 0, y: 0, scale: 1 } },
   cardUi: { openCardIds: [], activeTabByCardId: {} },
   zoneAttributionCache: null,
-  selection: { cardIds: [], zoneIds: [], groupIds: [] },
+  selection: emptySelectionState(),
   pointer: null,
   clipboard: null,
   threadId: '',
diff --git a/frontend/src/runtime/zone/effect/resize-selected-zone.ts b/frontend/src/runtime/zone/effect/resize-selected-zone.ts
index c2f2a42..7bdb9c5 100644
--- a/frontend/src/runtime/zone/effect/resize-selected-zone.ts
+++ b/frontend/src/runtime/zone/effect/resize-selected-zone.ts
@@ -6,20 +6,24 @@ import { activeLedgerAnnotationMap, ledgerAnnotationGeometry, patchLedgerAnnotat
 import { renderGeometry } from '../../canvas/helper/render-density.js';
 
 export function resizeSelectedZone(dx: number, dy: number): void {
-  const zone = state.pointer?.target as HTMLElement | null;
-  if (!zone) return;
-  const id = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
+  const pointer = state.pointer;
+  const savedZone = pointer?.target as HTMLElement | null;
+  const targetKind = pointer?.targetKind === 'group' ? 'group' : 'zone';
+  const id = String(pointer?.targetId || savedZone?.dataset.zoneId || savedZone?.dataset.groupId || '');
+  const zone = resolveCurrentZoneNode(id, targetKind, savedZone);
   const ledgerAnnotation = state.activeLedger && id ? activeLedgerAnnotationMap().get(id) : undefined;
+  if (!zone && !ledgerAnnotation) return;
+  const isGroup = targetKind === 'group' || zone?.dataset.groupId === id || ledgerAnnotation?.variant === 'group';
   const current = ledgerAnnotation
     ? ledgerAnnotationGeometry(ledgerAnnotation)
-    : { x: zone.offsetLeft, y: zone.offsetTop, width: zone.offsetWidth, height: zone.offsetHeight };
-  const handle = state.pointer.resizeHandle as HTMLElement | null;
+    : { x: zone?.offsetLeft ?? 0, y: zone?.offsetTop ?? 0, width: zone?.offsetWidth ?? 0, height: zone?.offsetHeight ?? 0 };
+  const handle = pointer?.resizeHandle as HTMLElement | null;
   const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
   const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
   const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
   const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
-  const minWidth = zone.dataset.groupId ? 220 : 180;
-  const minHeight = zone.dataset.groupId ? 160 : 140;
+  const minWidth = isGroup ? 220 : 180;
+  const minHeight = isGroup ? 160 : 140;
   let nextLeft = current.x;
   let nextTop = current.y;
   let nextWidth = current.width;
@@ -38,10 +42,22 @@ export function resizeSelectedZone(dx: number, dy: number): void {
   if (south) nextHeight = Math.max(minHeight, current.height + dy);
   const geometry = { x: nextLeft, y: nextTop, width: nextWidth, height: nextHeight };
   if (ledgerAnnotation) patchLedgerAnnotationGeometry(ledgerAnnotation, geometry);
-  patchZoneBox(zone, geometry);
+  if (zone) patchZoneBox(zone, geometry);
   renderZoneLabelOverlay();
   renderCanvasControlOverlay();
-  telemetry(zone.dataset.groupId ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
+  telemetry(isGroup ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
+}
+
+function resolveCurrentZoneNode(id: string, kind: 'zone' | 'group', savedZone: HTMLElement | null): HTMLElement | null {
+  if (!id) return savedZone;
+  const savedId = kind === 'group' ? savedZone?.dataset.groupId : savedZone?.dataset.zoneId;
+  if (savedId === id && savedZone?.isConnected !== false) return savedZone;
+  const attribute = kind === 'group' ? 'data-group-id' : 'data-zone-id';
+  return document.querySelector(`[${attribute}="${cssEscape(id)}"]`) as HTMLElement | null;
+}
+
+function cssEscape(value: string): string {
+  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
 }
 
 function patchZoneBox(zone: HTMLElement, geometry: LedgerGeometry): void {
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-12","timestamp":"2026-07-10T04:36:30.070Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"12","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' frontend/src/runtime/state.ts\nsed -n '1,240p' frontend/src/runtime/selection/effect/move-selected.ts\nsed -n '1,230p' frontend/src/runtime/ledger/helper/active-ledger-geometry.ts\nsed -n '1,230p' frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts\nsed -n '1,140p' frontend/src/runtime/card/effect/resize-selected-card.ts\nsed -n '1,140p' frontend/src/runtime/zone/effect/resize-selected-zone.ts\nrg -n \\\"renderZoneLabelOverlay|renderRelationshipOverlay|renderCanvasControlOverlay\\\" frontend/src/runtime | head -120\nfind frontend/src/runtime/selection frontend/src/runtime/gesture frontend/src/runtime/ledger/helper frontend/src/runtime/card/helper frontend/src/runtime/zone/helper -maxdepth 3 -type f | sort\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' frontend/src/runtime/state.ts
sed -n '1,240p' frontend/src/runtime/selection/effect/move-selected.ts
sed -n '1,230p' frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
sed -n '1,230p' frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
sed -n '1,140p' frontend/src/runtime/card/effect/resize-selected-card.ts
sed -n '1,140p' frontend/src/runtime/zone/effect/resize-selected-zone.ts
rg -n \"renderZoneLabelOverlay|renderRelationshipOverlay|renderCanvasControlOverlay\" frontend/src/runtime | head -120
find frontend/src/runtime/selection frontend/src/runtime/gesture frontend/src/runtime/ledger/helper frontend/src/runtime/card/helper frontend/src/runtime/zone/helper -maxdepth 3 -type f | sort"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-13","timestamp":"2026-07-10T04:36:30.070Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"13","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' frontend/src/runtime/state.ts\nsed -n '1,240p' frontend/src/runtime/selection/effect/move-selected.ts\nsed -n '1,230p' frontend/src/runtime/ledger/helper/active-ledger-geometry.ts\nsed -n '1,230p' frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts\nsed -n '1,140p' frontend/src/runtime/card/effect/resize-selected-card.ts\nsed -n '1,140p' frontend/src/runtime/zone/effect/resize-selected-zone.ts\nrg -n \\\"renderZoneLabelOverlay|renderRelationshipOverlay|renderCanvasControlOverlay\\\" frontend/src/runtime | head -120\nfind frontend/src/runtime/selection frontend/src/runtime/gesture frontend/src/runtime/ledger/helper frontend/src/runtime/card/helper frontend/src/runtime/zone/helper -maxdepth 3 -type f | sort\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' frontend/src/runtime/state.ts
sed -n '1,240p' frontend/src/runtime/selection/effect/move-selected.ts
sed -n '1,230p' frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
sed -n '1,230p' frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
sed -n '1,140p' frontend/src/runtime/card/effect/resize-selected-card.ts
sed -n '1,140p' frontend/src/runtime/zone/effect/resize-selected-zone.ts
rg -n \"renderZoneLabelOverlay|renderRelationshipOverlay|renderCanvasControlOverlay\" frontend/src/runtime | head -120
find frontend/src/runtime/selection frontend/src/runtime/gesture frontend/src/runtime/ledger/helper frontend/src/runtime/card/helper frontend/src/runtime/zone/helper -maxdepth 3 -type f | sort"`
Status: completed
Exit code: 0

````text
export type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };

export type PointerSelectionSnapshot = SelectionState & {
  targetKind: string;
  targetId: string;
  ledgerStateId: string;
};

function selectionIds(values: unknown): string[] {
  return Array.isArray(values) ? values.map((value) => String(value)).filter(Boolean) : [];
}

export function emptySelectionState(): SelectionState {
  return { cardIds: [], zoneIds: [], groupIds: [] };
}

export function cloneSelectionState(selection: Partial<SelectionState> | null | undefined = emptySelectionState()): SelectionState {
  return {
    cardIds: selectionIds(selection?.cardIds),
    zoneIds: selectionIds(selection?.zoneIds),
    groupIds: selectionIds(selection?.groupIds)
  };
}

export function createPointerSelectionSnapshot(input: {
  selection: Partial<SelectionState>;
  targetKind: string;
  targetId: string;
  ledgerStateId: string;
}): PointerSelectionSnapshot {
  return {
    ...cloneSelectionState(input.selection),
    targetKind: input.targetKind,
    targetId: input.targetId,
    ledgerStateId: input.ledgerStateId
  };
}

export function selectionStatesEqual(left: Partial<SelectionState> | null | undefined, right: Partial<SelectionState> | null | undefined): boolean {
  const a = cloneSelectionState(left);
  const b = cloneSelectionState(right);
  return arraysEqual(a.cardIds, b.cardIds) && arraysEqual(a.zoneIds, b.zoneIds) && arraysEqual(a.groupIds, b.groupIds);
}

export function restoreSelectionFromPointerSnapshot(ledgerStateId = ''): boolean {
  const snapshot = state.pointer?.selectionSnapshot;
  if (!snapshot) return false;
  if (ledgerStateId && snapshot.ledgerStateId !== ledgerStateId) return false;
  state.selection = cloneSelectionState(snapshot);
  return true;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export const state: any = {
  routePath: globalThis.window?.location?.pathname ?? '/',
  projectName: 'Project',
  canvasMode: 'ledger',
  activeLedgerId: 'specs',
  activeTab: 'specs',
  ledgers: [
    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
  ],
  ledgerTabs: [
    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
  ],
  activeLedger: null,
  activeTool: 'select',
  railCollapsed: false,
  zoneColor: '#55b8ff',
  cardCounter: 1,
  zoneCounter: 3,
  groupCounter: 2,
  viewport: { x: 0, y: 0, scale: 1 },
  surfaceViewport: { x: 0, y: 0, scale: 1 },
  viewports: { specs: { x: 0, y: 0, scale: 1 }, data: { x: 0, y: 0, scale: 1 } },
  cardUi: { openCardIds: [], activeTabByCardId: {} },
  zoneAttributionCache: null,
  selection: emptySelectionState(),
  pointer: null,
  clipboard: null,
  threadId: '',
  renderedThreadId: '',
  threadScrollTopByThreadId: {},
  threadPanelOpen: false,
  voice: { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' },
  telemetry: []
};
import { cloneSelectionState, state, type SelectionState } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, patchLedgerAnnotationGeometry, patchLedgerCardGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function moveSelected(dx: number, dy: number, selection: Partial<SelectionState> = state.selection): void {
  const movingSelection = cloneSelectionState(selection);
  if (state.activeLedger) {
    moveSelectedLedgerGeometry(dx, dy, movingSelection);
  } else {
    moveSelectedDomGeometry(dx, dy, movingSelection);
  }
  telemetry('render-card-layer', { moved: movingSelection.cardIds });
  telemetry('render-zone-layer', { moved: movingSelection.zoneIds });
  telemetry('render-group-layer', { moved: movingSelection.groupIds });
  renderMovementOverlays(movingSelection);
}

function moveSelectedLedgerGeometry(dx: number, dy: number, selection: SelectionState): void {
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  for (const id of selection.cardIds) {
    const card = cards.get(id);
    if (!card) continue;
    const geometry = ledgerCardGeometry(card);
    patchLedgerCardGeometry(card, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
  for (const id of selection.zoneIds) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = ledgerAnnotationGeometry(annotation);
    patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
  for (const id of selection.groupIds) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = ledgerAnnotationGeometry(annotation);
    patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-group-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
}

function moveSelectedDomGeometry(dx: number, dy: number, selection: SelectionState): void {
  const selected = [
    ...selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
    ...selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
    ...selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
  ].filter(Boolean) as HTMLElement[];
  selected.forEach((node) => {
    node.style.left = `${node.offsetLeft + dx}px`;
    node.style.top = `${node.offsetTop + dy}px`;
  });
}

function renderMovementOverlays(selection: SelectionState): void {
  const visibleSelection = state.selection;
  state.selection = selection;
  try {
    renderZoneLabelOverlay();
    renderRelationshipOverlay();
    renderCanvasControlOverlay();
  } finally {
    state.selection = visibleSelection;
  }
}

function patchNodePosition(node: HTMLElement | null, x: number, y: number): void {
  if (!node) return;
  const renderedGeometry = renderGeometry({ x, y, width: 0, height: 0 });
  node.style.left = `${renderedGeometry.x}px`;
  node.style.top = `${renderedGeometry.y}px`;
}
import { cloneSelectionState, state, type SelectionState } from '../../state.js';

export type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type LedgerGeometry = { x: number; y: number; width: number; height: number };

type LedgerRecord = Record<string, unknown>;

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function ledgerCardGeometry(card: LedgerRecord): LedgerGeometry {
  return {
    x: finiteNumber(card.x, 0),
    y: finiteNumber(card.y, 0),
    width: Math.max(220, finiteNumber(card.w ?? card.width, 280)),
    height: Math.max(132, finiteNumber(card.h ?? card.height, 132))
  };
}

export function ledgerAnnotationGeometry(annotation: LedgerRecord): LedgerGeometry {
  const minWidth = annotation.variant === 'group' ? 220 : 180;
  const minHeight = annotation.variant === 'group' ? 160 : 140;
  return {
    x: finiteNumber(annotation.x, 0),
    y: finiteNumber(annotation.y, 0),
    width: Math.max(minWidth, finiteNumber(annotation.width ?? annotation.w, 280)),
    height: Math.max(minHeight, finiteNumber(annotation.height ?? annotation.h, 180))
  };
}

export function geometryToRect(geometry: LedgerGeometry): CanvasRect {
  return {
    left: geometry.x,
    top: geometry.y,
    right: geometry.x + geometry.width,
    bottom: geometry.y + geometry.height,
    width: geometry.width,
    height: geometry.height
  };
}

export function activeLedgerCardRectMap(): Map<string, CanvasRect> {
  const ledger = state.activeLedger as { cards?: unknown } | null;
  const cards = Array.isArray(ledger?.cards) ? ledger.cards as LedgerRecord[] : [];
  const entries: Array<[string, CanvasRect]> = [];
  for (const card of cards) {
    const id = String(card.id ?? '');
    if (id) entries.push([id, geometryToRect(ledgerCardGeometry(card))]);
  }
  return new Map(entries);
}

export function activeLedgerCardMap(): Map<string, LedgerRecord> {
  const ledger = state.activeLedger as { cards?: unknown } | null;
  const cards = Array.isArray(ledger?.cards) ? ledger.cards as LedgerRecord[] : [];
  const entries: Array<[string, LedgerRecord]> = [];
  for (const card of cards) {
    const id = String(card.id ?? '');
    if (id) entries.push([id, card]);
  }
  return new Map(entries);
}

export function activeLedgerAnnotationMap(): Map<string, LedgerRecord> {
  const ledger = state.activeLedger as { annotations?: unknown } | null;
  const annotations = Array.isArray(ledger?.annotations) ? ledger.annotations as LedgerRecord[] : [];
  const entries: Array<[string, LedgerRecord]> = [];
  for (const annotation of annotations) {
    const id = String(annotation.id ?? '');
    if (id) entries.push([id, annotation]);
  }
  return new Map(entries);
}

export function patchLedgerCardGeometry(card: LedgerRecord, geometry: LedgerGeometry): LedgerGeometry {
  const current = ledgerCardGeometry(card);
  const next = {
    x: Number.isFinite(geometry.x) ? geometry.x : current.x,
    y: Number.isFinite(geometry.y) ? geometry.y : current.y,
    width: Number.isFinite(geometry.width) ? Math.max(220, geometry.width) : current.width,
    height: Number.isFinite(geometry.height) ? Math.max(132, geometry.height) : current.height
  };
  card.x = next.x;
  card.y = next.y;
  card.w = next.width;
  card.h = next.height;
  return next;
}

export function patchLedgerAnnotationGeometry(annotation: LedgerRecord, geometry: LedgerGeometry): LedgerGeometry {
  const current = ledgerAnnotationGeometry(annotation);
  const minWidth = annotation.variant === 'group' ? 220 : 180;
  const minHeight = annotation.variant === 'group' ? 160 : 140;
  const next = {
    x: Number.isFinite(geometry.x) ? geometry.x : current.x,
    y: Number.isFinite(geometry.y) ? geometry.y : current.y,
    width: Number.isFinite(geometry.width) ? Math.max(minWidth, geometry.width) : current.width,
    height: Number.isFinite(geometry.height) ? Math.max(minHeight, geometry.height) : current.height
  };
  annotation.x = next.x;
  annotation.y = next.y;
  annotation.width = next.width;
  annotation.height = next.height;
  return ledgerAnnotationGeometry(annotation);
}

export function pruneSelectionToActiveLedger(selection: Partial<SelectionState> = state.selection): SelectionState {
  const current = cloneSelectionState(selection);
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  return {
    cardIds: current.cardIds.filter((id) => cards.has(id)),
    zoneIds: current.zoneIds.filter((id) => {
      const annotation = annotations.get(id);
      return Boolean(annotation && annotation.variant !== 'group');
    }),
    groupIds: current.groupIds.filter((id) => {
      const annotation = annotations.get(id);
      return Boolean(annotation && annotation.variant === 'group');
    })
  };
}

export function selectedLedgerGeometryPayload(selection: Partial<SelectionState> = state.selection): {
  cards: Record<string, LedgerGeometry>;
  zones: Record<string, LedgerGeometry>;
  groups: Record<string, LedgerGeometry>;
} {
  const current = cloneSelectionState(selection);
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  const payload = { cards: {}, zones: {}, groups: {} } as {
    cards: Record<string, LedgerGeometry>;
    zones: Record<string, LedgerGeometry>;
    groups: Record<string, LedgerGeometry>;
  };
  for (const id of current.cardIds) {
    const card = cards.get(id);
    if (card) payload.cards[id] = ledgerCardGeometry(card);
  }
  for (const id of current.zoneIds) {
    const annotation = annotations.get(id);
    if (annotation) payload.zones[id] = ledgerAnnotationGeometry(annotation);
  }
  for (const id of current.groupIds) {
    const annotation = annotations.get(id);
    if (annotation) payload.groups[id] = ledgerAnnotationGeometry(annotation);
  }
  return payload;
}
/**
 * WHAT: Subscribes to backend card content file change events.
 * WHY: direct Markdown file patches must refresh rendered card content without disturbing active voice recording.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resizeSelectedCardsToContent } from '../../card/effect/resize-selected-cards-to-content.js';
import { resumeExternallyStartedCardSkillRun } from '../../codex/effect/poll-card-skill-run.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { cloneSelectionState, selectionStatesEqual, state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';

let subscribed = false;
let refreshInFlight = false;
let threadRefreshInFlight = false;

type ContentChangeEvent = {
  cardId?: string;
  contentFile?: string;
  kind?: string;
  ledgerId?: string;
  outputCardId?: string;
  reason?: string;
  runId?: string;
};

type LedgerRefreshOptions = {
  contentFile?: string;
};

function contentEventPayload(event: Event): ContentChangeEvent {
  const data = String((event as MessageEvent).data ?? '');
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return {
      cardId: typeof parsed.cardId === 'string' ? parsed.cardId : '',
      contentFile: typeof parsed.contentFile === 'string' ? parsed.contentFile : '',
      kind: typeof parsed.kind === 'string' ? parsed.kind : '',
      ledgerId: typeof parsed.ledgerId === 'string' ? parsed.ledgerId : '',
      outputCardId: typeof parsed.outputCardId === 'string' ? parsed.outputCardId : '',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      runId: typeof parsed.runId === 'string' ? parsed.runId : ''
    };
  } catch {
    return {};
  }
}

function maybeResumeCodexRunWidget(payload: ContentChangeEvent): void {
  const reason = String(payload.reason ?? '');
  if (!reason.startsWith('codex-') || !reason.endsWith('-started')) return;
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.outputCardId || payload.cardId || '').trim();
  const runId = String(payload.runId ?? '').trim();
  if (!ledgerId || !cardId || !runId) return;
  resumeExternallyStartedCardSkillRun({ ledgerId, cardId, runId });
}

function normalizedContentFile(value: unknown): string {
  const file = String(value ?? '').trim().replace(/\\/g, '/');
  if (file.startsWith('/.decision-os/')) return file.slice(1);
  return file.replace(/^\.\/+/, '');
}

export function changedCardIdForContentFile(contentFile: string): string {
  const target = normalizedContentFile(contentFile);
  if (!target) return '';
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  for (const card of cards) {
    const comment = card.comment && typeof card.comment === 'object' ? card.comment as Record<string, unknown> : {};
    if (normalizedContentFile(comment.contentFile) === target) return String(card.id ?? '');
  }
  return '';
}

async function resizeChangedCardToContent(contentFile: string): Promise<void> {
  const cardId = changedCardIdForContentFile(contentFile);
  if (!cardId) {
    telemetry('ledger-content-refresh-resize-skipped', { reason: 'card-not-found', contentFile });
    return;
  }
  const geometry = resizeSelectedCardsToContent({ cardIds: [cardId], zoneIds: [] });
  if (Object.keys(geometry.cards).length === 0 && Object.keys(geometry.zones).length === 0) {
    telemetry('ledger-content-refresh-resize-skipped', { reason: 'empty-geometry', contentFile, cardId });
    return;
  }

  persistState();
  const committed = state.activeLedger
    ? await commitActiveLedgerMutation({ action: 'patch-geometry', geometry }, { render: true })
    : false;
  telemetry('ledger-content-refresh-resize', { contentFile, cardId, committed });
}

async function reloadLedgerContent(reason: string, options: LedgerRefreshOptions = {}): Promise<void> {
  if (refreshInFlight) {
    state.pendingLedgerContentRefresh = true;
    return;
  }
  refreshInFlight = true;
  try {
    await loadActiveLedgerState();
    renderCanvasSurface();
    if (options.contentFile) await resizeChangedCardToContent(options.contentFile);
    telemetry('ledger-content-refresh', { reason, contentFile: options.contentFile ?? '' });
  } finally {
    refreshInFlight = false;
  }
}

async function reloadThreadContent(reason: string): Promise<void> {
  if (threadRefreshInFlight) {
    state.pendingThreadContentRefresh = true;
    return;
  }
  threadRefreshInFlight = true;
  const selection = cloneSelectionState(state.selection);
  try {
    await loadActiveLedgerState();
    if (!state.pointer && selectionStatesEqual(state.selection, selection)) state.selection = cloneSelectionState(selection);
    renderThreadPanel();
    telemetry('thread-content-refresh', { reason });
  } finally {
    threadRefreshInFlight = false;
  }
}

export function requestLedgerContentRefresh(reason = 'card-content-change', options: LedgerRefreshOptions = {}): void {
  if (state.voice?.recording) {
    state.pendingLedgerContentRefresh = true;
    telemetry('ledger-content-refresh-deferred', { reason, voiceRecording: true });
    return;
  }
  state.pendingLedgerContentRefresh = false;
  void reloadLedgerContent(reason, options);
}

export function requestThreadContentRefresh(reason = 'thread-content-change'): void {
  if (state.voice?.recording) {
    state.pendingThreadContentRefresh = true;
    telemetry('thread-content-refresh-deferred', { reason, voiceRecording: true });
    return;
  }
  state.pendingThreadContentRefresh = false;
  void reloadThreadContent(reason);
}

export function flushPendingLedgerContentRefresh(reason = 'voice-recording-stopped'): void {
  if (state.voice?.recording) return;
  if (state.pendingLedgerContentRefresh) {
    state.pendingLedgerContentRefresh = false;
    void reloadLedgerContent(reason);
  }
  if (state.pendingThreadContentRefresh) {
    state.pendingThreadContentRefresh = false;
    void reloadThreadContent(reason);
  }
}

export function subscribeLedgerContentEvents(): void {
  if (subscribed || typeof EventSource === 'undefined') return;
  subscribed = true;
  const events = new EventSource('/api/ledger-content-events');
  events.addEventListener('card-content-change', (event) => {
    const payload = contentEventPayload(event);
    if (payload.kind === 'thread-content') {
      requestThreadContentRefresh('thread-content-change');
      return;
    }
    requestLedgerContentRefresh('card-content-change', { contentFile: payload.contentFile });
  });
  events.addEventListener('ledger-content-change', (event) => {
    const payload = contentEventPayload(event);
    maybeResumeCodexRunWidget(payload);
    requestLedgerContentRefresh(payload.reason || 'ledger-content-change');
  });
  events.onerror = () => {
    telemetry('ledger-content-refresh-stream-error', {});
  };
  state.ledgerContentEventSource = events;
  telemetry('subscribe-ledger-content-events', {});
}
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerCardMap, ledgerCardGeometry, patchLedgerCardGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function resizeSelectedCard(dx: number, dy: number): void {
  const pointer = state.pointer;
  const savedCard = pointer?.target as HTMLElement | null;
  const cardId = String(pointer?.targetId || savedCard?.dataset.cardId || '');
  const card = resolveCurrentCardNode(cardId, savedCard);
  const ledgerCard = state.activeLedger && cardId ? activeLedgerCardMap().get(cardId) : undefined;
  if (!card && !ledgerCard) return;
  const current = ledgerCard
    ? ledgerCardGeometry(ledgerCard)
    : { x: card?.offsetLeft ?? 0, y: card?.offsetTop ?? 0, width: card?.offsetWidth ?? 0, height: card?.offsetHeight ?? 0 };
  const handle = pointer?.resizeHandle as HTMLElement | null;
  const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
  const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
  const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
  const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
  const minWidth = 220;
  const minHeight = 132;
  let nextLeft = current.x;
  let nextTop = current.y;
  let nextWidth = current.width;
  let nextHeight = current.height;
  if (west) {
    const clampedDx = Math.min(dx, current.width - minWidth);
    nextLeft = current.x + clampedDx;
    nextWidth = current.width - clampedDx;
  }
  if (east) nextWidth = Math.max(minWidth, current.width + dx);
  if (north) {
    const clampedDy = Math.min(dy, current.height - minHeight);
    nextTop = current.y + clampedDy;
    nextHeight = current.height - clampedDy;
  }
  if (south) nextHeight = Math.max(minHeight, current.height + dy);
  const geometry = { x: nextLeft, y: nextTop, width: nextWidth, height: nextHeight };
  if (ledgerCard) patchLedgerCardGeometry(ledgerCard, geometry);
  if (card) patchCardBox(card, geometry);
  renderRelationshipOverlay();
  renderCanvasControlOverlay();
  telemetry('render-card-layer', { spec: '60000006', resized: cardId, geometry });
}

function resolveCurrentCardNode(cardId: string, savedCard: HTMLElement | null): HTMLElement | null {
  if (!cardId) return savedCard;
  if (savedCard?.dataset.cardId === cardId && savedCard.isConnected !== false) return savedCard;
  return document.querySelector(`[data-card-id="${cssEscape(cardId)}"]`) as HTMLElement | null;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

function patchCardBox(card: HTMLElement, geometry: LedgerGeometry): void {
  const renderedGeometry = state.activeLedger ? renderGeometry(geometry) : geometry;
  card.style.left = `${renderedGeometry.x}px`;
  card.style.top = `${renderedGeometry.y}px`;
  card.style.width = `${renderedGeometry.width}px`;
  card.style.height = `${renderedGeometry.height}px`;
  card.style.minHeight = `${renderedGeometry.height}px`;
  card.dataset.sizeCacheWidth = String(geometry.width);
  card.dataset.sizeCacheHeight = String(geometry.height);
  card.style.setProperty('--card-size-cache-width', `${geometry.width}px`);
  card.style.setProperty('--card-size-cache-height', `${geometry.height}px`);
}
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, ledgerAnnotationGeometry, patchLedgerAnnotationGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function resizeSelectedZone(dx: number, dy: number): void {
  const pointer = state.pointer;
  const savedZone = pointer?.target as HTMLElement | null;
  const targetKind = pointer?.targetKind === 'group' ? 'group' : 'zone';
  const id = String(pointer?.targetId || savedZone?.dataset.zoneId || savedZone?.dataset.groupId || '');
  const zone = resolveCurrentZoneNode(id, targetKind, savedZone);
  const ledgerAnnotation = state.activeLedger && id ? activeLedgerAnnotationMap().get(id) : undefined;
  if (!zone && !ledgerAnnotation) return;
  const isGroup = targetKind === 'group' || zone?.dataset.groupId === id || ledgerAnnotation?.variant === 'group';
  const current = ledgerAnnotation
    ? ledgerAnnotationGeometry(ledgerAnnotation)
    : { x: zone?.offsetLeft ?? 0, y: zone?.offsetTop ?? 0, width: zone?.offsetWidth ?? 0, height: zone?.offsetHeight ?? 0 };
  const handle = pointer?.resizeHandle as HTMLElement | null;
  const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
  const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
  const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
  const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
  const minWidth = isGroup ? 220 : 180;
  const minHeight = isGroup ? 160 : 140;
  let nextLeft = current.x;
  let nextTop = current.y;
  let nextWidth = current.width;
  let nextHeight = current.height;
  if (west) {
    const clampedDx = Math.min(dx, current.width - minWidth);
    nextLeft = current.x + clampedDx;
    nextWidth = current.width - clampedDx;
  }
  if (east) nextWidth = Math.max(minWidth, current.width + dx);
  if (north) {
    const clampedDy = Math.min(dy, current.height - minHeight);
    nextTop = current.y + clampedDy;
    nextHeight = current.height - clampedDy;
  }
  if (south) nextHeight = Math.max(minHeight, current.height + dy);
  const geometry = { x: nextLeft, y: nextTop, width: nextWidth, height: nextHeight };
  if (ledgerAnnotation) patchLedgerAnnotationGeometry(ledgerAnnotation, geometry);
  if (zone) patchZoneBox(zone, geometry);
  renderZoneLabelOverlay();
  renderCanvasControlOverlay();
  telemetry(isGroup ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
}

function resolveCurrentZoneNode(id: string, kind: 'zone' | 'group', savedZone: HTMLElement | null): HTMLElement | null {
  if (!id) return savedZone;
  const savedId = kind === 'group' ? savedZone?.dataset.groupId : savedZone?.dataset.zoneId;
  if (savedId === id && savedZone?.isConnected !== false) return savedZone;
  const attribute = kind === 'group' ? 'data-group-id' : 'data-zone-id';
  return document.querySelector(`[${attribute}="${cssEscape(id)}"]`) as HTMLElement | null;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

function patchZoneBox(zone: HTMLElement, geometry: LedgerGeometry): void {
  const renderedGeometry = state.activeLedger ? renderGeometry(geometry) : geometry;
  zone.style.left = `${renderedGeometry.x}px`;
  zone.style.top = `${renderedGeometry.y}px`;
  zone.style.width = `${renderedGeometry.width}px`;
  zone.style.height = `${renderedGeometry.height}px`;
  zone.style.minHeight = `${renderedGeometry.height}px`;
}
frontend/src/runtime/selection/effect/move-selected.ts:2:import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
frontend/src/runtime/selection/effect/move-selected.ts:3:import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
frontend/src/runtime/selection/effect/move-selected.ts:4:import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
frontend/src/runtime/selection/effect/move-selected.ts:64:    renderZoneLabelOverlay();
frontend/src/runtime/selection/effect/move-selected.ts:65:    renderRelationshipOverlay();
frontend/src/runtime/selection/effect/move-selected.ts:66:    renderCanvasControlOverlay();
frontend/src/runtime/selection/effect/render-selection-state.ts:3:import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
frontend/src/runtime/selection/effect/render-selection-state.ts:20:  renderCanvasControlOverlay();
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:6:import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:10:import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:14:import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:23:  renderZoneLabelOverlay();
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:24:  renderRelationshipOverlay();
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:26:  renderCanvasControlOverlay();
frontend/src/runtime/zone/effect/begin-zone-label-edit.ts:3:import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
frontend/src/runtime/zone/effect/begin-zone-label-edit.ts:14:  renderZoneLabelOverlay();
frontend/src/runtime/zone/effect/begin-zone-label-edit.ts:31:    renderZoneLabelOverlay();
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:5:import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:17:  renderZoneLabelOverlay();
frontend/src/runtime/canvas/effect/apply-viewport-transform.ts:3:import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';
frontend/src/runtime/canvas/effect/apply-viewport-transform.ts:31:  renderCanvasControlOverlay();
frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts:9:import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts:11:import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts:49:      renderZoneLabelOverlay();
frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts:50:      renderRelationshipOverlay();
frontend/src/runtime/zone/effect/resize-selected-zone.ts:2:import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
frontend/src/runtime/zone/effect/resize-selected-zone.ts:3:import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
frontend/src/runtime/zone/effect/resize-selected-zone.ts:46:  renderZoneLabelOverlay();
frontend/src/runtime/zone/effect/resize-selected-zone.ts:47:  renderCanvasControlOverlay();
frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:4:export function renderZoneLabelOverlay(): void {
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:207:export function renderCanvasControlOverlay(): void {
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:254:    renderCanvasControlOverlay();
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:267:      renderCanvasControlOverlay();
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:11:export function renderRelationshipOverlay(): void {
frontend/src/runtime/card/effect/resize-selected-card.ts:1:import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
frontend/src/runtime/card/effect/resize-selected-card.ts:2:import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
frontend/src/runtime/card/effect/resize-selected-card.ts:44:  renderRelationshipOverlay();
frontend/src/runtime/card/effect/resize-selected-card.ts:45:  renderCanvasControlOverlay();
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:5:import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:8:import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:259:  renderRelationshipOverlay();
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:260:  if (Object.keys(result.zones).length > 0) renderZoneLabelOverlay();
frontend/src/runtime/gesture/effect/finish-pointer.ts:3:import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
frontend/src/runtime/gesture/effect/finish-pointer.ts:10:  if (pointerSession?.intent === 'pan') renderCanvasControlOverlay();
frontend/src/runtime/card/helper/card-has-agent-last-answer.ts
frontend/src/runtime/card/helper/resolve-card-work-status.ts
frontend/src/runtime/card/helper/resolve-card-y-overlap.ts
frontend/src/runtime/card/helper/visible-ledger-cards.ts
frontend/src/runtime/gesture/controller/handle-native-drag-start.ts
frontend/src/runtime/gesture/controller/handle-pointer-down.ts
frontend/src/runtime/gesture/controller/handle-pointer-move.ts
frontend/src/runtime/gesture/controller/handle-pointer-up.ts
frontend/src/runtime/gesture/controller/handle-wheel.ts
frontend/src/runtime/gesture/effect/emit-pan-performance-telemetry.ts
frontend/src/runtime/gesture/effect/finish-pointer.ts
frontend/src/runtime/gesture/effect/schedule-panning-effects.ts
frontend/src/runtime/gesture/helper/click-movement.ts
frontend/src/runtime/gesture/helper/derive-pointer-intent.ts
frontend/src/runtime/gesture/helper/is-gesture-control-target.ts
frontend/src/runtime/gesture/helper/point.ts
frontend/src/runtime/gesture/helper/should-capture-wheel-target.ts
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
frontend/src/runtime/ledger/helper/active-ledgers.ts
frontend/src/runtime/ledger/helper/card-fields.ts
frontend/src/runtime/ledger/helper/card-labels.ts
frontend/src/runtime/ledger/helper/create-ledger-group-annotation.ts
frontend/src/runtime/ledger/helper/create-ledger-object-id.ts
frontend/src/runtime/ledger/helper/create-ledger-zone-annotation.ts
frontend/src/runtime/ledger/helper/highlight-ledger-code.ts
frontend/src/runtime/ledger/helper/is-ledger-markdown-table-divider.ts
frontend/src/runtime/ledger/helper/ledger-card-body.ts
frontend/src/runtime/ledger/helper/ledger-endpoint-for-tab.ts
frontend/src/runtime/ledger/helper/merge-local-canvas-state.ts
frontend/src/runtime/ledger/helper/merge-local-thread-notes.ts
frontend/src/runtime/ledger/helper/min-scale-centered-ledger-viewport.ts
frontend/src/runtime/ledger/helper/normalize-deleted-note-ids.ts
frontend/src/runtime/ledger/helper/normalize-ledger-markdown.ts
frontend/src/runtime/ledger/helper/normalize-ledger-notes.ts
frontend/src/runtime/ledger/helper/parse-ledger-card-markdown.ts
frontend/src/runtime/ledger/helper/parse-ledger-markdown-inline.ts
frontend/src/runtime/ledger/helper/parse-ledger-markdown-table-row.ts
frontend/src/runtime/ledger/helper/persist-ledger-card-media-carousel.ts
frontend/src/runtime/ledger/helper/resolve-ledger-card-zone.ts
frontend/src/runtime/ledger/helper/resolve-overview-target-ledger.ts
frontend/src/runtime/ledger/helper/sync-ledger-card-media-layout.ts
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts
frontend/src/runtime/selection/controller/select-target.ts
frontend/src/runtime/selection/effect/move-selected.ts
frontend/src/runtime/selection/effect/render-selection-state.ts
frontend/src/runtime/selection/effect/select-intersecting.ts
frontend/src/runtime/selection/helper/elements-intersecting-box.ts
frontend/src/runtime/selection/helper/elements-intersecting-canvas-rect.ts
frontend/src/runtime/selection/helper/selection-has-target.ts
frontend/src/runtime/selection/helper/selection-includes-target.ts
frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts
frontend/src/runtime/zone/helper/cards-intersecting-zone.ts
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-14","timestamp":"2026-07-10T04:36:38.892Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"14","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783611516537-418c85ec.md\nsed -n '1,300p' .decision-os/cards/bugs/card-codex-skill-1783611210436-8e41c0b2.md\nfor f in frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts; do echo \\\"FILE \"'$f\"; sed -n '\"'1,8p' \\\"\"'$f\"; done'"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783611516537-418c85ec.md
sed -n '1,300p' .decision-os/cards/bugs/card-codex-skill-1783611210436-8e41c0b2.md
for f in frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts; do echo \"FILE "'$f"; sed -n '"'1,8p' \""'$f"; done'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-15","timestamp":"2026-07-10T04:36:38.892Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"15","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783611516537-418c85ec.md\nsed -n '1,300p' .decision-os/cards/bugs/card-codex-skill-1783611210436-8e41c0b2.md\nfor f in frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts; do echo \\\"FILE \"'$f\"; sed -n '\"'1,8p' \\\"\"'$f\"; done'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783611516537-418c85ec.md
sed -n '1,300p' .decision-os/cards/bugs/card-codex-skill-1783611210436-8e41c0b2.md
for f in frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts; do echo \"FILE "'$f"; sed -n '"'1,8p' \""'$f"; done'`
Status: completed
Exit code: 0

````text
## A. Dependency Graph

1. **Graph.** The edges below seed the source `depends_on` values, then add codebase-proven collision edges.

| from_task | to_task | edge_type | reason | evidence |
| --- | --- | --- | --- | --- |
| T01 | T02 | `hard-blocker` | T02 needs the pointer-session selection snapshot created by T01 before movement can use a stable operand. | Source `T02.depends_on=T01`; `handle-pointer-down.ts:32` creates `state.pointer`; `move-selected.ts:26-45` currently reads live `state.selection`. |
| T01 | T03 | `hard-blocker` | T03 commits gesture identity from the pointer snapshot created by T01. | Source `T03.depends_on=T01`; `handle-pointer-up.ts:27-83` keeps `pointerSession` through release; `commit-selected-ledger-geometry.ts:5-10` currently commits without a snapshot argument. |
| T02 | T03 | `hard-blocker` | Commit must match the same explicit selection used for movement. | Source `T03.depends_on=T02`; `handle-pointer-up.ts:76` applies final movement, then `handle-pointer-up.ts:83` commits geometry. |
| T01 | T04 | `hard-blocker` | T04 resolves resize targets from pointer identity, which is extended by T01. | Source `T04.depends_on=T01`; `resize-selected-card.ts:9-14` and `resize-selected-zone.ts:9-16` read `state.pointer.target` and `state.pointer.resizeHandle`. |
| T01 | T06 | `hard-blocker` | T06 preserves active pointer intent through refresh by reading the snapshot created by T01. | Source `T06.depends_on=T01`; `refresh-runtime-state.ts:28-30` clears selection then reloads; `load-active-ledger-state.ts:43` clears selection. |
| T05 | T06 | `hard-blocker` | T06 restores active pointer selection after the same-ledger load behavior from T05 exists. | Source `T06.depends_on=T05`; `load-active-ledger-state.ts:33-43` already detects same-ledger viewport continuity before clearing selection. |
| T05 | T07 | `hard-blocker` | T07 changes thread refresh restoration on top of the selection preservation behavior from T05. | Source `T07.depends_on=T05`; `subscribe-ledger-content-events.ts:119-123` captures and restores `state.selection` around `loadActiveLedgerState()`. |
| T03 | T04 | `shared-file-risk` | Commit payload changes and resize-by-id changes both touch ledger geometry helpers. | `active-ledger-geometry.ts:55-75` owns active maps; `active-ledger-geometry.ts:109-134` owns selected geometry payload. |
| T04 | T05 | `shared-file-risk` | Resize target lookup and selection pruning both depend on active card and annotation maps. | Source targets for T04 and T05 include `activeLedgerCardMap()` and `activeLedgerAnnotationMap()` in `active-ledger-geometry.ts:55-75`. |
| T06 | T07 | `shared-file-risk` | Ledger refresh pointer protection and thread refresh freshness both edit the same refresh module and `state.selection` restoration path. | `subscribe-ledger-content-events.ts:97-128` contains both `reloadLedgerContent()` and `reloadThreadContent()`. |
| T01 | T08 | `test-order-risk` | Runtime race tests need pointer snapshot behavior before assertions can pass. | Source `T08.depends_on=T01`; T08 targets `handlePointerDown()`, `handlePointerMove()`, and `handlePointerUp()`. |
| T02 | T08 | `test-order-risk` | Runtime drag tests need explicit movement selection before refresh race assertions can pass. | Source `T08.depends_on=T02`; `handle-pointer-move.ts:45` currently calls `moveSelected(...)` without an explicit selection. |
| T03 | T08 | `test-order-risk` | Runtime fetch payload assertions need explicit commit selection before passing. | Source `T08.depends_on=T03`; `commit-selected-ledger-geometry.ts:7-10` builds the committed `patch-geometry` payload. |
| T04 | T08 | `test-order-risk` | Resize remount tests need resize-by-pointer-id implementation before passing. | Source `T08.depends_on=T04`; `resize-selected-card.ts:9-42` and `resize-selected-zone.ts:9-44` update target geometry. |
| T06 | T08 | `test-order-risk` | Multi-selection refresh race tests need pointer protection during refresh before passing. | Source `T08.depends_on=T06`; `requestLedgerContentRefresh()` calls `reloadLedgerContent()` in `subscribe-ledger-content-events.ts:130-137`. |
| T05 | T09 | `test-order-risk` | Selection preservation tests need same-ledger pruning before passing. | Source `T09.depends_on=T05`; `load-active-ledger-state.ts:43` currently clears all selection. |
| T07 | T09 | `test-order-risk` | Thread freshness tests need stale restore prevention before passing. | Source `T09.depends_on=T07`; `subscribe-ledger-content-events.ts:119-123` restores a captured selection after awaited load. |
| T05 | T10 | `test-order-risk` | Pan and wheel refresh tests need same-ledger selection preservation behavior. | Source `T10.depends_on=T05`; `refreshRuntimeState()` calls `loadActiveLedgerState()` after clearing selection in `refresh-runtime-state.ts:28-30`. |
| T06 | T10 | `test-order-risk` | Active pan refresh tests need pointer-session preservation during manual refresh. | Source `T10.depends_on=T06`; `handle-pointer-move.ts:34-41` continues pan from `state.pointer`. |
| T08 | T09 | `shared-file-risk` | Both test tasks edit the same active-ledger runtime integration file. | T08 and T09 target `frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts`. |
| T01 | T12 | `test-order-risk` | Browser drag-refresh proof needs pointer snapshot behavior before it can prove stable target identity. | Source `T12.depends_on=T01`; current browser spec only calls `assertFrontendSpec()` in `tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:6-10`. |
| T02 | T12 | `test-order-risk` | Browser proof needs movement to use pointer-session selection. | Source `T12.depends_on=T02`; `move-selected.ts:9-20` owns drag movement effects. |
| T03 | T12 | `test-order-risk` | Browser proof asserts final `patch-geometry` target id, which is owned by T03 commit changes. | Source `T12.depends_on=T03`; `commit-selected-ledger-geometry.ts:7-10` sends geometry through `commitActiveLedgerMutation()`. |
| T06 | T12 | `test-order-risk` | Browser proof triggers refresh while pointer is down, which needs T06 refresh protection. | Source `T12.depends_on=T06`; `refreshRuntimeState()` reloads and rerenders in `refresh-runtime-state.ts:12-35`. |
| T11 | T12 | `hard-blocker` | T12 needs the browser automation package added by T11 to import successfully under `npm run test:browser`. | Source `T12.depends_on=T11`; root `package.json:17` defines `test:browser`; root `package.json:26` has empty `devDependencies`. |
| T08 | T13 | `test-order-risk` | Focused verification must wait for runtime drag and resize race tests to exist. | Source `T13.depends_on=T08`. |
| T09 | T13 | `test-order-risk` | Focused verification must wait for selection preservation and thread freshness tests to exist. | Source `T13.depends_on=T09`. |
| T10 | T13 | `test-order-risk` | Focused verification must wait for pan and wheel refresh race tests to exist. | Source `T13.depends_on=T10`. |
| T12 | T13 | `test-order-risk` | Focused verification must wait for the browser interaction race spec to replace the token check. | Source `T13.depends_on=T12`. |

---

## B. Independent Task Groups

1. **Groups.** Every task is placed exactly once.

| group_id | task_ids | target_files | target_symbols | independence_reason | dispatch_notes |
| --- | --- | --- | --- | --- | --- |
| G01 | `T01`, `T02`, `T03`, `T04`, `T05`, `T06`, `T07` | `frontend/src/runtime/state.ts`; `frontend/src/runtime/gesture/controller/handle-pointer-down.ts`; `frontend/src/runtime/selection/effect/move-selected.ts`; `frontend/src/runtime/gesture/controller/handle-pointer-move.ts`; `frontend/src/runtime/gesture/controller/handle-pointer-up.ts`; `frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts`; `frontend/src/runtime/ledger/helper/active-ledger-geometry.ts`; `frontend/src/runtime/card/effect/resize-selected-card.ts`; `frontend/src/runtime/zone/effect/resize-selected-zone.ts`; `frontend/src/runtime/ledger/effect/load-active-ledger-state.ts`; `frontend/src/runtime/refresh/controller/refresh-runtime-state.ts`; `frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts` | `state.pointer.selectionSnapshot`; `handlePointerDown()`; `moveSelected()`; `commitSelectedLedgerGeometry()`; `selectedLedgerGeometryPayload()`; `resizeSelectedCard()`; `resizeSelectedZone()`; `loadActiveLedgerState()`; `refreshRuntimeState()`; `reloadLedgerContent()`; `reloadThreadContent()` | Runtime implementation shares `state.selection`, `state.pointer`, active ledger geometry helpers, gesture controllers, and refresh loaders. Keeping this together avoids competing edits to the same pointer and selection contract. | Build the pointer snapshot contract first, then update movement, commit, resize target resolution, same-ledger pruning, active refresh restore, and thread freshness as one runtime behavior set. |
| G02 | `T11` | `package.json`; root `package-lock.json` | `devDependencies`; `scripts.test:browser` | Browser dependency metadata does not touch runtime implementation files. | Root `package-lock.json` is absent from `rg --files`; T11 owns package metadata and any generated root lockfile for the new dev dependency. |
| G03 | `T08`, `T09`, `T10` | `frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts`; `frontend/test/runtime/drag-release-freeze.integration.test.ts`; `frontend/test/runtime/ledger-content-refresh.integration.test.ts`; `frontend/test/runtime/canvas-pan-performance.integration.test.ts` | `loadActiveLedgerState()`; `requestLedgerContentRefresh()`; `requestThreadContentRefresh()`; `handlePointerDown()`; `handlePointerMove()`; `handlePointerUp()`; `refreshRuntimeState()`; `handleWheel()`; `scheduleViewportPersistence()` | Runtime race tests consume G01 behavior and share fake DOM, fetch stubs, active ledger setup, and selection fixtures. | Add these tests after G01 so assertions target the final snapshot, pruning, refresh, resize, pan, and wheel contracts. |
| G04 | `T12` | `tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts` | `assertFrontendSpec()`; `[data-action="refresh"]`; `data-card-id`; `patch-geometry` | Browser interaction proof consumes G01 runtime behavior and G02 browser dependency, while leaving runtime test files untouched. | Replace the current `assertFrontendSpec()` token check with the real drag-refresh-release interaction. |
| G05 | `T13` | Focused runtime test files; browser refresh spec; `package.json` | `node --test`; `npm run test:browser`; `npm run typecheck:frontend` | Verification runs after implementation and test assets are in place. | Run the focused runtime command, browser command, and frontend typecheck after G03 and G04 are complete. |

---

## C. Sequential Gates

1. **G01 -> G03.** G03 can start after runtime code exposes stable pointer snapshots, explicit movement and commit selection, resize target-by-id resolution, same-ledger selection pruning, active refresh restore, and thread freshness behavior.
2. **G02 -> G04.** G04 can start after the browser automation dependency resolves under root `npm run test:browser`.
3. **G01 -> G04.** G04 can assert the browser drag-refresh race after runtime refresh no longer changes the active drag operand.
4. **G03 -> G05.** G05 can run focused runtime verification after runtime race tests are added.
5. **G04 -> G05.** G05 can run browser verification after the browser interaction race replaces the source-token check.

---

## D. Collision Risks

1. **Runtime state.** `state.selection`, `state.pointer`, `state.pointer.selectionSnapshot`, `state.activeLedger`, and `state.activeLedgerId` are shared by `T01` through `T07`.
2. **Gesture controllers.** `handle-pointer-down.ts`, `handle-pointer-move.ts`, and `handle-pointer-up.ts` connect pointer identity, movement, resize, final release deltas, and geometry commit.
3. **Ledger geometry helper.** `active-ledger-geometry.ts` is shared by explicit movement selection, commit payload selection, resize target lookup, and same-ledger selection pruning.
4. **Refresh modules.** `load-active-ledger-state.ts`, `refresh-runtime-state.ts`, and `subscribe-ledger-content-events.ts` share the same visible selection and active pointer preservation contract.
5. **Runtime tests.** `active-ledger-zone-lifecycle.integration.test.ts` is shared by `T08` and `T09`; `ledger-content-refresh.integration.test.ts` is shared by thread and ledger refresh assertions.
6. **Browser package metadata.** Root `package.json` has empty `devDependencies` and the root lockfile is absent; `T11` owns this metadata surface before `T12` imports browser automation.

---

## E. Ambiguities

1. **None.** No operator answer blocks reliable grouping; the missing root `package-lock.json` is a `T11` dispatch detail.

---

## F. Readiness

1. **Status.** The dependency graph and implementation groups are ready for `task-group-completeness`.

`READY_FOR_TASK_GROUP_COMPLETENESS`
---

Codex run completed: exit code 0
## A. Task Inventory

1. **Inventory.** The tasks below are grounded in the inspected runtime files, test files, browser spec file, and package metadata.

| id | type | title | target_files | target_symbols | action | done_when | depends_on |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | code | Capture the active gesture selection snapshot | `frontend/src/runtime/gesture/controller/handle-pointer-down.ts`, `frontend/src/runtime/state.ts` | `handlePointerDown()`, `state.pointer.selectionSnapshot` | After `selectTarget()` runs for `drag`, `group`, and `resize`, store cloned `cardIds`, `zoneIds`, `groupIds`, `targetKind`, `targetId`, and `ledgerStateId` on the pointer session. | A pointer session owns a cloned selection snapshot, and later writes to `state.selection` do not mutate that snapshot. | `-` |
| T02 | code | Move the explicit gesture selection | `frontend/src/runtime/selection/effect/move-selected.ts`, `frontend/src/runtime/gesture/controller/handle-pointer-move.ts`, `frontend/src/runtime/gesture/controller/handle-pointer-up.ts` | `moveSelected()`, `moveSelectedLedgerGeometry()`, `moveSelectedDomGeometry()`, `handlePointerMove()`, `handlePointerUp()` | Add an explicit selection parameter to `moveSelected()`, default it to `state.selection`, use it for ledger geometry patches, DOM queries, telemetry payloads, zone labels, relationship overlays, and canvas controls, then pass `state.pointer.selectionSnapshot` for active drag and group movement. | A selection change between `pointerdown` and `pointermove` leaves movement applied only to ids from the pointer snapshot. | `T01` |
| T03 | code | Commit the explicit gesture selection | `frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts`, `frontend/src/runtime/ledger/helper/active-ledger-geometry.ts`, `frontend/src/runtime/gesture/controller/handle-pointer-up.ts` | `commitSelectedLedgerGeometry()`, `selectedLedgerGeometryPayload()`, `handlePointerUp()` | Add an explicit selection argument to `commitSelectedLedgerGeometry()`, pass it to `selectedLedgerGeometryPayload(selection)`, and call it with `pointerSession.selectionSnapshot` for drag, group, and resize releases. | The `patch-geometry` request contains only the ids from the pointer snapshot when visible selection changes during the gesture. | `T01`, `T02` |
| T04 | code | Resolve remounted resize targets by pointer id | `frontend/src/runtime/card/effect/resize-selected-card.ts`, `frontend/src/runtime/zone/effect/resize-selected-zone.ts`, `frontend/src/runtime/ledger/helper/active-ledger-geometry.ts` | `resizeSelectedCard()`, `resizeSelectedZone()`, `activeLedgerCardMap()`, `activeLedgerAnnotationMap()` | Read the resize target id from `state.pointer.targetId`, resolve the current DOM node when the saved target is missing, detached, stale, and id-mismatched, and patch active ledger card, zone, and group geometry by id. | A resize session that crosses `renderCanvasSurface()` still updates the intended ledger record and current DOM node. | `T01` |
| T05 | code | Preserve and prune same-ledger selection | `frontend/src/runtime/ledger/effect/load-active-ledger-state.ts`, `frontend/src/runtime/ledger/helper/active-ledger-geometry.ts` | `loadActiveLedgerState()`, `state.selection`, `activeLedgerCardMap()`, `activeLedgerAnnotationMap()` | Replace the unconditional selection clear with same-ledger selection pruning against refreshed card and annotation ids, while keeping route changes and ledger changes as selection-clearing paths. | A same-ledger load keeps selected ids that still exist, removes missing ids, and a different ledger load clears all selected ids. | `-` |
| T06 | code | Protect active pointer selection during refresh | `frontend/src/runtime/ledger/effect/load-active-ledger-state.ts`, `frontend/src/runtime/refresh/controller/refresh-runtime-state.ts`, `frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts` | `loadActiveLedgerState()`, `refreshRuntimeState()`, `reloadLedgerContent()`, `state.pointer.selectionSnapshot` | When `state.pointer` is active, keep `state.pointer.selectionSnapshot` unchanged and restore visible `state.selection` from that snapshot after same-ledger load, manual refresh, and ledger content refresh complete. | An active pointer session survives `loadActiveLedgerState()`, `requestLedgerContentRefresh()`, and `refreshRuntimeState()` with the same pointer intent, target id, and visible selection snapshot. | `T01`, `T05` |
| T07 | code | Prevent stale thread refresh selection restore | `frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts` | `reloadThreadContent()`, `requestThreadContentRefresh()`, `state.selection` | Clone the captured selection at thread refresh start and restore it only when no pointer session is active and current visible selection still equals the captured selection after the awaited ledger load. | If thread refresh starts with `card-a` selected and the operator selects `card-b` before the load resolves, final `state.selection.cardIds` remains `['card-b']`. | `T05` |
| T08 | test | Add drag, multi-selection, and resize refresh race tests | `frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts`, `frontend/test/runtime/drag-release-freeze.integration.test.ts` | `loadActiveLedgerState()`, `requestLedgerContentRefresh()`, `handlePointerDown()`, `handlePointerMove()`, `handlePointerUp()` | Add interaction-style runtime tests for active card drag plus same-ledger load, multi-selection drag plus content refresh, and resize plus canvas remount, using fake DOM and fetch payload assertions. | The tests fail against live `state.selection` movement and pass when movement, resize, and commit use pointer-session identity. | `T01`, `T02`, `T03`, `T04`, `T06` |
| T09 | test | Add selection preservation and thread freshness tests | `frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts`, `frontend/test/runtime/ledger-content-refresh.integration.test.ts` | `loadActiveLedgerState()`, `requestThreadContentRefresh()`, `state.selection` | Extend runtime tests so same-ledger load preserves and prunes selection, and async thread refresh keeps a newer selection made while the load is in flight. | Test output proves same-ledger selection pruning and proves newer operator selection wins over a stale thread refresh snapshot. | `T05`, `T07` |
| T10 | test | Add pan and wheel refresh race tests | `frontend/test/runtime/canvas-pan-performance.integration.test.ts` | `handlePointerMove()`, `handlePointerUp()`, `refreshRuntimeState()`, `handleWheel()`, `scheduleViewportPersistence()` | Add runtime tests for manual refresh during active pan and for real `handleWheel()` zoom racing same-ledger refresh plus delayed viewport persistence. | Tests prove `state.pointer.intent === 'pan'` survives manual refresh, pan deltas continue from current pointer coordinates, pointer up finishes cleanly, and wheel zoom leaves latest viewport in memory and `localStorage`. | `T05`, `T06` |
| T11 | config | Add browser automation dependency for the refresh proof | `package.json`, `package-lock.json` | `devDependencies`, `scripts.test:browser` | Add the root browser automation dependency needed by `tests/browser/**/*.spec.ts` while keeping `npm run test:browser` compatible with `node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs`. | The refresh browser spec can import the browser automation package under the documented browser command without a module resolution failure. | `-` |
| T12 | test | Replace the refresh browser source-token check with an interaction race | `tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts` | `assertFrontendSpec()`, `data-action="refresh"`, `data-card-id`, `patch-geometry` | Replace the `assertFrontendSpec()` call with a browser test that starts the decision-os server, opens `/specs`, begins a card drag, triggers refresh through `[data-action="refresh"]` while the pointer is down, continues movement, releases, and asserts the final geometry target id. | The browser spec fails when refresh changes the active drag operand and passes only when the dragged card id remains the committed geometry id. | `T01`, `T02`, `T03`, `T06`, `T11` |
| T13 | ops | Run focused verification commands | `frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts`, `frontend/test/runtime/ledger-content-refresh.integration.test.ts`, `frontend/test/runtime/canvas-pan-performance.integration.test.ts`, `frontend/test/runtime/drag-release-freeze.integration.test.ts`, `tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts`, `package.json` | `node --test`, `npm run typecheck:frontend` | Run the focused runtime command, the refresh browser command, and `npm run typecheck:frontend` after implementation. | All three commands exit `0`, and failures include no refresh interaction regressions. | `T08`, `T09`, `T10`, `T12` |

---

## B. Open Questions

1. **None.** No operator answer blocks this codebase-linked task list.

---

## C. Readiness

1. **Status.** `READY_FOR_TASK_DEPENDENCY`

READY_FOR_TASK_DEPENDENCY
---

Codex run completed: exit code 0
FILE frontend/src/runtime/state.ts
export type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };

export type PointerSelectionSnapshot = SelectionState & {
  targetKind: string;
  targetId: string;
  ledgerStateId: string;
};

FILE frontend/src/runtime/gesture/controller/handle-pointer-down.ts
/**
 * WHAT: Starts canvas pointer gestures and resolves their target intent.
 * WHY: Drag, pan, resize, draw, and edit control flow must share one canonical pointer entrypoint.
 */
import { canvas } from '../../dom.js';
import { createPointerSelectionSnapshot, state } from '../../state.js';
import { derivePointerIntent, isForcedPanPointer } from '../helper/derive-pointer-intent.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
FILE frontend/src/runtime/gesture/controller/handle-pointer-move.ts
/**
 * WHAT: Applies active pointer gesture movement to the canvas runtime.
 * WHY: Pan must stay transform-only while drag, resize, and draw paths update their owned geometry.
 */
import { state } from '../../state.js';
import { applyViewportTransform } from '../../canvas/effect/apply-viewport-transform.js';
import { applyPanViewportTransform } from '../../canvas/effect/apply-pan-viewport-transform.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
FILE frontend/src/runtime/gesture/controller/handle-pointer-up.ts
/**
 * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.
 * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.
 */
import { state } from '../../state.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { createCardController } from '../../card/controller/create-card-controller.js';
import { createZoneController } from '../../zone/controller/create-zone-controller.js';
FILE frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
import { state, type SelectionState } from '../../state.js';
import { commitActiveLedgerMutation } from './commit-active-ledger-mutation.js';
import { selectedLedgerGeometryPayload } from '../helper/active-ledger-geometry.js';

export async function commitSelectedLedgerGeometry(selection: Partial<SelectionState> = state.selection): Promise<boolean> {
  if (!state.activeLedger) return false;
  const geometry = selectedLedgerGeometryPayload(selection);
  const hasGeometry = Object.values(geometry).some((records) => Object.keys(records).length > 0);
FILE frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
/**
 * WHAT: Loads the active route ledger from the backend.
 * WHY: Server ledgers are authoritative, while optimistic thread notes must survive stale refreshes.
 */
import { emptySelectionState, restoreSelectionFromPointerSnapshot, state } from '../../state.js';
import { pruneSelectionToActiveLedger } from '../helper/active-ledger-geometry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import { mergeLocalCanvasStateIntoLedger } from '../helper/merge-local-canvas-state.js';
FILE frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
import { cloneSelectionState, state, type SelectionState } from '../../state.js';

export type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type LedgerGeometry = { x: number; y: number; width: number; height: number };

type LedgerRecord = Record<string, unknown>;

function finiteNumber(value: unknown, fallback: number): number {
FILE frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
import { state } from '../../state.js';
import { hydratePersistedGeometry } from '../../persistence/effect/hydrate-persisted-geometry.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { readPersistedState } from '../../persistence/helper/read-persisted-state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { routeCanvasMode } from '../../navigation/helper/route-canvas-mode.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
FILE frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
/**
 * WHAT: Subscribes to backend card content file change events.
 * WHY: direct Markdown file patches must refresh rendered card content without disturbing active voice recording.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resizeSelectedCardsToContent } from '../../card/effect/resize-selected-cards-to-content.js';
import { resumeExternallyStartedCardSkillRun } from '../../codex/effect/poll-card-skill-run.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
FILE frontend/src/runtime/selection/effect/move-selected.ts
import { cloneSelectionState, state, type SelectionState } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, patchLedgerAnnotationGeometry, patchLedgerCardGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

FILE frontend/src/runtime/card/effect/resize-selected-card.ts
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerCardMap, ledgerCardGeometry, patchLedgerCardGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function resizeSelectedCard(dx: number, dy: number): void {
FILE frontend/src/runtime/zone/effect/resize-selected-zone.ts
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, ledgerAnnotationGeometry, patchLedgerAnnotationGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function resizeSelectedZone(dx: number, dy: number): void {
FILE frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

test('specs and data ledger tabs commit canvas mutations through the server ledger endpoint', async () => {
  (globalThis as any).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
FILE frontend/test/runtime/canvas-pan-performance.integration.test.ts
/**
 * WHAT: Runtime tests for transform-only canvas pan performance.
 * WHY: Canvas pan should not pay scale/detail-mode or unsampled telemetry costs on every pointermove.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePointerIntent, ctrlPanOnlySpec } from '../../src/runtime/gesture/helper/derive-pointer-intent.js';
FILE frontend/test/runtime/drag-release-freeze.integration.test.ts
/**
 * WHAT: Regression coverage for card drag release while the geometry commit is still in flight.
 * WHY: Releasing the pointer must freeze the card at the release coordinate, not at a later cursor move.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

type FakeElement = {
FILE frontend/test/runtime/ledger-content-refresh.integration.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state } from '../../src/runtime/state.js';

function source(path: string): string {
  const file = resolve(process.cwd(), path);
FILE tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
/**
 * WHAT: Browser interaction proof for spec 9d1b7c36: The refresh system preserves canvas continuity during operator work.
 * WHY: Refresh during an active drag must not change the card id committed on release.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-16","timestamp":"2026-07-10T04:36:56.526Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"16","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_8","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"function cssEscape|CSS\\\\.escape|isConnected \"'!== false|resolveCurrent.*Node|selectionStatesEqual|cloneSelectionState|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|PointerSelectionSnapshot|SelectionState\" frontend/src frontend/test tests | head -240\nsed -n '\"'1,340p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\nsed -n '1,180p' frontend/src/runtime/relationship/effect/render-relationship-overlay.ts\nsed -n '1,180p' frontend/src/runtime/zone/effect/render-zone-label-overlay.ts\nsed -n '1,160p' frontend/src/runtime/selection/effect/render-selection-state.ts\nsed -n '1,140p' frontend/src/runtime/gesture/controller/handle-pointer-down.ts\nsed -n '1,150p' frontend/src/runtime/gesture/controller/handle-pointer-up.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"function cssEscape|CSS\\.escape|isConnected "'!== false|resolveCurrent.*Node|selectionStatesEqual|cloneSelectionState|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|PointerSelectionSnapshot|SelectionState" frontend/src frontend/test tests | head -240
sed -n '"'1,340p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
sed -n '1,180p' frontend/src/runtime/relationship/effect/render-relationship-overlay.ts
sed -n '1,180p' frontend/src/runtime/zone/effect/render-zone-label-overlay.ts
sed -n '1,160p' frontend/src/runtime/selection/effect/render-selection-state.ts
sed -n '1,140p' frontend/src/runtime/gesture/controller/handle-pointer-down.ts
sed -n '1,150p' frontend/src/runtime/gesture/controller/handle-pointer-up.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-17","timestamp":"2026-07-10T04:36:56.526Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"17","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_8","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"function cssEscape|CSS\\\\.escape|isConnected \"'!== false|resolveCurrent.*Node|selectionStatesEqual|cloneSelectionState|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|PointerSelectionSnapshot|SelectionState\" frontend/src frontend/test tests | head -240\nsed -n '\"'1,340p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\nsed -n '1,180p' frontend/src/runtime/relationship/effect/render-relationship-overlay.ts\nsed -n '1,180p' frontend/src/runtime/zone/effect/render-zone-label-overlay.ts\nsed -n '1,160p' frontend/src/runtime/selection/effect/render-selection-state.ts\nsed -n '1,140p' frontend/src/runtime/gesture/controller/handle-pointer-down.ts\nsed -n '1,150p' frontend/src/runtime/gesture/controller/handle-pointer-up.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"function cssEscape|CSS\\.escape|isConnected "'!== false|resolveCurrent.*Node|selectionStatesEqual|cloneSelectionState|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|PointerSelectionSnapshot|SelectionState" frontend/src frontend/test tests | head -240
sed -n '"'1,340p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
sed -n '1,180p' frontend/src/runtime/relationship/effect/render-relationship-overlay.ts
sed -n '1,180p' frontend/src/runtime/zone/effect/render-zone-label-overlay.ts
sed -n '1,160p' frontend/src/runtime/selection/effect/render-selection-state.ts
sed -n '1,140p' frontend/src/runtime/gesture/controller/handle-pointer-down.ts
sed -n '1,150p' frontend/src/runtime/gesture/controller/handle-pointer-up.ts"`
Status: completed
Exit code: 0

````text
frontend/test/runtime/selection-direct-card-click.integration.test.ts:31:  assert.match(selectTarget, /renderSelectionState\(\)/);
frontend/test/runtime/canvas-pan-performance.integration.test.ts:613:  assert.match(pointerDown, /renderSelectionState\(\)/);
frontend/test/runtime/canvas-pan-performance.integration.test.ts:766:  assert.match(scheduler, /if \(densityChanged\) \{[\s\S]*clearViewportCardDetails\(\);[\s\S]*renderLedgerSurface\(\);[\s\S]*renderSelectionState\(\);[\s\S]*renderZoneLabelOverlay\(\);[\s\S]*renderRelationshipOverlay\(\);[\s\S]*\}/);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:281:  assert.match(refresh, /const selection = cloneSelectionState\(state\.selection\)/);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:282:  assert.match(refresh, /selectionStatesEqual\(state\.selection, selection\)/);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:283:  assert.match(refresh, /state\.selection = cloneSelectionState\(selection\)/);
frontend/src/runtime/thread/helper/resolve-thread-target-title.ts:8:  const escapedThreadId = globalThis.CSS?.escape ? CSS.escape(threadId) : threadId.replace(/["\\]/g, '\\$&');
frontend/src/runtime/input/controller/handle-region-color-input.ts:7:    ? document.querySelector(`[data-zone-id="${CSS.escape(input.dataset.zoneId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-region-color-input.ts:16:    ? document.querySelector(`[data-zone-id="${CSS.escape(input.dataset.zoneId)}"]`) as HTMLElement | null
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:11:import { cloneSelectionState, selectionStatesEqual, state } from '../../state.js';
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:119:  const selection = cloneSelectionState(state.selection);
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:122:    if (!state.pointer && selectionStatesEqual(state.selection, selection)) state.selection = cloneSelectionState(selection);
frontend/src/runtime/input/controller/handle-action-click.ts:156:      ? document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-action-click.ts:164:      ? document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-action-click.ts:195:      ? document.querySelector(`[data-zone-id="${CSS.escape(actionTarget.dataset.zoneId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-action-click.ts:197:        ? document.querySelector(`[data-group-id="${CSS.escape(actionTarget.dataset.groupId)}"]`) as HTMLElement | null
frontend/src/runtime/state.ts:1:export type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };
frontend/src/runtime/state.ts:3:export type PointerSelectionSnapshot = SelectionState & {
frontend/src/runtime/state.ts:13:export function emptySelectionState(): SelectionState {
frontend/src/runtime/state.ts:17:export function cloneSelectionState(selection: Partial<SelectionState> | null | undefined = emptySelectionState()): SelectionState {
frontend/src/runtime/state.ts:25:export function createPointerSelectionSnapshot(input: {
frontend/src/runtime/state.ts:26:  selection: Partial<SelectionState>;
frontend/src/runtime/state.ts:30:}): PointerSelectionSnapshot {
frontend/src/runtime/state.ts:32:    ...cloneSelectionState(input.selection),
frontend/src/runtime/state.ts:39:export function selectionStatesEqual(left: Partial<SelectionState> | null | undefined, right: Partial<SelectionState> | null | undefined): boolean {
frontend/src/runtime/state.ts:40:  const a = cloneSelectionState(left);
frontend/src/runtime/state.ts:41:  const b = cloneSelectionState(right);
frontend/src/runtime/state.ts:45:export function restoreSelectionFromPointerSnapshot(ledgerStateId = ''): boolean {
frontend/src/runtime/state.ts:49:  state.selection = cloneSelectionState(snapshot);
frontend/src/runtime/state.ts:83:  selection: emptySelectionState(),
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:61:      const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null;
frontend/src/runtime/card/effect/resize-selected-card.ts:12:  const card = resolveCurrentCardNode(cardId, savedCard);
frontend/src/runtime/card/effect/resize-selected-card.ts:49:function resolveCurrentCardNode(cardId: string, savedCard: HTMLElement | null): HTMLElement | null {
frontend/src/runtime/card/effect/resize-selected-card.ts:51:  if (savedCard?.dataset.cardId === cardId && savedCard.isConnected !== false) return savedCard;
frontend/src/runtime/card/effect/resize-selected-card.ts:55:function cssEscape(value: string): string {
frontend/src/runtime/card/effect/resize-selected-card.ts:56:  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:58:    .map((id: string) => document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null)
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:166:    .map((id: string) => document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null)
frontend/src/runtime/thread/effect/apply-thread-accent.ts:15:  const escapedThreadId = globalThis.CSS?.escape ? CSS.escape(threadId) : threadId.replace(/["\\]/g, '\\$&');
frontend/src/runtime/selection/effect/render-selection-state.ts:5:export function renderSelectionState(): void {
frontend/src/runtime/selection/controller/select-target.ts:7:import { renderSelectionState } from '../effect/render-selection-state.js';
frontend/src/runtime/selection/controller/select-target.ts:36:  renderSelectionState();
frontend/src/runtime/selection/effect/move-selected.ts:1:import { cloneSelectionState, state, type SelectionState } from '../../state.js';
frontend/src/runtime/selection/effect/move-selected.ts:9:export function moveSelected(dx: number, dy: number, selection: Partial<SelectionState> = state.selection): void {
frontend/src/runtime/selection/effect/move-selected.ts:10:  const movingSelection = cloneSelectionState(selection);
frontend/src/runtime/selection/effect/move-selected.ts:22:function moveSelectedLedgerGeometry(dx: number, dy: number, selection: SelectionState): void {
frontend/src/runtime/selection/effect/move-selected.ts:30:    patchNodePosition(document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
frontend/src/runtime/selection/effect/move-selected.ts:37:    patchNodePosition(document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
frontend/src/runtime/selection/effect/move-selected.ts:44:    patchNodePosition(document.querySelector(`[data-group-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
frontend/src/runtime/selection/effect/move-selected.ts:48:function moveSelectedDomGeometry(dx: number, dy: number, selection: SelectionState): void {
frontend/src/runtime/selection/effect/move-selected.ts:60:function renderMovementOverlays(selection: SelectionState): void {
frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts:7:type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };
frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts:11:export function shouldPreservePointerSelection(selection: SelectionState, kind: string, id: string, additive: boolean): boolean {
frontend/src/runtime/selection/helper/selection-includes-target.ts:1:type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };
frontend/src/runtime/selection/helper/selection-includes-target.ts:3:export function selectionIncludesTarget(selection: SelectionState, kind: string, id: string): boolean {
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:1:import { state, type SelectionState } from '../../state.js';
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:5:export async function commitSelectedLedgerGeometry(selection: Partial<SelectionState> = state.selection): Promise<boolean> {
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts:131:    const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:38:    const selector = zone.variant === 'group' ? `[data-group-id="${CSS.escape(id)}"].ledger-node` : `[data-zone-id="${CSS.escape(id)}"].ledger-node`;
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:45:    const node = patchLedgerCard(card, content.querySelector(`[data-card-id="${CSS.escape(id)}"].ledger-node`) as HTMLElement | null, zoneAttribution?.cardById?.[id]);
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:1:import { cloneSelectionState, state, type SelectionState } from '../../state.js';
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:109:export function pruneSelectionToActiveLedger(selection: Partial<SelectionState> = state.selection): SelectionState {
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:110:  const current = cloneSelectionState(selection);
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:126:export function selectedLedgerGeometryPayload(selection: Partial<SelectionState> = state.selection): {
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:131:  const current = cloneSelectionState(selection);
frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts:10:import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts:48:      renderSelectionState();
frontend/src/runtime/canvas/effect/sync-viewport-card-details.ts:29:  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null;
frontend/src/runtime/zone/helper/cards-intersecting-zone.ts:65:  const zone = document.querySelector(`[data-zone-id="${CSS.escape(zoneId)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:7:import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
frontend/src/runtime/canvas/effect/render-canvas-surface.ts:21:  renderSelectionState();
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:308:  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
frontend/src/runtime/zone/effect/resize-selected-zone.ts:13:  const zone = resolveCurrentZoneNode(id, targetKind, savedZone);
frontend/src/runtime/zone/effect/resize-selected-zone.ts:51:function resolveCurrentZoneNode(id: string, kind: 'zone' | 'group', savedZone: HTMLElement | null): HTMLElement | null {
frontend/src/runtime/zone/effect/resize-selected-zone.ts:54:  if (savedId === id && savedZone?.isConnected !== false) return savedZone;
frontend/src/runtime/zone/effect/resize-selected-zone.ts:59:function cssEscape(value: string): string {
frontend/src/runtime/zone/effect/resize-selected-zone.ts:60:  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:5:import { emptySelectionState, restoreSelectionFromPointerSnapshot, state } from '../../state.js';
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:22:    state.selection = emptySelectionState();
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:31:    state.selection = emptySelectionState();
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:49:    restoreSelectionFromPointerSnapshot(ledgerStateId);
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:51:    state.selection = emptySelectionState();
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:70:  if (target.kind === 'card') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:71:  if (target.kind === 'zone') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:72:  return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:219:    let control = overlay.querySelector(`[data-control-key="${CSS.escape(key)}"]`) as HTMLElement | null;
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:6:import { createPointerSelectionSnapshot, state } from '../../state.js';
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:14:import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:41:    renderSelectionState();
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:47:    state.pointer.selectionSnapshot = createPointerSelectionSnapshot({
import { canvas, content, controlOverlay as initialControlOverlay } from '../../dom.js';
import { renderLedgerCardDeleteButton } from '../../ledger/component/render-ledger-card-delete-button.js';
import { renderLedgerCardStatusButton } from '../../ledger/component/render-ledger-card-status-button.js';
import { state } from '../../state.js';

type ControlTarget = {
  kind: 'card' | 'zone' | 'group';
  id: string;
};

let hoveredTarget: ControlTarget | null = null;
let hoverBindingInitialized = false;
const removalTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const controlFadeDurationMs = 160;

function targetKey(target: ControlTarget | null): string {
  return target ? `${target.kind}:${target.id}` : '';
}

function sameTarget(a: ControlTarget | null, b: ControlTarget | null): boolean {
  return targetKey(a) === targetKey(b);
}

function resolveControlOverlay(): HTMLElement | null {
  if (initialControlOverlay?.isConnected) return initialControlOverlay;
  if (!canvas || typeof canvas.querySelector !== 'function') return null;
  const existing = canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.className = 'canvas-control-overlay';
  canvas.append(overlay);
  return overlay;
}

function existingControlOverlay(): HTMLElement | null {
  if (initialControlOverlay?.isConnected) return initialControlOverlay;
  if (!canvas || typeof canvas.querySelector !== 'function') return null;
  return canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
}

function clearCanvasControlOverlay(): void {
  hoveredTarget = null;
  existingControlOverlay()?.replaceChildren();
}

export function hideCanvasControlOverlay(): void {
  existingControlOverlay()?.replaceChildren();
}

function controlsDisabled(): boolean {
  return Boolean(canvas?.classList?.contains('low-detail'));
}

function targetFromElement(element: EventTarget | null): ControlTarget | null {
  const node = element as HTMLElement | null;
  const control = node?.closest?.('.canvas-control') as HTMLElement | null;
  if (control?.dataset.cardId) return { kind: 'card', id: control.dataset.cardId };
  if (control?.dataset.zoneId) return { kind: 'zone', id: control.dataset.zoneId };
  if (control?.dataset.groupId) return { kind: 'group', id: control.dataset.groupId };

  const canvasNode = node?.closest?.('.canvas-content > .card[data-card-id], .canvas-content > .zone[data-zone-id], .canvas-content > .zone[data-group-id]') as HTMLElement | null;
  if (canvasNode?.dataset.cardId) return { kind: 'card', id: canvasNode.dataset.cardId };
  if (canvasNode?.dataset.zoneId) return { kind: 'zone', id: canvasNode.dataset.zoneId };
  if (canvasNode?.dataset.groupId) return { kind: 'group', id: canvasNode.dataset.groupId };
  return null;
}

function sourceElement(target: ControlTarget): HTMLElement | null {
  if (!content) return null;
  if (target.kind === 'card') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
  if (target.kind === 'zone') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
  return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
}

function selectedTargets(): ControlTarget[] {
  const targets: ControlTarget[] = [];
  for (const id of new Set(state.selection.zoneIds as string[])) targets.push({ kind: 'zone', id });
  for (const id of new Set(state.selection.groupIds as string[])) targets.push({ kind: 'group', id });
  return targets;
}

function visibleTargets(): ControlTarget[] {
  const byKey = new Map<string, ControlTarget>();
  for (const target of selectedTargets()) byKey.set(targetKey(target), target);
  if (hoveredTarget) byKey.set(targetKey(hoveredTarget), hoveredTarget);
  return [...byKey.values()];
}

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

function cancelScheduledRemoval(control: HTMLElement): void {
  const timer = removalTimers.get(control);
  if (timer) clearTimeout(timer);
  removalTimers.delete(control);
}

function scheduleRemoval(control: HTMLElement): void {
  if (removalTimers.has(control)) return;
  control.classList.remove('is-visible');
  const timer = setTimeout(() => {
    if (!control.classList.contains('is-visible')) control.remove();
    removalTimers.delete(control);
  }, controlFadeDurationMs);
  removalTimers.set(control, timer);
}

function placeControlGroup(group: HTMLElement, source: HTMLElement, align: 'left' | 'right', yOffset = 6): boolean {
  const canvasRect = canvas.getBoundingClientRect();
  const rect = source.getBoundingClientRect();
  if (rect.right < canvasRect.left || rect.left > canvasRect.right || rect.bottom < canvasRect.top || rect.top > canvasRect.bottom) return false;
  const x = align === 'right' ? rect.right - canvasRect.left - 6 : rect.left - canvasRect.left + 6;
  const y = rect.top - canvasRect.top + yOffset;
  group.style.left = `${Math.round(x)}px`;
  group.style.top = `${Math.round(y)}px`;
  group.style.transform = align === 'right' ? 'translateX(-100%)' : 'none';
  return true;
}

function syncCardControls(group: HTMLElement, card: HTMLElement): boolean {
  if (!card.classList.contains('ledger-node')) return false;
  const cardId = card.dataset.cardId ?? '';
  if (!cardId) return false;
  const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';
  const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;
  const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();
  group.className = 'canvas-control canvas-control--card';
  group.dataset.cardId = cardId;
  if (cardZoneColor) group.style.setProperty('--card-zone-color', cardZoneColor);
  else group.style.removeProperty('--card-zone-color');
  const edit = document.createElement('button');
  edit.className = 'icon-button terminal-button terminal-button--compact';
  edit.type = 'button';
  edit.dataset.action = 'edit-card-title';
  edit.dataset.cardId = cardId;
  edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';
  edit.ariaLabel = edit.title;
  edit.textContent = '✎';
  const editBody = document.createElement('button');
  editBody.className = 'ledger-card-edit-toggle terminal-button terminal-button--compact';
  editBody.type = 'button';
  editBody.dataset.action = 'edit-card-description';
  editBody.dataset.cardId = cardId;
  editBody.title = 'Edit card content';
  editBody.setAttribute('aria-label', editBody.title);
  editBody.textContent = 'edit';
  const skill = document.createElement('button');
  skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';
  skill.type = 'button';
  skill.dataset.action = 'open-card-skill-modal';
  skill.dataset.cardId = cardId;
  skill.title = 'Run Codex skill';
  skill.setAttribute('aria-label', skill.title);
  skill.textContent = 'fx';
  const controls = card.dataset.targetLedgerId
    ? [edit, renderLedgerCardDeleteButton(cardId)]
    : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];
  group.replaceChildren(...controls);
  return placeControlGroup(group, card, 'right');
}

function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' | 'group'): boolean {
  const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';
  if (!id) return false;
  group.className = `canvas-control canvas-control--${kind}`;
  if (kind === 'zone') group.dataset.zoneId = id;
  else group.dataset.groupId = id;

  const edit = document.createElement('button');
  edit.className = 'icon-button terminal-button terminal-button--compact';
  edit.type = 'button';
  edit.dataset.action = 'edit-zone';
  if (kind === 'zone') edit.dataset.zoneId = id;
  else edit.dataset.groupId = id;
  edit.title = kind === 'zone' ? 'Edit zone name' : 'Edit group name';
  edit.ariaLabel = edit.title;
  edit.textContent = '✎';
  const controls: HTMLElement[] = [edit];

  if (kind === 'zone') {
    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'zone-color-edit';
    color.dataset.action = 'edit-zone-color';
    color.dataset.zoneId = id;
    color.ariaLabel = 'Edit zone color';
    color.value = zone.style.getPropertyValue('--zone-color').trim() || '#55b8ff';
    controls.push(color);
  } else if (zone.classList.contains('ledger-node')) {
    const deleteButton = document.createElement('button');
    deleteButton.className = 'ledger-group-delete terminal-button terminal-button--compact';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'confirm-delete-group';
    deleteButton.dataset.groupId = id;
    deleteButton.title = 'Delete group';
    deleteButton.setAttribute('aria-label', 'Delete group');
    deleteButton.textContent = 'X';
    controls.push(deleteButton);
  }

  group.replaceChildren(...controls);
  return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);
}

export function renderCanvasControlOverlay(): void {
  if (controlsDisabled()) {
    clearCanvasControlOverlay();
    return;
  }
  const overlay = resolveControlOverlay();
  if (!overlay || !canvas || !content) return;
  const activeKeys = new Set<string>();
  for (const target of visibleTargets()) {
    const source = sourceElement(target);
    if (!source || source.hidden || source.style.display === 'none') continue;
    const key = targetKey(target);
    let control = overlay.querySelector(`[data-control-key="${CSS.escape(key)}"]`) as HTMLElement | null;
    const isNew = !control;
    if (!control) {
      control = document.createElement('div');
      control.dataset.controlKey = key;
    }
    const visible = target.kind === 'card'
      ? syncCardControls(control, source)
      : syncZoneControls(control, source, target.kind);
    if (!visible) continue;
    activeKeys.add(key);
    cancelScheduledRemoval(control);
    if (isNew) {
      overlay.append(control);
      nextFrame(() => nextFrame(() => control?.classList.add('is-visible')));
    } else {
      control.classList.add('is-visible');
    }
  }
  for (const control of Array.from(overlay.querySelectorAll('.canvas-control')) as HTMLElement[]) {
    if (!activeKeys.has(control.dataset.controlKey ?? '')) scheduleRemoval(control);
  }
}

export function bindCanvasControlOverlayHover(): void {
  if (hoverBindingInitialized || !canvas) return;
  hoverBindingInitialized = true;
  canvas.addEventListener('mouseover', (event) => {
    if (controlsDisabled()) {
      clearCanvasControlOverlay();
      return;
    }
    const next = targetFromElement(event.target);
    if (!next || sameTarget(hoveredTarget, next)) return;
    hoveredTarget = next;
    renderCanvasControlOverlay();
  });
  canvas.addEventListener('mouseout', (event) => {
    if (controlsDisabled()) {
      clearCanvasControlOverlay();
      return;
    }
    const previous = targetFromElement(event.target);
    if (!previous) return;
    const next = targetFromElement(event.relatedTarget);
    if (sameTarget(previous, next)) return;
    if (sameTarget(previous, hoveredTarget)) {
      hoveredTarget = next;
      renderCanvasControlOverlay();
    }
  });
}
import { SVG_NS } from '../../dom.js';
import { state } from '../../state.js';
import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';
import { activeLedgerCardMap, activeLedgerCardRectMap } from '../../ledger/helper/active-ledger-geometry.js';
import { ensureZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { calculateRelationshipPorts } from '../helper/calculate-relationship-ports.js';
import { resolveRelationshipPortSlots } from '../helper/resolve-relationship-port-slots.js';
import { routeRelationshipPath } from '../helper/route-relationship-path.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderRelationshipOverlay(): void {
  const overlays = Array.from(document.querySelectorAll('.relationships')) as SVGSVGElement[];
  let count = 0;
  for (const overlay of overlays) {
    if (overlay.hasAttribute('hidden')) continue;
    const relationships = Array.from(overlay.querySelectorAll('path[data-relationship-id]')) as SVGPathElement[];
    count += state.activeLedger
      ? renderLedgerRelationshipOverlay(overlay, relationships)
      : renderStaticRelationshipOverlay(overlay, relationships);
  }
  telemetry('render-relationship-overlay', { count });
}

function renderLedgerRelationshipOverlay(overlay: SVGSVGElement, relationships: SVGPathElement[]): number {
  const rectByCardId = activeLedgerCardRectMap();
  const cardById = activeLedgerCardMap();
  const zoneAttribution = ensureZoneAttributionCache('render-relationship-overlay');
  const endpoints = relationships.map((path) => ({
    relationshipId: path.dataset.relationshipId ?? '',
    sourceId: path.dataset.source ?? '',
    targetId: path.dataset.target ?? ''
  })).filter((relationship) => relationship.relationshipId && relationship.sourceId && relationship.targetId);
  const portSlots = resolveRelationshipPortSlots(endpoints, rectByCardId);
  let count = 0;
  for (const [routeIndex, path] of relationships.entries()) {
    const relationshipId = path.dataset.relationshipId ?? '';
    const sourceId = path.dataset.source ?? '';
    const targetId = path.dataset.target ?? '';
    const sourceRect = rectByCardId.get(sourceId);
    const targetRect = rectByCardId.get(targetId);
    if (!sourceRect || !targetRect) continue;
    const ports = calculateRelationshipPorts(sourceRect, targetRect, portSlots[relationshipId], { sourceId, targetId });
    const route = routeRelationshipPath({ ...ports, routeIndex });
    path.setAttribute('d', route.path);
    path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
    const relationshipLabel = path.dataset.relationshipLabelText || relationshipId;
    const sourceTitle = String(cardById.get(sourceId)?.title ?? sourceId);
    patchRelationshipLabel(overlay, relationshipId, 'target', relationshipLabel, route.startLabel, relationshipLabelColor(sourceId, zoneAttribution?.cardById?.[sourceId]?.readableColor));
    patchRelationshipLabel(overlay, relationshipId, 'source', sourceTitle, route.endLabel, relationshipLabelColor(targetId, zoneAttribution?.cardById?.[targetId]?.readableColor));
    count += 1;
  }
  return count;
}

function renderStaticRelationshipOverlay(overlay: SVGSVGElement, relationships: SVGPathElement[]): number {
  const rectByCardId = new Map<string, { left: number; top: number; right: number; bottom: number; width: number; height: number }>();
  const sourceTitleById = new Map<string, string>();
  for (const path of relationships) {
    for (const cardId of [path.dataset.source ?? '', path.dataset.target ?? '']) {
      if (!cardId || rectByCardId.has(cardId)) continue;
      const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null;
      if (!element || element.hidden) continue;
      rectByCardId.set(cardId, elementCanvasRect(element));
      sourceTitleById.set(cardId, element.querySelector('strong')?.textContent?.trim() || cardId);
    }
  }
  const endpoints = relationships.map((path) => ({
    relationshipId: path.dataset.relationshipId ?? '',
    sourceId: path.dataset.source ?? '',
    targetId: path.dataset.target ?? ''
  })).filter((relationship) => relationship.relationshipId && relationship.sourceId && relationship.targetId);
  const portSlots = resolveRelationshipPortSlots(endpoints, rectByCardId);
  let count = 0;
  for (const [routeIndex, path] of relationships.entries()) {
    const relationshipId = path.dataset.relationshipId ?? '';
    const sourceId = path.dataset.source ?? '';
    const targetId = path.dataset.target ?? '';
    const sourceRect = rectByCardId.get(sourceId);
    const targetRect = rectByCardId.get(targetId);
    if (!sourceRect || !targetRect) continue;
    const ports = calculateRelationshipPorts(sourceRect, targetRect, portSlots[relationshipId], { sourceId, targetId });
    const route = routeRelationshipPath({ ...ports, routeIndex });
    path.setAttribute('d', route.path);
    path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
    const relationshipLabel = path.dataset.relationshipLabelText || relationshipId;
    const sourceTitle = sourceTitleById.get(sourceId) || sourceId;
    patchRelationshipLabel(overlay, relationshipId, 'target', relationshipLabel, route.startLabel, relationshipLabelColor(sourceId));
    patchRelationshipLabel(overlay, relationshipId, 'source', sourceTitle, route.endLabel, relationshipLabelColor(targetId));
    count += 1;
  }
  return count;
}

function relationshipLabelColor(_cardId: string, readableColor?: string): string {
  return readableColor?.trim()
    || 'rgba(243, 240, 231, 0.72)';
}

function patchRelationshipLabel(
  overlay: SVGSVGElement,
  relationshipId: string,
  kind: 'source' | 'target',
  text: string,
  point: { x: number; y: number; anchor?: string },
  color: string
): void {
  const labelId = `${relationshipId}:${kind}`;
  let label = overlay.querySelector(`[data-relationship-label="${labelId}"]`) as SVGTextElement | null;
  if (!label) {
    label = document.createElementNS(SVG_NS, 'text');
    label.dataset.relationshipLabel = labelId;
    label.dataset.relationshipId = relationshipId;
    label.dataset.labelKind = kind;
    overlay.appendChild(label);
  }
  label.classList.toggle('is-source', kind === 'source');
  label.classList.toggle('is-target', kind === 'target');
  label.textContent = text;
  label.setAttribute('x', String(point.x));
  label.setAttribute('y', String(point.y));
  label.setAttribute('text-anchor', point.anchor ?? 'middle');
  label.style.setProperty('--relationship-label-color', color);
}
import { content } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderZoneLabelOverlay(): void {
  const overlay = resolveZoneLabelOverlay();
  overlay.replaceChildren();
  const zones = Array.from(content.querySelectorAll(':scope > .zone[data-zone-id], :scope > .zone[data-group-id]')) as HTMLElement[];
  for (const zone of zones) {
    if (zone.hidden || zone.style.display === 'none') continue;
    const title = zone.querySelector('.zone-title') as HTMLElement | null;
    const text = title?.textContent?.trim();
    if (!title || !text) continue;
    if (title.classList.contains('editing')) continue;
    const label = document.createElement('div');
    label.className = 'zone-label-proxy';
    label.textContent = text;
    label.dataset.zoneLabelFor = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
    label.style.left = `${zone.offsetLeft + title.offsetLeft}px`;
    label.style.top = `${zone.offsetTop + title.offsetTop}px`;
    label.style.maxWidth = `${Math.max(0, zone.offsetWidth - title.offsetLeft)}px`;
    const titleStyle = getComputedStyle(title);
    label.style.color = titleStyle.color;
    label.style.textShadow = titleStyle.textShadow;
    overlay.append(label);
  }
  telemetry('render-zone-label-overlay', { labels: overlay.childElementCount });
}

function resolveZoneLabelOverlay(): HTMLElement {
  const existing = content.querySelector(':scope > .zone-label-overlay') as HTMLElement | null;
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.className = 'zone-label-overlay';
  content.insertBefore(overlay, content.querySelector('.marquee'));
  return overlay;
}
import { state } from '../../state.js';
import { connectedCardIds } from '../../relationship/helper/connected-card-ids.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';

export function renderSelectionState(): void {
  const connectedIds = connectedCardIds(state.selection.cardIds);
  document.querySelectorAll('[data-card-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.cardIds.includes(element.dataset.cardId));
    element.classList.toggle('connected', connectedIds.includes(element.dataset.cardId ?? ''));
  });
  document.querySelectorAll('[data-zone-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.zoneIds.includes(element.dataset.zoneId));
  });
  document.querySelectorAll('[data-group-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.groupIds.includes(element.dataset.groupId));
  });
  renderCanvasControlOverlay();
}
/**
 * WHAT: Starts canvas pointer gestures and resolves their target intent.
 * WHY: Drag, pan, resize, draw, and edit control flow must share one canonical pointer entrypoint.
 */
import { canvas } from '../../dom.js';
import { createPointerSelectionSnapshot, state } from '../../state.js';
import { derivePointerIntent, isForcedPanPointer } from '../helper/derive-pointer-intent.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { patchBox } from '../../canvas/effect/patch-box.js';
import { isGestureControlTarget } from '../helper/is-gesture-control-target.js';
import { point } from '../helper/point.js';
import { shouldPreservePointerSelection } from '../../selection/helper/should-preserve-pointer-selection.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { selectThread } from '../../thread/effect/select-thread.js';
import { closeThreadPanel } from '../../thread/effect/close-thread-panel.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function handlePointerDown(event: PointerEvent): void {
  const rawTarget = event.target as HTMLElement;
  const forcedPan = isForcedPanPointer(event);
  if (!forcedPan && isGestureControlTarget(rawTarget)) return;
  const now = performance.now();
  event.preventDefault();
  const resizeHandle = rawTarget.closest('.resize-handle') as HTMLElement | null;
  const target = rawTarget.closest('[data-card-id],[data-zone-id],[data-group-id]') as HTMLElement | null;
  const targetKind = target?.dataset.cardId ? 'card' : target?.dataset.groupId ? 'group' : target?.dataset.zoneId ? 'zone' : 'canvas';
  const targetId = target?.dataset.cardId ?? target?.dataset.groupId ?? target?.dataset.zoneId ?? '';
  const pointer = point(event);
  const canvasPointer = canvasPoint(pointer);
  const intent = derivePointerIntent(event, targetKind, resizeHandle);
  state.pointer = { intent, resizeHandle, target, targetKind, targetId, start: pointer, current: pointer, startCanvas: canvasPointer, currentCanvas: canvasPointer, startedAt: now, ctrlPan: event.ctrlKey, forcedPan };
  telemetry('canvas-pointer-down', { intent, targetKind, targetId, ctrlKey: event.ctrlKey, middleButton: event.button === 1, shiftKey: event.shiftKey });
  telemetry('derive-gesture-intent', { kind: intent });
  if (intent === 'pan' && targetKind === 'canvas' && !forcedPan) {
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    selectThread('');
    if (state.threadPanelOpen || state.activeTool === 'thread') closeThreadPanel();
    (document.activeElement as HTMLElement | null)?.blur?.();
    telemetry('clear-transient-selection', { reason: 'canvas-background-pointer-down' });
    renderSelectionState();
  }
  const preserveSelection = shouldPreservePointerSelection(state.selection, targetKind, targetId, event.shiftKey);
  if ((intent === 'drag' || intent === 'group') && !preserveSelection) selectTarget(targetKind, targetId, event.shiftKey);
  if (intent === 'resize') selectTarget(targetKind, targetId, false);
  if (state.pointer && (intent === 'drag' || intent === 'group' || intent === 'resize')) {
    state.pointer.selectionSnapshot = createPointerSelectionSnapshot({
      selection: state.selection,
      targetKind,
      targetId,
      ledgerStateId: currentLedgerStateId()
    });
  }
  if (intent === 'marquee' || intent === 'draw-card' || intent === 'draw-zone' || intent === 'draw-group') {
    const marquee = document.querySelector('.marquee') as HTMLElement;
    marquee.hidden = false;
    patchBox(marquee, canvasPointer.x, canvasPointer.y, 0, 0);
  }
  canvas.setPointerCapture?.(event.pointerId);
}

function currentLedgerStateId(): string {
  return String(state.activeLedgerId || (state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab || ''));
}
/**
 * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.
 * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.
 */
import { state } from '../../state.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { createCardController } from '../../card/controller/create-card-controller.js';
import { createZoneController } from '../../zone/controller/create-zone-controller.js';
import { createGroupController } from '../../group/controller/create-group-controller.js';
import { commitSelectedLedgerGeometry } from '../../ledger/effect/commit-selected-ledger-geometry.js';
import { finishPointer } from '../effect/finish-pointer.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { point } from '../helper/point.js';
import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { selectIntersecting } from '../../selection/effect/select-intersecting.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { moveSelected } from '../../selection/effect/move-selected.js';
import { resizeSelectedCard } from '../../card/effect/resize-selected-card.js';
import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';
import { isClickMovement, pointerDistancePx } from '../helper/click-movement.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function handlePointerUp(event: PointerEvent): Promise<void> {
  if (!state.pointer) return;
  event.preventDefault();
  const pointerSession = state.pointer;
  const pointerIntent = pointerSession.intent;
  let releaseRendered = false;
  telemetry('canvas-pointer-up', { intent: pointerIntent });
  const releasePoint = point(event);
  const releaseCanvas = canvasPoint(releasePoint);
  const moved = pointerDistancePx(pointerSession.start, releasePoint);
  const isForcedPan = Boolean(pointerSession.forcedPan || pointerSession.ctrlPan);
  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'zone' && isClickMovement(moved)) {
    selectTarget('zone', pointerSession.targetId, false);
    telemetry('resolve-selection-target', { kind: 'zone', id: pointerSession.targetId, clickSelect: true });
  }
  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'group' && isClickMovement(moved)) {
    selectTarget('group', pointerSession.targetId, false);
    telemetry('resolve-selection-target', { kind: 'group', id: pointerSession.targetId, clickSelect: true });
  }
  if (pointerIntent === 'marquee') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    selectIntersecting(rect);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    telemetry('resolve-selection-target', { selection: state.selection });
  }
  if (pointerIntent === 'draw-card') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    finishPointer(event);
    await createCardController(rect);
  }
  if (pointerIntent === 'draw-zone') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    finishPointer(event);
    await createZoneController(rect);
  }
  if (pointerIntent === 'draw-group') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    finishPointer(event);
    await createGroupController(rect);
  }
  if ((pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') && isClickMovement(moved)) {
    finishPointer(event);
    persistState();
    return;
  }
  if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {
    const gestureSelection = pointerSession.selectionSnapshot ?? state.selection;
    const canvasDx = releaseCanvas.x - pointerSession.currentCanvas.x;
    const canvasDy = releaseCanvas.y - pointerSession.currentCanvas.y;
    if (canvasDx || canvasDy) {
      if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);
      if (pointerIntent === 'resize') {
        if (pointerSession.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);
        else resizeSelectedZone(canvasDx, canvasDy);
      }
    }
    finishPointer(event);
    releaseRendered = await commitSelectedLedgerGeometry(gestureSelection);
  }
  if (pointerIntent === 'pan' || pointerIntent === 'marquee') finishPointer(event);
  persistState();
  if (pointerIntent !== 'pan' && !releaseRendered) renderCanvasSurface();
}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-18","timestamp":"2026-07-10T04:37:02.005Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"18","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_9"} -->

The first concrete quality findings are ownership problems introduced by the implementation: selection algorithms were placed in `state.ts`, ledger selection pruning was placed in a geometry helper, and card/zone resize effects duplicate remount-target resolution. I am checking the new test scaffolding next so any extraction is limited to code added by this iteration.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-19","timestamp":"2026-07-10T04:37:06.004Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"19","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc \"find frontend/test tests/browser -type d | sort | head -100\nfind frontend/test -type f | rg 'fixture|fake|helper|support' | sort\nrg -n \\\"\"'^class Fake|''^type Fake|''^function fake|''^function create|''^function deferred|''^function pointer|''^function reset|''^test'\"\\\\(\\\" frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\n\ngit diff -- frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts\n\ngit diff -- frontend/test/runtime/ledger-content-refresh.integration.test.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "find frontend/test tests/browser -type d | sort | head -100
find frontend/test -type f | rg 'fixture|fake|helper|support' | sort
rg -n \""'^class Fake|''^type Fake|''^function fake|''^function create|''^function deferred|''^function pointer|''^function reset|''^test'"\\(\" frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts

git diff -- frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts

git diff -- frontend/test/runtime/ledger-content-refresh.integration.test.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-20","timestamp":"2026-07-10T04:37:06.004Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"20","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc \"find frontend/test tests/browser -type d | sort | head -100\nfind frontend/test -type f | rg 'fixture|fake|helper|support' | sort\nrg -n \\\"\"'^class Fake|''^type Fake|''^function fake|''^function create|''^function deferred|''^function pointer|''^function reset|''^test'\"\\\\(\\\" frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\n\ngit diff -- frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts\n\ngit diff -- frontend/test/runtime/ledger-content-refresh.integration.test.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "find frontend/test tests/browser -type d | sort | head -100
find frontend/test -type f | rg 'fixture|fake|helper|support' | sort
rg -n \""'^class Fake|''^type Fake|''^function fake|''^function create|''^function deferred|''^function pointer|''^function reset|''^test'"\\(\" frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts

git diff -- frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts

git diff -- frontend/test/runtime/ledger-content-refresh.integration.test.ts"`
Status: completed
Exit code: 0

````text
frontend/test
frontend/test/boot
frontend/test/canvas
frontend/test/card
frontend/test/group
frontend/test/navigation
frontend/test/refresh
frontend/test/relationship
frontend/test/runtime
frontend/test/selection
frontend/test/thread
frontend/test/toolbox
frontend/test/unit
frontend/test/unit/boot
frontend/test/unit/boot/controller
frontend/test/unit/boot/helper
frontend/test/unit/canvas
frontend/test/unit/canvas/effect
frontend/test/unit/canvas/helper
frontend/test/unit/card
frontend/test/unit/card/controller
frontend/test/unit/card/effect
frontend/test/unit/card/helper
frontend/test/unit/gesture
frontend/test/unit/gesture/controller
frontend/test/unit/gesture/helper
frontend/test/unit/group
frontend/test/unit/group/controller
frontend/test/unit/group/effect
frontend/test/unit/group/helper
frontend/test/unit/ledger
frontend/test/unit/ledger/effect
frontend/test/unit/ledger/helper
frontend/test/unit/navigation
frontend/test/unit/navigation/controller
frontend/test/unit/navigation/effect
frontend/test/unit/navigation/helper
frontend/test/unit/persistence
frontend/test/unit/persistence/effect
frontend/test/unit/refresh
frontend/test/unit/refresh/controller
frontend/test/unit/refresh/effect
frontend/test/unit/refresh/helper
frontend/test/unit/relationship
frontend/test/unit/relationship/controller
frontend/test/unit/relationship/effect
frontend/test/unit/relationship/helper
frontend/test/unit/runtime
frontend/test/unit/runtime/gesture
frontend/test/unit/runtime/gesture/helper
frontend/test/unit/runtime/input
frontend/test/unit/runtime/input/helper
frontend/test/unit/runtime/relationship
frontend/test/unit/runtime/relationship/helper
frontend/test/unit/runtime/voice
frontend/test/unit/runtime/voice/helper
frontend/test/unit/selection
frontend/test/unit/selection/helper
frontend/test/unit/thread
frontend/test/unit/thread/controller
frontend/test/unit/thread/effect
frontend/test/unit/thread/helper
frontend/test/unit/toolbox
frontend/test/unit/toolbox/controller
frontend/test/unit/toolbox/effect
frontend/test/unit/toolbox/helper
frontend/test/unit/voice
frontend/test/unit/voice/controller
frontend/test/unit/voice/effect
frontend/test/unit/voice/helper
frontend/test/unit/zone
frontend/test/unit/zone/controller
frontend/test/unit/zone/effect
frontend/test/unit/zone/helper
frontend/test/voice
frontend/test/zone
tests/browser
tests/browser/canvas
tests/browser/card
tests/browser/group
tests/browser/navigation
tests/browser/refresh
tests/browser/relationship
tests/browser/selection
tests/browser/thread
tests/browser/toolbox
tests/browser/voice
tests/browser/zone
frontend/test/unit/boot/helper/load-ledger-state.test.ts
frontend/test/unit/canvas/helper/calculate-viewport-transform.test.ts
frontend/test/unit/card/helper/parse-card-markdown.test.ts
frontend/test/unit/card/helper/resolve-card-y-overlap.test.ts
frontend/test/unit/gesture/helper/calculate-drag-delta.test.ts
frontend/test/unit/gesture/helper/derive-gesture-intent.test.ts
frontend/test/unit/group/helper/resolve-click-precedence.test.ts
frontend/test/unit/group/helper/resolve-group-membership.test.ts
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts
frontend/test/unit/navigation/helper/derive-route-state.test.ts
frontend/test/unit/refresh/helper/merge-refresh-state.test.ts
frontend/test/unit/relationship/helper/calculate-relationship-ports.test.ts
frontend/test/unit/relationship/helper/route-relationship-path.test.ts
frontend/test/unit/runtime/gesture/helper/is-gesture-control-target.test.ts
frontend/test/unit/runtime/input/helper/is-card-editing-keyboard-target.test.ts
frontend/test/unit/runtime/relationship/helper/calculate-relationship-ports.test.ts
frontend/test/unit/runtime/relationship/helper/choose-relationship-port-sides.test.ts
frontend/test/unit/runtime/relationship/helper/choose-relationship-route-candidate.test.ts
frontend/test/unit/runtime/relationship/helper/relationship-port-normal-for-side.test.ts
frontend/test/unit/runtime/relationship/helper/relationship-port-side-options.test.ts
frontend/test/unit/runtime/relationship/helper/route-relationship-path.test.ts
frontend/test/unit/runtime/relationship/helper/score-relationship-port-sides.test.ts
frontend/test/unit/runtime/voice/helper/encode-wav-blob.test.ts
frontend/test/unit/runtime/voice/helper/format-voice-duration.test.ts
frontend/test/unit/selection/helper/calculate-marquee-selection.test.ts
frontend/test/unit/selection/helper/clear-transient-selection.test.ts
frontend/test/unit/selection/helper/copy-selection-payload.test.ts
frontend/test/unit/selection/helper/elements-intersecting-canvas-rect.test.ts
frontend/test/unit/selection/helper/resolve-selection-target.test.ts
frontend/test/unit/selection/helper/selection-includes-target.test.ts
frontend/test/unit/thread/helper/resolve-thread-target.test.ts
frontend/test/unit/toolbox/helper/resolve-tool-mode.test.ts
frontend/test/unit/voice/helper/capture-voice-audio.test.ts
frontend/test/unit/voice/helper/resolve-voice-session.test.ts
frontend/test/unit/zone/helper/calculate-zone-geometry.test.ts
frontend/test/unit/zone/helper/confirm-zone-deletion.test.ts
frontend/test/unit/zone/helper/resolve-zone-selection-membership.test.ts
frontend/test/unit/zone/helper/validate-zone-draft.test.ts
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:45:test('The refresh system preserves canvas continuity during operator work.', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:4:test('specs and data ledger tabs commit canvas mutations through the server ledger endpoint', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:226:test('active ledger load keeps server geometry authoritative over stale browser persistence', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:293:test('active ledger refresh keeps local canvas geometry and viewport while accepting server content', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:357:test('active ledger refresh keeps viewport moves made while the server load is in flight', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:418:test('same-ledger active load preserves selected records and prunes missing records', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:483:test('non-geometry mutation responses keep newer local canvas geometry', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:530:test('patch-geometry mutation responses keep unrelated newer local canvas geometry', async () => {
frontend/test/runtime/ledger-content-refresh.integration.test.ts:159:test('ledger content refresh is deferred while voice recording is active', async () => {
frontend/test/runtime/ledger-content-refresh.integration.test.ts:187:test('thread content refresh is deferred separately from canvas refresh while voice recording is active', async () => {
frontend/test/runtime/ledger-content-refresh.integration.test.ts:218:test('thread content refresh keeps newer selection made while same-ledger load is in flight', async () => {
frontend/test/runtime/ledger-content-refresh.integration.test.ts:275:test('thread content events rerender the thread panel without remounting the canvas', () => {
frontend/test/runtime/ledger-content-refresh.integration.test.ts:287:test('card content refresh resizes the changed card after the refreshed render', () => {
frontend/test/runtime/ledger-content-refresh.integration.test.ts:297:test('changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file', async () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:245:function createCanvasRuntimeDom() {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:505:test('canvas pan uses a transform-only path with sampled performance telemetry', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:536:test('ctrl and middle-button drag always derive pan intent without selection side effects', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:574:test('card tool draws over zone and group backgrounds while select mode keeps zone pan precedence', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:597:test('card creation preserves canvas x and y instead of clamping to positive space', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:605:test('direct canvas pointer down clears selection before pointer up', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:618:test('plain pan pointer up does not force a full canvas rerender', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:627:test('manual runtime refresh preserves an active pan pointer and allows pan to continue', async () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:691:test('wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence', async () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:750:test('wheel zoom stays transform-only and does not reroute relationships', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:791:test('canvas debug overlay is URL-param gated and reports zoom density state', () => {
frontend/test/runtime/canvas-pan-performance.integration.test.ts:821:test('normal detail reveal is viewport-local and layout-free', () => {
frontend/test/runtime/drag-release-freeze.integration.test.ts:8:type FakeElement = {
frontend/test/runtime/drag-release-freeze.integration.test.ts:92:function fakeElement(dataset: Record<string, string> = {}, tagName = 'div'): FakeElement {
frontend/test/runtime/drag-release-freeze.integration.test.ts:251:function createRuntimeDom(): RuntimeDom {
frontend/test/runtime/drag-release-freeze.integration.test.ts:361:function resetRuntimeDom(): void {
frontend/test/runtime/drag-release-freeze.integration.test.ts:485:function pointerEvent(input: { target?: FakeElement; clientX: number; clientY: number; pointerId?: number; shiftKey?: boolean; ctrlKey?: boolean; button?: number; buttons?: number }): PointerEvent {
frontend/test/runtime/drag-release-freeze.integration.test.ts:517:test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
frontend/test/runtime/drag-release-freeze.integration.test.ts:566:test('active card drag keeps pointer snapshot through same-ledger load and commits the original target', async () => {
frontend/test/runtime/drag-release-freeze.integration.test.ts:643:test('multi-selection drag survives ledger content refresh and commits only the pointer snapshot', async () => {
frontend/test/runtime/drag-release-freeze.integration.test.ts:731:test('card resize resolves the current remounted node and commits pointer target geometry', async () => {
diff --git a/frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts b/frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
index 6aeb76c..7e0efb2 100644
--- a/frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
+++ b/frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
@@ -415,6 +415,71 @@ test('active ledger refresh keeps viewport moves made while the server load is i
   assert.deepEqual(state.activeLedger.cards[0], { id: 'card-a', title: 'Server title', x: 100, y: 200, w: 300, h: 180 });
 });
 
+test('same-ledger active load preserves selected records and prunes missing records', async () => {
+  (globalThis as any).CustomEvent = class CustomEvent {
+    detail: unknown;
+    constructor(_type: string, init: { detail?: unknown } = {}) {
+      this.detail = init.detail;
+    }
+  };
+  (globalThis as any).window = {
+    location: { pathname: '/specs' },
+    dispatchEvent() {},
+    __coreTelemetry: []
+  };
+  const { state } = await import('../../src/runtime/state.js');
+  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.pointer = null;
+  state.selection = {
+    cardIds: ['card-a', 'missing-card'],
+    zoneIds: ['zone-a', 'missing-zone', 'group-a'],
+    groupIds: ['group-a', 'missing-group', 'zone-a']
+  };
+  state.activeLedger = {
+    cards: [
+      { id: 'card-a', title: 'Local A', x: 10, y: 20, w: 240, h: 132 },
+      { id: 'missing-card', title: 'Local missing', x: 100, y: 120, w: 240, h: 132 }
+    ],
+    annotations: [
+      { id: 'zone-a', variant: 'zone', label: 'Local zone', x: 0, y: 0, width: 200, height: 140 },
+      { id: 'group-a', variant: 'group', label: 'Local group', x: 20, y: 30, width: 260, height: 180 },
+      { id: 'missing-zone', variant: 'zone', label: 'Local missing zone', x: 60, y: 70, width: 200, height: 140 },
+      { id: 'missing-group', variant: 'group', label: 'Local missing group', x: 80, y: 90, width: 260, height: 180 }
+    ],
+    notes: {}
+  };
+
+  (globalThis as any).fetch = async (url: string) => {
+    assert.equal(url, '/decision-os/specs');
+    return {
+      ok: true,
+      async json() {
+        return {
+          cards: [{ id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 }],
+          annotations: [
+            { id: 'zone-a', variant: 'zone', label: 'Server zone', x: 3, y: 4, width: 180, height: 140 },
+            { id: 'group-a', variant: 'group', label: 'Server group', x: 5, y: 6, width: 220, height: 160 }
+          ],
+          notes: {}
+        };
+      }
+    };
+  };
+
+  await loadActiveLedgerState();
+
+  assert.deepEqual(state.selection, {
+    cardIds: ['card-a'],
+    zoneIds: ['zone-a'],
+    groupIds: ['group-a']
+  });
+});
+
 test('non-geometry mutation responses keep newer local canvas geometry', async () => {
   (globalThis as any).CustomEvent = class CustomEvent {
     detail: unknown;
diff --git a/frontend/test/runtime/ledger-content-refresh.integration.test.ts b/frontend/test/runtime/ledger-content-refresh.integration.test.ts
index 2d1ac9c..19fd5e1 100644
--- a/frontend/test/runtime/ledger-content-refresh.integration.test.ts
+++ b/frontend/test/runtime/ledger-content-refresh.integration.test.ts
@@ -2,7 +2,6 @@ import test from 'node:test';
 import assert from 'node:assert/strict';
 import { existsSync, readFileSync } from 'node:fs';
 import { resolve } from 'node:path';
-import { changedCardIdForContentFile, requestLedgerContentRefresh, requestThreadContentRefresh } from '../../src/runtime/refresh/effect/subscribe-ledger-content-events.js';
 import { state } from '../../src/runtime/state.js';
 
 function source(path: string): string {
@@ -11,7 +10,155 @@ function source(path: string): string {
   return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
 }
 
-test('ledger content refresh is deferred while voice recording is active', () => {
+type ThreadFakeElement = {
+  dataset: Record<string, string>;
+  className: string;
+  hidden: boolean;
+  textContent: string;
+  value: string;
+  children: ThreadFakeElement[];
+  parentElement: ThreadFakeElement | null;
+  style: { setProperty(name: string, value: string): void; getPropertyValue(name: string): string };
+  classList: { toggle(name: string, force?: boolean): void; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
+  append(...nodes: ThreadFakeElement[]): void;
+  replaceChildren(...nodes: ThreadFakeElement[]): void;
+  querySelector(selector: string): ThreadFakeElement | null;
+  querySelectorAll(selector: string): ThreadFakeElement[];
+  setAttribute(name: string, value: string): void;
+  addEventListener(): void;
+};
+
+const threadDom = {
+  telemetryList: threadElement('telemetry-list'),
+  threadPanel: threadElement('thread-panel'),
+  panel: threadElement('panel'),
+  shell: threadElement('shell'),
+  threadTarget: threadElement('thread-target'),
+  threadHeading: threadElement('thread-heading')
+};
+
+function threadElement(className = ''): ThreadFakeElement {
+  const properties = new Map<string, string>();
+  const element: ThreadFakeElement = {
+    dataset: {},
+    className,
+    hidden: false,
+    textContent: '',
+    value: '',
+    children: [],
+    parentElement: null,
+    style: {
+      setProperty(name: string, value: string) {
+        properties.set(name, value);
+      },
+      getPropertyValue(name: string) {
+        return properties.get(name) ?? '';
+      }
+    },
+    classList: {
+      toggle(name: string, force?: boolean) {
+        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
+        const shouldAdd = force ?? !classes.has(name);
+        if (shouldAdd) classes.add(name);
+        else classes.delete(name);
+        element.className = [...classes].join(' ');
+      },
+      add(...names: string[]) {
+        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
+        for (const name of names) classes.add(name);
+        element.className = [...classes].join(' ');
+      },
+      remove(...names: string[]) {
+        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
+        for (const name of names) classes.delete(name);
+        element.className = [...classes].join(' ');
+      },
+      contains(name: string) {
+        return element.className.split(/\s+/).includes(name);
+      }
+    },
+    append(...nodes: ThreadFakeElement[]) {
+      for (const node of nodes) {
+        node.parentElement = element;
+        element.children.push(node);
+      }
+    },
+    replaceChildren(...nodes: ThreadFakeElement[]) {
+      for (const child of element.children) child.parentElement = null;
+      element.children = [];
+      element.append(...nodes);
+    },
+    querySelector(selector: string) {
+      if (selector === '.thread-actions') return element.children.find((child) => child.className.split(/\s+/).includes('thread-actions')) ?? null;
+      return null;
+    },
+    querySelectorAll() {
+      return [];
+    },
+    setAttribute(name: string, value: string) {
+      if (name.startsWith('data-')) element.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())] = value;
+    },
+    addEventListener() {}
+  };
+  return element;
+}
+
+function installThreadRefreshDom(): void {
+  for (const element of Object.values(threadDom)) {
+    element.replaceChildren();
+    element.hidden = false;
+    element.textContent = '';
+    element.value = '';
+  }
+  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
+    detail: unknown;
+    constructor(_name: string, init: { detail?: unknown } = {}) {
+      this.detail = init.detail;
+    }
+  };
+  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {}, location: { pathname: '/specs' } };
+  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
+    callback(performance.now());
+    return 0;
+  };
+  const storage = new Map<string, string>();
+  (globalThis as unknown as { localStorage: unknown }).localStorage = {
+    getItem(key: string) {
+      return storage.get(key) ?? null;
+    },
+    setItem(key: string, value: string) {
+      storage.set(key, value);
+    }
+  };
+  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };
+  (globalThis as unknown as { document: unknown }).document = {
+    querySelector(selector: string) {
+      if (selector === '.telemetry-list') return threadDom.telemetryList;
+      if (selector === '.thread-panel') return threadDom.threadPanel;
+      if (selector === '.panel') return threadDom.panel;
+      if (selector === '.shell') return threadDom.shell;
+      if (selector === '.thread-target') return threadDom.threadTarget;
+      if (selector === '.thread-heading') return threadDom.threadHeading;
+      return null;
+    },
+    querySelectorAll() {
+      return [];
+    },
+    createElement() {
+      return threadElement();
+    }
+  };
+}
+
+async function flushThreadRefresh(): Promise<void> {
+  await Promise.resolve();
+  await new Promise((resolve) => setTimeout(resolve, 0));
+  await Promise.resolve();
+}
+
+test('ledger content refresh is deferred while voice recording is active', async () => {
+  installThreadRefreshDom();
+  const { requestLedgerContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
   const previousWindow = globalThis.window;
   const previousCustomEvent = globalThis.CustomEvent;
   (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
@@ -37,7 +184,9 @@ test('ledger content refresh is deferred while voice recording is active', () =>
   }
 });
 
-test('thread content refresh is deferred separately from canvas refresh while voice recording is active', () => {
+test('thread content refresh is deferred separately from canvas refresh while voice recording is active', async () => {
+  installThreadRefreshDom();
+  const { requestThreadContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
   const previousWindow = globalThis.window;
   const previousCustomEvent = globalThis.CustomEvent;
   (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
@@ -66,13 +215,72 @@ test('thread content refresh is deferred separately from canvas refresh while vo
   }
 });
 
+test('thread content refresh keeps newer selection made while same-ledger load is in flight', async () => {
+  installThreadRefreshDom();
+  const { requestThreadContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.pointer = null;
+  state.threadPanelOpen = false;
+  state.activeTool = 'select';
+  state.threadId = 'thread-card-a';
+  state.renderedThreadId = '';
+  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
+  state.activeLedger = {
+    cards: [
+      { id: 'card-a', title: 'A', x: 10, y: 20, w: 240, h: 132 },
+      { id: 'card-b', title: 'B', x: 100, y: 120, w: 240, h: 132 }
+    ],
+    annotations: [],
+    relationships: [],
+    notes: { 'thread-card-a': [{ id: 'note-a', role: 'operator', message: 'A' }] }
+  };
+
+  let resolveFetch!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
+  const fetchStarted = new Promise<void>((resolveStarted) => {
+    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
+      assert.equal(url, '/decision-os/specs');
+      resolveStarted();
+      return new Promise((resolve) => {
+        resolveFetch = resolve;
+      });
+    };
+  });
+
+  requestThreadContentRefresh('thread-content-change');
+  await fetchStarted;
+  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
+  resolveFetch({
+    ok: true,
+    async json() {
+      return {
+        cards: [
+          { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
+          { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 }
+        ],
+        annotations: [],
+        relationships: [],
+        notes: { 'thread-card-a': [{ id: 'server-note', role: 'agent', message: 'Fresh' }] }
+      };
+    }
+  });
+  await flushThreadRefresh();
+
+  assert.deepEqual(state.selection.cardIds, ['card-b']);
+});
+
 test('thread content events rerender the thread panel without remounting the canvas', () => {
   const refresh = source('frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts');
   assert.match(refresh, /const payload = contentEventPayload\(event\)/);
   assert.match(refresh, /payload\.kind === 'thread-content'/);
   assert.match(refresh, /requestThreadContentRefresh\('thread-content-change'\)/);
   assert.match(refresh, /renderThreadPanel\(\)/);
-  assert.match(refresh, /state\.selection = selection/);
+  assert.match(refresh, /const selection = cloneSelectionState\(state\.selection\)/);
+  assert.match(refresh, /selectionStatesEqual\(state\.selection, selection\)/);
+  assert.match(refresh, /state\.selection = cloneSelectionState\(selection\)/);
   assert.doesNotMatch(refresh, /thread-content-change'[\s\S]{0,260}renderCanvasSurface\(\)/);
 });
 
@@ -86,7 +294,9 @@ test('card content refresh resizes the changed card after the refreshed render',
   assert.match(refresh, /commitActiveLedgerMutation\(\{ action: 'patch-geometry', geometry \}, \{ render: true \}\)/);
 });
 
-test('changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file', () => {
+test('changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file', async () => {
+  installThreadRefreshDom();
+  const { changedCardIdForContentFile } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
   const previousLedger = state.activeLedger;
   state.activeLedger = {
     cards: [
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-21","timestamp":"2026-07-10T04:37:14.016Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"21","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_11","codexTool":"/usr/bin/zsh -lc \"git diff -- frontend/test/runtime/canvas-pan-performance.integration.test.ts | sed -n '1,900p'\ngit diff -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,920p'\ngit diff -- tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sed -n '1,360p'\""} -->

**Tool call** `/usr/bin/zsh -lc "git diff -- frontend/test/runtime/canvas-pan-performance.integration.test.ts | sed -n '1,900p'
git diff -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,920p'
git diff -- tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sed -n '1,360p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-22","timestamp":"2026-07-10T04:37:14.016Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"22","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_11","codexTool":"/usr/bin/zsh -lc \"git diff -- frontend/test/runtime/canvas-pan-performance.integration.test.ts | sed -n '1,900p'\ngit diff -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,920p'\ngit diff -- tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sed -n '1,360p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "git diff -- frontend/test/runtime/canvas-pan-performance.integration.test.ts | sed -n '1,900p'
git diff -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,920p'
git diff -- tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sed -n '1,360p'"`
Status: completed
Exit code: 0

````text
diff --git a/frontend/test/runtime/canvas-pan-performance.integration.test.ts b/frontend/test/runtime/canvas-pan-performance.integration.test.ts
index e14b266..153dae3 100644
--- a/frontend/test/runtime/canvas-pan-performance.integration.test.ts
+++ b/frontend/test/runtime/canvas-pan-performance.integration.test.ts
@@ -14,6 +14,494 @@ function source(path: string): string {
   return readFileSync(new URL(path, root), 'utf8');
 }
 
+type CanvasFakeStyle = Record<string, string> & {
+  setProperty(name: string, value: string): void;
+  getPropertyValue(name: string): string;
+  removeProperty(name: string): void;
+};
+
+type CanvasFakeElement = {
+  tagName: string;
+  id: string;
+  className: string;
+  dataset: Record<string, string>;
+  style: CanvasFakeStyle;
+  hidden: boolean;
+  textContent: string;
+  innerHTML: string;
+  type: string;
+  title: string;
+  ariaLabel: string;
+  value: string;
+  disabled: boolean;
+  scrollTop: number;
+  scrollLeft: number;
+  scrollHeight: number;
+  scrollWidth: number;
+  clientWidth: number;
+  clientHeight: number;
+  children: CanvasFakeElement[];
+  parentElement: CanvasFakeElement | null;
+  isConnected: boolean;
+  childElementCount: number;
+  offsetLeft: number;
+  offsetTop: number;
+  offsetWidth: number;
+  offsetHeight: number;
+  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
+  querySelector(selector: string): CanvasFakeElement | null;
+  querySelectorAll(selector: string): CanvasFakeElement[];
+  matches(selector: string): boolean;
+  closest(selector: string): CanvasFakeElement | null;
+  append(...nodes: CanvasFakeElement[]): void;
+  appendChild(node: CanvasFakeElement): CanvasFakeElement;
+  insertBefore(node: CanvasFakeElement, before: CanvasFakeElement | null): void;
+  replaceChildren(...nodes: CanvasFakeElement[]): void;
+  remove(): void;
+  setAttribute(name: string, value: string): void;
+  getAttribute(name: string): string | null;
+  hasAttribute(name: string): boolean;
+  removeAttribute(name: string): void;
+  addEventListener(): void;
+  removeEventListener(): void;
+  scrollTo(options?: unknown): void;
+  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number };
+};
+
+const canvasStorage = new Map<string, string>();
+const canvasDom = createCanvasRuntimeDom();
+
+function canvasElement(dataset: Record<string, string> = {}, tagName = 'div'): CanvasFakeElement {
+  const customProperties = new Map<string, string>();
+  const attributes = new Map<string, string>();
+  const style = {
+    left: '0px',
+    top: '0px',
+    width: '120px',
+    height: '80px',
+    minHeight: '',
+    display: '',
+    transition: '',
+    transform: '',
+    visibility: '',
+    right: '',
+    bottom: '',
+    maxWidth: '',
+    position: '',
+    zIndex: '',
+    boxSizing: '',
+    setProperty(name: string, value: string) {
+      customProperties.set(name, value);
+      style[name] = value;
+    },
+    getPropertyValue(name: string) {
+      return customProperties.get(name) ?? style[name] ?? '';
+    },
+    removeProperty(name: string) {
+      customProperties.delete(name);
+      delete style[name];
+    }
+  } as unknown as CanvasFakeStyle;
+  const element: CanvasFakeElement = {
+    tagName: tagName.toUpperCase(),
+    id: '',
+    className: '',
+    dataset,
+    style,
+    hidden: false,
+    textContent: '',
+    innerHTML: '',
+    type: '',
+    title: '',
+    ariaLabel: '',
+    value: '',
+    disabled: false,
+    scrollTop: 0,
+    scrollLeft: 0,
+    scrollHeight: 0,
+    scrollWidth: 0,
+    clientWidth: 120,
+    clientHeight: 80,
+    children: [],
+    parentElement: null,
+    isConnected: true,
+    get childElementCount() { return element.children.length; },
+    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
+    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
+    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
+    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
+    classList: {
+      toggle(name: string, force?: boolean) {
+        const classes = canvasClassSet(element);
+        const shouldAdd = force ?? !classes.has(name);
+        if (shouldAdd) classes.add(name);
+        else classes.delete(name);
+        element.className = [...classes].join(' ');
+        return shouldAdd;
+      },
+      add(...names: string[]) {
+        const classes = canvasClassSet(element);
+        for (const name of names) classes.add(name);
+        element.className = [...classes].join(' ');
+      },
+      remove(...names: string[]) {
+        const classes = canvasClassSet(element);
+        for (const name of names) classes.delete(name);
+        element.className = [...classes].join(' ');
+      },
+      contains(name: string) {
+        return canvasClassSet(element).has(name);
+      }
+    },
+    querySelector(selector: string) {
+      return element.querySelectorAll(selector)[0] ?? null;
+    },
+    querySelectorAll(selector: string) {
+      return canvasQueryAll(element, selector);
+    },
+    matches(selector: string) {
+      return canvasMatchesSelectorList(element, selector);
+    },
+    closest(selector: string) {
+      let current: CanvasFakeElement | null = element;
+      while (current) {
+        if (canvasMatchesSelectorList(current, selector)) return current;
+        current = current.parentElement;
+      }
+      return null;
+    },
+    append(...nodes: CanvasFakeElement[]) {
+      for (const node of nodes) canvasAppendChild(element, node);
+    },
+    appendChild(node: CanvasFakeElement) {
+      canvasAppendChild(element, node);
+      return node;
+    },
+    insertBefore(node: CanvasFakeElement, before: CanvasFakeElement | null) {
+      canvasDetach(node);
+      const index = before ? element.children.indexOf(before) : -1;
+      if (index >= 0) element.children.splice(index, 0, node);
+      else element.children.push(node);
+      node.parentElement = element;
+      canvasMarkConnected(node, true);
+    },
+    replaceChildren(...nodes: CanvasFakeElement[]) {
+      for (const child of element.children) {
+        child.parentElement = null;
+        canvasMarkConnected(child, false);
+      }
+      element.children = [];
+      element.append(...nodes);
+    },
+    remove() {
+      canvasDetach(element);
+      canvasMarkConnected(element, false);
+    },
+    setAttribute(name: string, value: string) {
+      attributes.set(name, value);
+      if (name === 'id') element.id = value;
+      if (name === 'class') element.className = value;
+      if (name.startsWith('data-')) element.dataset[canvasDataKey(name.slice(5))] = value;
+    },
+    getAttribute(name: string) {
+      if (name === 'id') return element.id || null;
+      if (name === 'class') return element.className || null;
+      if (name.startsWith('data-')) return element.dataset[canvasDataKey(name.slice(5))] ?? null;
+      return attributes.get(name) ?? null;
+    },
+    hasAttribute(name: string) {
+      if (name === 'id') return Boolean(element.id);
+      if (name === 'class') return Boolean(element.className);
+      if (name.startsWith('data-')) return element.dataset[canvasDataKey(name.slice(5))] !== undefined;
+      return attributes.has(name);
+    },
+    removeAttribute(name: string) {
+      attributes.delete(name);
+      if (name === 'id') element.id = '';
+      if (name === 'class') element.className = '';
+      if (name.startsWith('data-')) delete element.dataset[canvasDataKey(name.slice(5))];
+    },
+    addEventListener() {},
+    removeEventListener() {},
+    scrollTo(options?: unknown) {
+      const scroll = options as { left?: number; top?: number } | undefined;
+      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
+      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
+    },
+    getBoundingClientRect() {
+      return {
+        left: element.offsetLeft,
+        top: element.offsetTop,
+        right: element.offsetLeft + element.offsetWidth,
+        bottom: element.offsetTop + element.offsetHeight,
+        width: element.offsetWidth,
+        height: element.offsetHeight
+      };
+    }
+  };
+  return element;
+}
+
+function createCanvasRuntimeDom() {
+  const root = canvasElement({}, 'document');
+  const canvas = canvasElement({}, 'div');
+  const content = canvasElement({}, 'div');
+  const controlOverlay = canvasElement({}, 'div');
+  const mediaOverlay = canvasElement({}, 'div');
+  const telemetryList = canvasElement({}, 'ol');
+  const marquee = canvasElement({}, 'div');
+  const panel = canvasElement({}, 'aside');
+  const threadPanel = canvasElement({}, 'aside');
+  const shell = canvasElement({}, 'div');
+  const threadTarget = canvasElement({}, 'div');
+  const threadHeading = canvasElement({}, 'div');
+  const tabs = canvasElement({}, 'nav');
+  const topbarTitle = canvasElement({}, 'button');
+  const kicker = canvasElement({}, 'span');
+  canvas.className = 'canvas';
+  content.className = 'canvas-content';
+  controlOverlay.className = 'canvas-control-overlay';
+  mediaOverlay.className = 'canvas-media-overlay';
+  telemetryList.className = 'telemetry-list';
+  marquee.className = 'marquee';
+  panel.className = 'panel';
+  threadPanel.className = 'thread-panel';
+  shell.className = 'shell';
+  threadTarget.className = 'thread-target';
+  threadHeading.className = 'thread-heading';
+  tabs.className = 'tabs';
+  topbarTitle.className = 'topbar-title-action';
+  kicker.className = 'kicker';
+  root.append(canvas, telemetryList, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker);
+  canvas.append(content, controlOverlay, mediaOverlay);
+  content.append(marquee);
+  return { root, canvas, content, controlOverlay, mediaOverlay, telemetryList, marquee, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker };
+}
+
+function installCanvasRuntimeDom(): void {
+  canvasStorage.clear();
+  for (const element of Object.values(canvasDom)) {
+    element.children = [];
+    element.parentElement = null;
+    element.isConnected = true;
+    element.hidden = false;
+    element.textContent = '';
+    element.innerHTML = '';
+    element.style.left = '0px';
+    element.style.top = '0px';
+    element.style.width = '120px';
+    element.style.height = '80px';
+    element.style.minHeight = '';
+    element.style.display = '';
+    element.style.transition = '';
+    element.style.transform = '';
+    element.style.visibility = '';
+  }
+  canvasDom.canvas.className = 'canvas';
+  canvasDom.canvas.style.width = '1000px';
+  canvasDom.canvas.style.height = '800px';
+  canvasDom.content.className = 'canvas-content';
+  canvasDom.controlOverlay.className = 'canvas-control-overlay';
+  canvasDom.mediaOverlay.className = 'canvas-media-overlay';
+  canvasDom.telemetryList.className = 'telemetry-list';
+  canvasDom.marquee.className = 'marquee';
+  canvasDom.marquee.hidden = true;
+  canvasDom.panel.className = 'panel';
+  canvasDom.threadPanel.className = 'thread-panel';
+  canvasDom.shell.className = 'shell';
+  canvasDom.threadTarget.className = 'thread-target';
+  canvasDom.threadHeading.className = 'thread-heading';
+  canvasDom.tabs.className = 'tabs';
+  canvasDom.topbarTitle.className = 'topbar-title-action';
+  canvasDom.kicker.className = 'kicker';
+  canvasDom.root.append(canvasDom.canvas, canvasDom.telemetryList, canvasDom.panel, canvasDom.threadPanel, canvasDom.shell, canvasDom.threadTarget, canvasDom.threadHeading, canvasDom.tabs, canvasDom.topbarTitle, canvasDom.kicker);
+  canvasDom.canvas.append(canvasDom.content, canvasDom.controlOverlay, canvasDom.mediaOverlay);
+  canvasDom.content.append(canvasDom.marquee);
+
+  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
+    detail: unknown;
+    constructor(_type: string, init: { detail?: unknown } = {}) {
+      this.detail = init.detail;
+    }
+  };
+  (globalThis as unknown as { window: unknown }).window = {
+    innerWidth: 1000,
+    innerHeight: 800,
+    devicePixelRatio: 1,
+    __coreTelemetry: [],
+    location: { pathname: '/specs' },
+    addEventListener() {},
+    dispatchEvent() {},
+    visualViewport: { addEventListener() {} }
+  };
+  (globalThis as unknown as { document: unknown }).document = {
+    title: '',
+    fonts: { ready: Promise.resolve() },
+    activeElement: canvasElement(),
+    querySelector(selector: string) {
+      return canvasDom.root.querySelector(selector);
+    },
+    querySelectorAll(selector: string) {
+      return canvasDom.root.querySelectorAll(selector);
+    },
+    createElement(tagName: string) {
+      return canvasElement({}, tagName);
+    },
+    createTextNode(text: string) {
+      const node = canvasElement({}, '#text');
+      node.textContent = text;
+      return node;
+    },
+    createElementNS(_namespace: string, tagName: string) {
+      return canvasElement({}, tagName);
+    }
+  };
+  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: CanvasFakeElement) => ({
+    display: node.style.display || 'block',
+    color: node.style.color || '',
+    textShadow: node.style.textShadow || '',
+    getPropertyValue: (name: string) => node.style.getPropertyValue(name)
+  });
+  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
+    callback(performance.now());
+    return 0;
+  };
+  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
+    observe() {}
+    disconnect() {}
+  };
+  (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
+  (globalThis as unknown as { SVGElement: unknown }).SVGElement = class SVGElement {};
+  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
+  (globalThis as unknown as { localStorage: unknown }).localStorage = {
+    getItem(key: string) {
+      return canvasStorage.get(key) ?? null;
+    },
+    setItem(key: string, value: string) {
+      canvasStorage.set(key, String(value));
+    },
+    removeItem(key: string) {
+      canvasStorage.delete(key);
+    }
+  };
+}
+
+function canvasClassSet(element: CanvasFakeElement): Set<string> {
+  return new Set(element.className.split(/\s+/).filter(Boolean));
+}
+
+function canvasAppendChild(parent: CanvasFakeElement, child: CanvasFakeElement): void {
+  canvasDetach(child);
+  parent.children.push(child);
+  child.parentElement = parent;
+  canvasMarkConnected(child, true);
+}
+
+function canvasDetach(element: CanvasFakeElement): void {
+  const parent = element.parentElement;
+  if (!parent) return;
+  parent.children = parent.children.filter((child) => child !== element);
+  element.parentElement = null;
+}
+
+function canvasMarkConnected(element: CanvasFakeElement, connected: boolean): void {
+  element.isConnected = connected;
+  for (const child of element.children) canvasMarkConnected(child, connected);
+}
+
+function canvasDataKey(attribute: string): string {
+  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
+}
+
+function canvasDescendants(element: CanvasFakeElement): CanvasFakeElement[] {
+  return element.children.flatMap((child) => [child, ...canvasDescendants(child)]);
+}
+
+function canvasQueryAll(rootElement: CanvasFakeElement, selector: string): CanvasFakeElement[] {
+  const matches: CanvasFakeElement[] = [];
+  const seen = new Set<CanvasFakeElement>();
+  for (const rawPart of selector.split(',')) {
+    const part = rawPart.trim();
+    if (!part) continue;
+    const direct = part.startsWith(':scope > ');
+    const normalized = part.replace(/^:scope\s*>\s*/, '').trim();
+    const candidates = direct ? rootElement.children : canvasDescendants(rootElement);
+    for (const candidate of candidates) {
+      if (seen.has(candidate)) continue;
+      if (canvasMatchesSelector(candidate, normalized)) {
+        seen.add(candidate);
+        matches.push(candidate);
+      }
+    }
+  }
+  return matches;
+}
+
+function canvasMatchesSelectorList(element: CanvasFakeElement, selector: string): boolean {
+  return selector.split(',').some((part) => canvasMatchesSelector(element, part.trim()));
+}
+
+function canvasMatchesSelector(element: CanvasFakeElement, selector: string): boolean {
+  if (!selector) return false;
+  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
+  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
+  remaining = remaining.replace(/:not\([^)]+\)/g, '');
+  if (notMatches.some((notSelector) => canvasMatchesSelector(element, notSelector))) return false;
+
+  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
+  if (idMatch && element.id !== idMatch[1]) return false;
+  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');
+
+  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
+  const classes = canvasClassSet(element);
+  if (classMatches.some((className) => !classes.has(className))) return false;
+  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');
+
+  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
+  for (const [, attribute, expected] of attributeMatches) {
+    const actual = attribute.startsWith('data-') ? element.dataset[canvasDataKey(attribute.slice(5))] : element.getAttribute(attribute);
+    if (expected === undefined) {
+      if (actual === undefined || actual === null) return false;
+    } else if (actual !== expected) return false;
+  }
+  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();
+
+  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
+  return true;
+}
+
+function canvasPointerEvent(clientX: number, clientY: number, pointerId = 1): PointerEvent {
+  return {
+    target: canvasDom.canvas,
+    clientX,
+    clientY,
+    pointerId,
+    button: 0,
+    buttons: 1,
+    shiftKey: false,
+    ctrlKey: false,
+    preventDefault() {},
+    stopPropagation() {}
+  } as unknown as PointerEvent;
+}
+
+function canvasWheelEvent(input: { clientX: number; clientY: number; deltaX?: number; deltaY: number; ctrlKey?: boolean }): WheelEvent {
+  return {
+    target: canvasDom.canvas,
+    clientX: input.clientX,
+    clientY: input.clientY,
+    deltaX: input.deltaX ?? 0,
+    deltaY: input.deltaY,
+    ctrlKey: input.ctrlKey ?? false,
+    preventDefault() {},
+    stopPropagation() {}
+  } as unknown as WheelEvent;
+}
+
+async function waitForTimer(ms: number): Promise<void> {
+  await new Promise((resolve) => setTimeout(resolve, ms));
+}
+
 test('canvas pan uses a transform-only path with sampled performance telemetry', () => {
   const pointerMove = source('frontend/src/runtime/gesture/controller/handle-pointer-move.ts');
   const panTransform = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
@@ -131,11 +619,134 @@ test('plain pan pointer up does not force a full canvas rerender', () => {
   const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
   assert.match(pointerUp, /const pointerIntent = pointerSession\.intent/);
   assert.match(pointerUp, /let releaseRendered = false/);
-  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(\)/);
+  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(gestureSelection\)/);
   assert.match(pointerUp, /if \(pointerIntent !== 'pan' && !releaseRendered\) renderCanvasSurface\(\)/);
   assert.match(pointerUp, /isClickMovement\(moved\)/);
 });
 
+test('manual runtime refresh preserves an active pan pointer and allows pan to continue', async () => {
+  installCanvasRuntimeDom();
+  const { refreshRuntimeState } = await import('../../src/runtime/refresh/controller/refresh-runtime-state.js');
+  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
+  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.ledgers = state.ledgerTabs;
+  state.activeTool = 'select';
+  state.threadPanelOpen = false;
+  state.viewport = { x: 10, y: 20, scale: 1 };
+  state.viewports = { specs: { x: 10, y: 20, scale: 1 } };
+  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
+  state.pointer = {
+    intent: 'pan',
+    targetKind: 'canvas',
+    targetId: '',
+    target: canvasDom.canvas,
+    resizeHandle: null,
+    start: { x: 100, y: 100 },
+    current: { x: 100, y: 100 },
+    startCanvas: { x: 100, y: 100 },
+    currentCanvas: { x: 100, y: 100 },
+    startedAt: 0
+  };
+
+  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
+  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
+    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
+      if (url === '/decision-os/data') return { ok: true, async json() { return {}; } };
+      assert.equal(url, '/decision-os/specs');
+      resolveStarted();
+      return new Promise((resolve) => {
+        resolveLedger = resolve;
+      });
+    };
+  });
+
+  const refresh = refreshRuntimeState();
+  await ledgerFetchStarted;
+  resolveLedger({
+    ok: true,
+    async json() {
+      return { cards: [], annotations: [], relationships: [], notes: {} };
+    }
+  });
+  await refresh;
+
+  assert.equal(state.pointer.intent, 'pan');
+  handlePointerMove(canvasPointerEvent(130, 90));
+
+  assert.deepEqual(state.viewport, { x: 40, y: 10, scale: 1 });
+  assert.equal(canvasDom.content.style.transform, 'translate(40px, 10px) scale(1)');
+
+  await handlePointerUp(canvasPointerEvent(130, 90));
+
+  assert.equal(state.pointer, null);
+  assert.deepEqual(JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}').viewport, { x: 40, y: 10, scale: 1 });
+});
+
+test('wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence', async () => {
+  installCanvasRuntimeDom();
+  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
+  const { handleWheel } = await import('../../src/runtime/gesture/controller/handle-wheel.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.ledgers = state.ledgerTabs;
+  state.activeTool = 'select';
+  state.threadPanelOpen = false;
+  state.viewport = { x: 0, y: 0, scale: 1 };
+  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
+  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  state.pointer = null;
+  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
+
+  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
+  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
+    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
+      assert.equal(url, '/decision-os/specs');
+      resolveStarted();
+      return new Promise((resolve) => {
+        resolveLedger = resolve;
+      });
+    };
+  });
+
+  const load = loadActiveLedgerState();
+  await ledgerFetchStarted;
+
+  handleWheel(canvasWheelEvent({ clientX: 100, clientY: 80, deltaY: -120 }));
+  const latestViewport = { ...state.viewport };
+  assert.ok(latestViewport.scale > 1);
+
+  resolveLedger({
+    ok: true,
+    async json() {
+      return {
+        viewport: { x: 999, y: 999, scale: 0.25 },
+        cards: [],
+        annotations: [],
+        relationships: [],
+        notes: {}
+      };
+    }
+  });
+  await load;
+
+  assert.deepEqual(state.viewport, latestViewport);
+  assert.deepEqual(state.viewports.specs, latestViewport);
+
+  await waitForTimer(170);
+  const persisted = JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}');
+  assert.deepEqual(persisted.viewport, latestViewport);
+  assert.deepEqual(persisted.viewports.specs, latestViewport);
+});
+
 test('wheel zoom stays transform-only and does not reroute relationships', () => {
   const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
   const scheduler = source('frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts');
diff --git a/frontend/test/runtime/drag-release-freeze.integration.test.ts b/frontend/test/runtime/drag-release-freeze.integration.test.ts
index c033a23..b0eed59 100644
--- a/frontend/test/runtime/drag-release-freeze.integration.test.ts
+++ b/frontend/test/runtime/drag-release-freeze.integration.test.ts
@@ -6,75 +6,241 @@ import test from 'node:test';
 import assert from 'node:assert/strict';
 
 type FakeElement = {
+  tagName: string;
+  id: string;
+  className: string;
   dataset: Record<string, string>;
   style: {
     left: string;
     top: string;
     width: string;
     height: string;
+    minHeight: string;
     display: string;
+    transition: string;
+    transform: string;
+    visibility: string;
+    color: string;
+    textShadow: string;
     setProperty(name: string, value: string): void;
     getPropertyValue(name: string): string;
+    removeProperty(name: string): void;
   };
   hidden: boolean;
+  textContent: string;
+  innerHTML: string;
+  type: string;
+  title: string;
+  ariaLabel: string;
+  value: string;
+  disabled: boolean;
+  scrollTop: number;
+  scrollLeft: number;
+  scrollHeight: number;
+  scrollWidth: number;
+  clientWidth: number;
+  clientHeight: number;
   childElementCount: number;
+  children: FakeElement[];
   offsetLeft: number;
   offsetTop: number;
   offsetWidth: number;
   offsetHeight: number;
   parentElement: FakeElement | null;
-  classList: { toggle(): void; add(): void; remove(): void; contains(): boolean };
+  isConnected: boolean;
+  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
   querySelector(selector: string): FakeElement | null;
   querySelectorAll(selector: string): FakeElement[];
-  append(node: FakeElement): void;
-  appendChild(node: FakeElement): void;
+  matches(selector: string): boolean;
+  closest(selector: string): FakeElement | null;
+  append(...nodes: FakeElement[]): void;
+  appendChild(node: FakeElement): FakeElement;
   insertBefore(node: FakeElement, before: FakeElement | null): void;
-  replaceChildren(): void;
+  replaceChildren(...nodes: FakeElement[]): void;
+  remove(): void;
   setAttribute(name: string, value: string): void;
+  getAttribute(name: string): string | null;
+  hasAttribute(name: string): boolean;
+  removeAttribute(name: string): void;
+  addEventListener(): void;
+  removeEventListener(): void;
+  blur(): void;
+  scrollTo(options?: unknown): void;
   getBoundingClientRect(): { left: number; top: number; width: number; height: number };
 };
 
-function fakeElement(dataset: Record<string, string> = {}): FakeElement {
+type RuntimeDom = {
+  root: FakeElement;
+  canvas: FakeElement;
+  content: FakeElement;
+  controlOverlay: FakeElement;
+  mediaOverlay: FakeElement;
+  telemetryList: FakeElement;
+  marquee: FakeElement;
+  panel: FakeElement;
+  threadPanel: FakeElement;
+  shell: FakeElement;
+  threadTarget: FakeElement;
+  threadHeading: FakeElement;
+  tabs: FakeElement;
+  topbarTitle: FakeElement;
+  kicker: FakeElement;
+};
+
+const runtimeDom = createRuntimeDom();
+
+function fakeElement(dataset: Record<string, string> = {}, tagName = 'div'): FakeElement {
   const customProperties = new Map<string, string>();
+  const attributes = new Map<string, string>();
+  const style = {
+    left: '0px',
+    top: '0px',
+    width: '120px',
+    height: '80px',
+    minHeight: '',
+    display: '',
+    transition: '',
+    transform: '',
+    visibility: '',
+    color: '',
+    textShadow: '',
+    setProperty(name: string, value: string) {
+      customProperties.set(name, value);
+    },
+    getPropertyValue(name: string) {
+      return customProperties.get(name) ?? '';
+    },
+    removeProperty(name: string) {
+      customProperties.delete(name);
+    }
+  };
   const element: FakeElement = {
+    tagName: tagName.toUpperCase(),
+    id: '',
+    className: '',
     dataset,
-    style: {
-      left: '0px',
-      top: '0px',
-      width: '120px',
-      height: '80px',
-      display: '',
-      setProperty(name: string, value: string) {
-        customProperties.set(name, value);
-      },
-      getPropertyValue(name: string) {
-        return customProperties.get(name) ?? '';
-      }
-    },
+    style,
     hidden: false,
-    childElementCount: 0,
+    textContent: '',
+    innerHTML: '',
+    type: '',
+    title: '',
+    ariaLabel: '',
+    value: '',
+    disabled: false,
+    scrollTop: 0,
+    scrollLeft: 0,
+    scrollHeight: 0,
+    scrollWidth: 0,
+    clientWidth: 120,
+    clientHeight: 80,
+    children: [],
     parentElement: null,
-    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
+    isConnected: true,
+    get childElementCount() { return element.children.length; },
     get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
     get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
     get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
     get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
-    querySelector() { return null; },
-    querySelectorAll() { return []; },
-    append(node: FakeElement) {
-      node.parentElement = element;
-      element.childElementCount += 1;
+    classList: {
+      toggle(name: string, force?: boolean) {
+        const classes = classSet(element);
+        const shouldAdd = force ?? !classes.has(name);
+        if (shouldAdd) classes.add(name);
+        else classes.delete(name);
+        element.className = [...classes].join(' ');
+        return shouldAdd;
+      },
+      add(...names: string[]) {
+        const classes = classSet(element);
+        for (const name of names) classes.add(name);
+        element.className = [...classes].join(' ');
+      },
+      remove(...names: string[]) {
+        const classes = classSet(element);
+        for (const name of names) classes.delete(name);
+        element.className = [...classes].join(' ');
+      },
+      contains(name: string) {
+        return classSet(element).has(name);
+      }
+    },
+    querySelector(selector: string) {
+      return element.querySelectorAll(selector)[0] ?? null;
+    },
+    querySelectorAll(selector: string) {
+      return queryAll(element, selector);
+    },
+    matches(selector: string) {
+      return matchesSelectorList(element, selector);
+    },
+    closest(selector: string) {
+      let current: FakeElement | null = element;
+      while (current) {
+        if (matchesSelectorList(current, selector)) return current;
+        current = current.parentElement;
+      }
+      return null;
+    },
+    append(...nodes: FakeElement[]) {
+      for (const node of nodes) appendChildElement(element, node);
     },
     appendChild(node: FakeElement) {
-      element.append(node);
+      appendChildElement(element, node);
+      return node;
+    },
+    insertBefore(node: FakeElement, before: FakeElement | null) {
+      detach(node);
+      const index = before ? element.children.indexOf(before) : -1;
+      if (index >= 0) element.children.splice(index, 0, node);
+      else element.children.push(node);
+      node.parentElement = element;
+      markConnected(node, true);
     },
-    insertBefore(node: FakeElement) {
-      element.append(node);
+    replaceChildren(...nodes: FakeElement[]) {
+      for (const child of element.children) {
+        child.parentElement = null;
+        markConnected(child, false);
+      }
+      element.children = [];
+      element.append(...nodes);
     },
-    replaceChildren() {
-      element.childElementCount = 0;
+    remove() {
+      detach(element);
+      markConnected(element, false);
+    },
+    setAttribute(name: string, value: string) {
+      attributes.set(name, value);
+      if (name === 'id') element.id = value;
+      if (name === 'class') element.className = value;
+      if (name.startsWith('data-')) element.dataset[dataKey(name.slice(5))] = value;
+    },
+    getAttribute(name: string) {
+      if (name === 'id') return element.id || null;
+      if (name === 'class') return element.className || null;
+      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] ?? null;
+      return attributes.get(name) ?? null;
+    },
+    hasAttribute(name: string) {
+      if (name === 'id') return Boolean(element.id);
+      if (name === 'class') return Boolean(element.className);
+      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] !== undefined;
+      return attributes.has(name);
+    },
+    removeAttribute(name: string) {
+      attributes.delete(name);
+      if (name === 'id') element.id = '';
+      if (name === 'class') element.className = '';
+      if (name.startsWith('data-')) delete element.dataset[dataKey(name.slice(5))];
+    },
+    addEventListener() {},
+    removeEventListener() {},
+    blur() {},
+    scrollTo(options?: unknown) {
+      const scroll = options as { left?: number; top?: number } | undefined;
+      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
+      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
     },
-    setAttribute() {},
     getBoundingClientRect() {
       return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
     }
@@ -82,55 +248,278 @@ function fakeElement(dataset: Record<string, string> = {}): FakeElement {
   return element;
 }
 
-test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
+function createRuntimeDom(): RuntimeDom {
+  const root = fakeElement({}, 'document');
+  const canvas = fakeElement({}, 'div');
+  const content = fakeElement({}, 'div');
+  const controlOverlay = fakeElement({}, 'div');
+  const mediaOverlay = fakeElement({}, 'div');
+  const telemetryList = fakeElement({}, 'ol');
+  const marquee = fakeElement({}, 'div');
+  const panel = fakeElement({}, 'aside');
+  const threadPanel = fakeElement({}, 'aside');
+  const shell = fakeElement({}, 'div');
+  const threadTarget = fakeElement({}, 'div');
+  const threadHeading = fakeElement({}, 'div');
+  const tabs = fakeElement({}, 'nav');
+  const topbarTitle = fakeElement({}, 'button');
+  const kicker = fakeElement({}, 'span');
+  canvas.className = 'canvas';
+  content.className = 'canvas-content';
+  controlOverlay.className = 'canvas-control-overlay';
+  mediaOverlay.className = 'canvas-media-overlay';
+  telemetryList.className = 'telemetry-list';
+  marquee.className = 'marquee';
+  panel.className = 'panel';
+  threadPanel.className = 'thread-panel';
+  shell.className = 'shell';
+  threadTarget.className = 'thread-target';
+  threadHeading.className = 'thread-heading';
+  tabs.className = 'tabs';
+  topbarTitle.className = 'topbar-title-action';
+  kicker.className = 'kicker';
+  root.append(canvas, telemetryList, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker);
+  canvas.append(content, controlOverlay, mediaOverlay);
+  content.append(marquee);
+  return { root, canvas, content, controlOverlay, mediaOverlay, telemetryList, marquee, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker };
+}
+
+function installRuntimeDom(): RuntimeDom {
+  resetRuntimeDom();
   (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
     detail: unknown;
     constructor(_type: string, init: { detail?: unknown } = {}) {
       this.detail = init.detail;
     }
   };
-  const canvas = fakeElement();
-  const content = fakeElement();
-  const card = fakeElement({ cardId: 'card-a' });
-  const created: FakeElement[] = [];
-  card.style.left = '20px';
-  card.style.top = '20px';
-  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
-  content.querySelector = (selector: string) => selector === ':scope > .zone-label-overlay' ? null : null;
-  content.querySelectorAll = () => [];
-
   (globalThis as unknown as { window: unknown }).window = {
     innerWidth: 1000,
     innerHeight: 800,
+    devicePixelRatio: 1,
     __coreTelemetry: [],
     location: { pathname: '/specs' },
     addEventListener() {},
     dispatchEvent() {},
     visualViewport: { addEventListener() {} }
   };
-  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({ display: 'block', getPropertyValue: () => '' });
-  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = () => 0;
-  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };
+  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: FakeElement) => ({
+    display: node.style.display || 'block',
+    color: node.style.color || '',
+    textShadow: node.style.textShadow || '',
+    getPropertyValue: (name: string) => node.style.getPropertyValue(name)
+  });
+  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
+    callback(performance.now());
+    return 0;
+  };
+  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
+    observe() {}
+    disconnect() {}
+  };
+  (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
+  (globalThis as unknown as { SVGElement: unknown }).SVGElement = class SVGElement {};
+  (globalThis as unknown as { SVGSVGElement: unknown }).SVGSVGElement = class SVGSVGElement {};
+  (globalThis as unknown as { SVGPathElement: unknown }).SVGPathElement = class SVGPathElement {};
+  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
+  const storage = new Map<string, string>();
+  (globalThis as unknown as { localStorage: unknown }).localStorage = {
+    getItem(key: string) {
+      return storage.get(key) ?? null;
+    },
+    setItem(key: string, value: string) {
+      storage.set(key, String(value));
+    },
+    removeItem(key: string) {
+      storage.delete(key);
+    }
+  };
   (globalThis as unknown as { document: unknown }).document = {
+    title: '',
+    fonts: { ready: Promise.resolve() },
+    activeElement: fakeElement(),
     querySelector(selector: string) {
-      if (selector === '.canvas') return canvas;
-      if (selector === '.canvas-content') return content;
-      if (selector === '[data-card-id="card-a"]') return card;
-      return null;
+      return runtimeDom.root.querySelector(selector);
     },
     querySelectorAll(selector: string) {
-      if (selector === '[data-card-id]') return [card];
-      return [];
+      return runtimeDom.root.querySelectorAll(selector);
     },
-    createElement() {
-      const element = fakeElement();
-      created.push(element);
-      return element;
+    createElement(tagName: string) {
+      return fakeElement({}, tagName);
     },
-    createElementNS() {
-      return fakeElement();
+    createTextNode(text: string) {
+      const node = fakeElement({}, '#text');
+      node.textContent = text;
+      return node;
+    },
+    createElementNS(_namespace: string, tagName: string) {
+      return fakeElement({}, tagName);
     }
   };
+  return runtimeDom;
+}
+
+function resetRuntimeDom(): void {
+  for (const element of Object.values(runtimeDom)) {
+    element.children = [];
+    element.parentElement = null;
+    element.isConnected = true;
+    element.hidden = false;
+    element.textContent = '';
+    element.innerHTML = '';
+    element.style.left = '0px';
+    element.style.top = '0px';
+    element.style.width = '120px';
+    element.style.height = '80px';
+    element.style.minHeight = '';
+    element.style.display = '';
+    element.style.transition = '';
+    element.style.transform = '';
+    element.style.visibility = '';
+  }
+  runtimeDom.canvas.className = 'canvas';
+  runtimeDom.canvas.style.width = '1000px';
+  runtimeDom.canvas.style.height = '800px';
+  runtimeDom.content.className = 'canvas-content';
+  runtimeDom.controlOverlay.className = 'canvas-control-overlay';
+  runtimeDom.mediaOverlay.className = 'canvas-media-overlay';
+  runtimeDom.telemetryList.className = 'telemetry-list';
+  runtimeDom.marquee.className = 'marquee';
+  runtimeDom.marquee.hidden = true;
+  runtimeDom.panel.className = 'panel';
+  runtimeDom.threadPanel.className = 'thread-panel';
+  runtimeDom.shell.className = 'shell';
+  runtimeDom.threadTarget.className = 'thread-target';
+  runtimeDom.threadHeading.className = 'thread-heading';
+  runtimeDom.tabs.className = 'tabs';
+  runtimeDom.topbarTitle.className = 'topbar-title-action';
+  runtimeDom.kicker.className = 'kicker';
+  runtimeDom.root.append(runtimeDom.canvas, runtimeDom.telemetryList, runtimeDom.panel, runtimeDom.threadPanel, runtimeDom.shell, runtimeDom.threadTarget, runtimeDom.threadHeading, runtimeDom.tabs, runtimeDom.topbarTitle, runtimeDom.kicker);
+  runtimeDom.canvas.append(runtimeDom.content, runtimeDom.controlOverlay, runtimeDom.mediaOverlay);
+  runtimeDom.content.append(runtimeDom.marquee);
+}
+
+function classSet(element: FakeElement): Set<string> {
+  return new Set(element.className.split(/\s+/).filter(Boolean));
+}
+
+function appendChildElement(parent: FakeElement, child: FakeElement): void {
+  detach(child);
+  parent.children.push(child);
+  child.parentElement = parent;
+  markConnected(child, true);
+}
+
+function detach(element: FakeElement): void {
+  const parent = element.parentElement;
+  if (!parent) return;
+  parent.children = parent.children.filter((child) => child !== element);
+  element.parentElement = null;
+}
+
+function markConnected(element: FakeElement, connected: boolean): void {
+  element.isConnected = connected;
+  for (const child of element.children) markConnected(child, connected);
+}
+
+function dataKey(attribute: string): string {
+  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
+}
+
+function descendants(element: FakeElement): FakeElement[] {
+  return element.children.flatMap((child) => [child, ...descendants(child)]);
+}
+
+function queryAll(root: FakeElement, selector: string): FakeElement[] {
+  const matches: FakeElement[] = [];
+  const seen = new Set<FakeElement>();
+  for (const rawPart of selector.split(',')) {
+    const part = rawPart.trim();
+    if (!part) continue;
+    const direct = part.startsWith(':scope > ');
+    const normalized = part.replace(/^:scope\s*>\s*/, '').trim();
+    const candidates = direct ? root.children : descendants(root);
+    for (const candidate of candidates) {
+      if (seen.has(candidate)) continue;
+      if (matchesSelector(candidate, normalized)) {
+        seen.add(candidate);
+        matches.push(candidate);
+      }
+    }
+  }
+  return matches;
+}
+
+function matchesSelectorList(element: FakeElement, selector: string): boolean {
+  return selector.split(',').some((part) => matchesSelector(element, part.trim()));
+}
+
+function matchesSelector(element: FakeElement, selector: string): boolean {
+  if (!selector) return false;
+  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
+  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
+  remaining = remaining.replace(/:not\([^)]+\)/g, '');
+  if (notMatches.some((notSelector) => matchesSelector(element, notSelector))) return false;
+
+  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
+  if (idMatch && element.id !== idMatch[1]) return false;
+  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');
+
+  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
+  const classes = classSet(element);
+  if (classMatches.some((className) => !classes.has(className))) return false;
+  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');
+
+  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
+  for (const [, attribute, expected] of attributeMatches) {
+    const actual = attribute.startsWith('data-') ? element.dataset[dataKey(attribute.slice(5))] : element.getAttribute(attribute);
+    if (expected === undefined) {
+      if (actual === undefined || actual === null) return false;
+    } else if (actual !== expected) return false;
+  }
+  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();
+
+  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
+  return true;
+}
+
+function pointerEvent(input: { target?: FakeElement; clientX: number; clientY: number; pointerId?: number; shiftKey?: boolean; ctrlKey?: boolean; button?: number; buttons?: number }): PointerEvent {
+  return {
+    target: input.target ?? runtimeDom.canvas,
+    clientX: input.clientX,
+    clientY: input.clientY,
+    pointerId: input.pointerId ?? 1,
+    shiftKey: input.shiftKey ?? false,
+    ctrlKey: input.ctrlKey ?? false,
+    button: input.button ?? 0,
+    buttons: input.buttons ?? 1,
+    preventDefault() {},
+    stopPropagation() {}
+  } as unknown as PointerEvent;
+}
+
+function appendLedgerCard(id: string, x: number, y: number, width = 240, height = 132): FakeElement {
+  const card = fakeElement({ cardId: id }, 'article');
+  card.className = 'card ledger-node';
+  card.style.left = `${x}px`;
+  card.style.top = `${y}px`;
+  card.style.width = `${width}px`;
+  card.style.height = `${height}px`;
+  runtimeDom.content.insertBefore(card, runtimeDom.marquee);
+  return card;
+}
+
+async function flushAsync(): Promise<void> {
+  await Promise.resolve();
+  await new Promise((resolve) => setTimeout(resolve, 0));
+  await Promise.resolve();
+}
+
+test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
+  const { canvas, content } = installRuntimeDom();
+  const card = appendLedgerCard('card-a', 20, 20, 120, 80);
+  card.style.left = '20px';
+  card.style.top = '20px';
+  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
 
   const calls: RequestInit[] = [];
   (globalThis as unknown as { fetch: unknown }).fetch = (_url: string, init: RequestInit) => {
@@ -171,5 +560,226 @@ test('card drag release clears pointer before slow geometry commit can accept la
 
   assert.equal(card.offsetLeft, 25);
   assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);
-  assert.ok(created.length >= 0);
+  assert.ok(content.childElementCount >= 1);
+});
+
+test('active card drag keeps pointer snapshot through same-ledger load and commits the original target', async () => {
+  installRuntimeDom();
+  const cardA = appendLedgerCard('card-a', 20, 20);
+  appendLedgerCard('card-b', 200, 20);
+  const patchBodies: Array<Record<string, any>> = [];
+
+  const { state } = await import('../../src/runtime/state.js');
+  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
+  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
+  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
+  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTool = 'select';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.viewport = { x: 0, y: 0, scale: 1 };
+  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
+  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  state.pointer = null;
+  state.activeLedger = {
+    cards: [
+      { id: 'card-a', title: 'A', x: 20, y: 20, w: 240, h: 132 },
+      { id: 'card-b', title: 'B', x: 200, y: 20, w: 240, h: 132 }
+    ],
+    annotations: [],
+    relationships: [],
+    notes: {}
+  };
+
+  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
+    assert.equal(url, '/decision-os/specs');
+    if (init?.method === 'PATCH') {
+      const body = JSON.parse(String(init.body ?? '{}'));
+      patchBodies.push(body);
+      return {
+        ok: true,
+        async json() {
+          return structuredClone(state.activeLedger);
+        }
+      };
+    }
+    return {
+      ok: true,
+      async json() {
+        return {
+          cards: [
+            { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
+            { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 }
+          ],
+          annotations: [],
+          relationships: [],
+          notes: {}
+        };
+      }
+    };
+  };
+
+  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
+  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);
+
+  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
+  await loadActiveLedgerState();
+
+  assert.deepEqual(state.selection.cardIds, ['card-a']);
+  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);
+
+  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
+  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
+  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));
+
+  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a']);
+  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 80);
+  assert.equal(patchBodies[0].geometry.cards['card-b'], undefined);
+});
+
+test('multi-selection drag survives ledger content refresh and commits only the pointer snapshot', async () => {
+  installRuntimeDom();
+  const cardA = appendLedgerCard('card-a', 10, 10);
+  appendLedgerCard('card-b', 100, 10);
+  appendLedgerCard('card-c', 300, 10);
+  const patchBodies: Array<Record<string, any>> = [];
+  let resolveLoad!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
+  const loadStarted = new Promise<void>((resolveStarted) => {
+    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
+      assert.equal(url, '/decision-os/specs');
+      if (init?.method === 'PATCH') {
+        const body = JSON.parse(String(init.body ?? '{}'));
+        patchBodies.push(body);
+        return {
+          ok: true,
+          async json() {
+            return structuredClone(state.activeLedger);
+          }
+        };
+      }
+      resolveStarted();
+      return new Promise((resolve) => {
+        resolveLoad = resolve;
+      });
+    };
+  });
+
+  const { state } = await import('../../src/runtime/state.js');
+  const { requestLedgerContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
+  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
+  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
+  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTool = 'select';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.viewport = { x: 0, y: 0, scale: 1 };
+  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
+  state.selection = { cardIds: ['card-a', 'card-b'], zoneIds: [], groupIds: [] };
+  state.pointer = null;
+  state.activeLedger = {
+    cards: [
+      { id: 'card-a', title: 'A', x: 10, y: 10, w: 240, h: 132 },
+      { id: 'card-b', title: 'B', x: 100, y: 10, w: 240, h: 132 },
+      { id: 'card-c', title: 'C', x: 300, y: 10, w: 240, h: 132 }
+    ],
+    annotations: [],
+    relationships: [],
+    notes: {}
+  };
+
+  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
+  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a', 'card-b']);
+
+  handlePointerMove(pointerEvent({ target: cardA, clientX: 30, clientY: 0 }));
+  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
+  requestLedgerContentRefresh('card-content-change');
+  await loadStarted;
+  resolveLoad({
+    ok: true,
+    async json() {
+      return {
+        cards: [
+          { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
+          { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 },
+          { id: 'card-c', title: 'Server C', x: 5, y: 6, w: 220, h: 132 }
+        ],
+        annotations: [],
+        relationships: [],
+        notes: {}
+      };
+    }
+  });
+  await flushAsync();
+
+  assert.deepEqual(state.selection.cardIds, ['card-a', 'card-b']);
+  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
+  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
+  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));
+
+  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a', 'card-b']);
+  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 70);
+  assert.equal(patchBodies[0].geometry.cards['card-b'].x, 160);
+  assert.equal(patchBodies[0].geometry.cards['card-c'], undefined);
+});
+
+test('card resize resolves the current remounted node and commits pointer target geometry', async () => {
+  installRuntimeDom();
+  const originalCard = appendLedgerCard('card-a', 40, 50, 240, 150);
+  const resizeHandle = fakeElement({}, 'div');
+  resizeHandle.className = 'resize-handle se';
+  originalCard.append(resizeHandle);
+  const patchBodies: Array<Record<string, any>> = [];
+
+  const { state } = await import('../../src/runtime/state.js');
+  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
+  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
+  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTool = 'select';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.viewport = { x: 0, y: 0, scale: 1 };
+  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
+  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  state.pointer = null;
+  state.activeLedger = {
+    cards: [{ id: 'card-a', title: 'A', x: 40, y: 50, w: 240, h: 150 }],
+    annotations: [],
+    relationships: [],
+    notes: {}
+  };
+
+  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
+    assert.equal(url, '/decision-os/specs');
+    const body = JSON.parse(String(init?.body ?? '{}'));
+    patchBodies.push(body);
+    return {
+      ok: true,
+      async json() {
+        return structuredClone(state.activeLedger);
+      }
+    };
+  };
+
+  handlePointerDown(pointerEvent({ target: resizeHandle, clientX: 0, clientY: 0 }));
+  originalCard.remove();
+  const remountedCard = appendLedgerCard('card-a', 40, 50, 240, 150);
+
+  handlePointerMove(pointerEvent({ target: remountedCard, clientX: 40, clientY: 20 }));
+  await handlePointerUp(pointerEvent({ target: remountedCard, clientX: 40, clientY: 20 }));
+
+  assert.equal(originalCard.style.width, '240px');
+  assert.equal(remountedCard.style.width, '280px');
+  assert.equal(remountedCard.style.height, '170px');
+  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a']);
+  assert.equal(patchBodies[0].geometry.cards['card-a'].width, 280);
+  assert.equal(patchBodies[0].geometry.cards['card-a'].height, 170);
 });
diff --git a/tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts b/tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
index baab365..88aa50a 100644
--- a/tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
+++ b/tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
@@ -1,11 +1,233 @@
 /**
- * WHAT: Integration test for spec 9d1b7c36: The refresh system preserves canvas continuity during operator work..
- * WHY: Each scoped master-ledger spec must have one executable suite.
+ * WHAT: Browser interaction proof for spec 9d1b7c36: The refresh system preserves canvas continuity during operator work.
+ * WHY: Refresh during an active drag must not change the card id committed on release.
  */
 
+import assert from 'node:assert/strict';
+import { spawn, type ChildProcess } from 'node:child_process';
+import { existsSync, readFileSync } from 'node:fs';
+import { createServer } from 'node:net';
+import { dirname, resolve } from 'node:path';
 import test from 'node:test';
-import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';
+import { fileURLToPath } from 'node:url';
+import { chromium, type Browser, type Page } from '@playwright/test';
+
+type LedgerCard = {
+  id?: string;
+  x?: number;
+  y?: number;
+  w?: number;
+  h?: number;
+  width?: number;
+  height?: number;
+};
+
+type LedgerDocument = {
+  cards?: LedgerCard[];
+  annotations?: Array<Record<string, unknown>>;
+};
+
+type LedgerGeometryPatch = {
+  cards?: Record<string, { x: number; y: number; width: number; height: number }>;
+  zones?: Record<string, { x: number; y: number; width: number; height: number }>;
+  groups?: Record<string, { x: number; y: number; width: number; height: number }>;
+};
+
+type PatchGeometryMutation = {
+  action?: string;
+  geometry?: LedgerGeometryPatch;
+};
+
+const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
+const targetCardId = '9d1b7c36';
+const chromiumExecutablePath = '/snap/bin/chromium';
 
 test('The refresh system preserves canvas continuity during operator work.', async () => {
-  await assertFrontendSpec('The refresh system preserves canvas continuity during operator work.', '9d1b7c36', 'refresh');
+  const originalLedger = readSpecsLedger();
+  const targetCard = originalLedger.cards?.find((card) => String(card.id ?? '') === targetCardId);
+  assert.ok(targetCard, `Expected specs ledger to contain card ${targetCardId}`);
+
+  const viewport = viewportForCard(targetCard);
+  const server = await startDecisionOsServer();
+  let browser: Browser | undefined;
+
+  try {
+    browser = await launchBrowser();
+    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
+    const committedMutations: PatchGeometryMutation[] = [];
+
+    await seedCanvasViewport(page, viewport);
+    await page.route(`${server.url}/decision-os/specs`, async (route) => {
+      const request = route.request();
+      if (request.method() !== 'PATCH') {
+        await route.continue();
+        return;
+      }
+      const mutation = request.postDataJSON() as PatchGeometryMutation;
+      if (mutation.action === 'patch-geometry') committedMutations.push(mutation);
+      await route.fulfill({
+        status: 200,
+        contentType: 'application/json',
+        body: JSON.stringify(applyGeometryPatch(originalLedger, mutation.geometry ?? {}))
+      });
+    });
+
+    await page.goto(`${server.url}/specs`, { waitUntil: 'domcontentloaded' });
+    await page.waitForFunction((cardId) => {
+      const state = (window as Window & { __coreState?: { activeLedger?: { cards?: Array<{ id?: string }> } } }).__coreState;
+      return Boolean(state?.activeLedger?.cards?.some((card) => String(card.id ?? '') === cardId));
+    }, targetCardId);
+
+    const card = page.locator(`[data-card-id="${targetCardId}"].ledger-node`);
+    await card.waitFor({ state: 'visible' });
+    const cardBox = await card.boundingBox();
+    assert.ok(cardBox, `Expected card ${targetCardId} to have browser geometry`);
+
+    const start = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
+    await page.mouse.move(start.x, start.y);
+    await page.mouse.down();
+    await page.mouse.move(start.x + 40, start.y + 10);
+
+    const refreshCountBefore = await refreshCompletionCount(page);
+    await page.locator('[data-action="refresh"]').evaluate((button) => {
+      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
+    });
+    await page.waitForFunction((previousCount) => {
+      const telemetry = ((window as Window & { __coreTelemetry?: Array<{ name?: string; args?: { source?: string } }> }).__coreTelemetry ?? []);
+      return telemetry.filter((entry) => entry.name === 'merge-refresh-state' && entry.args?.source === 'refresh-button').length > previousCount;
+    }, refreshCountBefore);
+
+    await page.mouse.move(start.x + 110, start.y + 30);
+    await page.mouse.up();
+
+    await waitFor(() => committedMutations.length > 0, 'Timed out waiting for patch-geometry commit');
+    const finalMutation = committedMutations.at(-1);
+    assert.ok(finalMutation?.geometry, 'Expected release to commit geometry');
+    assert.deepEqual(Object.keys(finalMutation.geometry.cards ?? {}), [targetCardId]);
+    assert.deepEqual(Object.keys(finalMutation.geometry.zones ?? {}), []);
+    assert.deepEqual(Object.keys(finalMutation.geometry.groups ?? {}), []);
+    assert.equal(finalMutation.geometry.cards?.[targetCardId]?.x, Number(targetCard.x ?? 0) + 110);
+    assert.equal(finalMutation.geometry.cards?.[targetCardId]?.y, Number(targetCard.y ?? 0) + 30);
+  } finally {
+    await browser?.close();
+    await stopDecisionOsServer(server.process);
+  }
 });
+
+async function seedCanvasViewport(page: Page, viewport: { x: number; y: number; scale: number }): Promise<void> {
+  await page.addInitScript((input) => {
+    localStorage.setItem('decision-os.canvas.state', JSON.stringify({
+      activeTab: 'specs',
+      railCollapsed: false,
+      selection: { cardIds: [], zoneIds: [], groupIds: [] },
+      viewport: input,
+      viewports: { specs: input }
+    }));
+  }, viewport);
+}
+
+async function refreshCompletionCount(page: Page): Promise<number> {
+  return page.evaluate(() => {
+    const telemetry = ((window as Window & { __coreTelemetry?: Array<{ name?: string; args?: { source?: string } }> }).__coreTelemetry ?? []);
+    return telemetry.filter((entry) => entry.name === 'merge-refresh-state' && entry.args?.source === 'refresh-button').length;
+  });
+}
+
+function readSpecsLedger(): LedgerDocument {
+  return JSON.parse(readFileSync(resolve(repoRoot, '.decision-os/specs.json'), 'utf8')) as LedgerDocument;
+}
+
+function viewportForCard(card: LedgerCard): { x: number; y: number; scale: number } {
+  return {
+    x: 420 - Number(card.x ?? 0),
+    y: 240 - Number(card.y ?? 0),
+    scale: 1
+  };
+}
+
+function applyGeometryPatch(ledger: LedgerDocument, geometry: LedgerGeometryPatch): LedgerDocument {
+  const next = JSON.parse(JSON.stringify(ledger)) as LedgerDocument;
+  const cardPatches = geometry.cards ?? {};
+  next.cards = (next.cards ?? []).map((card) => {
+    const patch = cardPatches[String(card.id ?? '')];
+    return patch ? { ...card, x: patch.x, y: patch.y, w: patch.width, h: patch.height } : card;
+  });
+  return next;
+}
+
+async function launchBrowser(): Promise<Browser> {
+  return chromium.launch({
+    headless: true,
+    executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
+    args: ['--no-sandbox', '--disable-dev-shm-usage']
+  });
+}
+
+async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
+  const port = await freePort();
+  const url = `http://127.0.0.1:${port}`;
+  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
+    cwd: repoRoot,
+    detached: true,
+    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
+    stdio: ['ignore', 'pipe', 'pipe']
+  });
+  const output: string[] = [];
+  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
+  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
+  await waitFor(async () => {
+    assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
+    const response = await fetch(`${url}/specs`, { method: 'HEAD' }).catch(() => undefined);
+    return Boolean(response?.ok);
+  }, `Timed out waiting for decision-os server at ${url}/specs`);
+  return { process: child, url };
+}
+
+async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
+  if (child.exitCode !== null || child.signalCode !== null) return;
+  if (child.pid) {
+    try {
+      process.kill(-child.pid, 'SIGTERM');
+    } catch {
+      child.kill('SIGTERM');
+    }
+  } else {
+    child.kill('SIGTERM');
+  }
+  const exited = await Promise.race([waitForExit(child).then(() => true), delay(2000).then(() => false)]);
+  if (!exited && child.pid) {
+    try {
+      process.kill(-child.pid, 'SIGKILL');
+    } catch {
+      child.kill('SIGKILL');
+    }
+  }
+}
+
+async function freePort(): Promise<number> {
+  const server = createServer();
+  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
+  const address = server.address();
+  assert.ok(address && typeof address === 'object', 'Expected an ephemeral TCP port');
+  const port = address.port;
+  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
+  return port;
+}
+
+async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
+  const deadline = Date.now() + 10000;
+  while (Date.now() < deadline) {
+    if (await check()) return;
+    await delay(50);
+  }
+  assert.fail(message);
+}
+
+function waitForExit(child: ChildProcess): Promise<void> {
+  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
+  return new Promise((resolveExit) => child.once('exit', () => resolveExit()));
+}
+
+function delay(ms: number): Promise<void> {
+  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
+}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-23","timestamp":"2026-07-10T04:37:24.025Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"23","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc \"git show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | wc -l\ngit show HEAD:frontend/test/runtime/canvas-pan-performance.integration.test.ts | wc -l\ngit show HEAD:frontend/test/runtime/ledger-content-refresh.integration.test.ts | wc -l\ngit show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,540p'\ngit diff --unified=2 -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,760p'\""} -->

**Tool call** `/usr/bin/zsh -lc "git show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | wc -l
git show HEAD:frontend/test/runtime/canvas-pan-performance.integration.test.ts | wc -l
git show HEAD:frontend/test/runtime/ledger-content-refresh.integration.test.ts | wc -l
git show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,540p'
git diff --unified=2 -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,760p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-24","timestamp":"2026-07-10T04:37:24.025Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"24","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc \"git show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | wc -l\ngit show HEAD:frontend/test/runtime/canvas-pan-performance.integration.test.ts | wc -l\ngit show HEAD:frontend/test/runtime/ledger-content-refresh.integration.test.ts | wc -l\ngit show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,540p'\ngit diff --unified=2 -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,760p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "git show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | wc -l
git show HEAD:frontend/test/runtime/canvas-pan-performance.integration.test.ts | wc -l
git show HEAD:frontend/test/runtime/ledger-content-refresh.integration.test.ts | wc -l
git show HEAD:frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,540p'
git diff --unified=2 -- frontend/test/runtime/drag-release-freeze.integration.test.ts | sed -n '1,760p'"`
Status: completed
Exit code: 0

````text
175
266
104
/**
 * WHAT: Regression coverage for card drag release while the geometry commit is still in flight.
 * WHY: Releasing the pointer must freeze the card at the release coordinate, not at a later cursor move.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

type FakeElement = {
  dataset: Record<string, string>;
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
    display: string;
    setProperty(name: string, value: string): void;
    getPropertyValue(name: string): string;
  };
  hidden: boolean;
  childElementCount: number;
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  parentElement: FakeElement | null;
  classList: { toggle(): void; add(): void; remove(): void; contains(): boolean };
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  append(node: FakeElement): void;
  appendChild(node: FakeElement): void;
  insertBefore(node: FakeElement, before: FakeElement | null): void;
  replaceChildren(): void;
  setAttribute(name: string, value: string): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
};

function fakeElement(dataset: Record<string, string> = {}): FakeElement {
  const customProperties = new Map<string, string>();
  const element: FakeElement = {
    dataset,
    style: {
      left: '0px',
      top: '0px',
      width: '120px',
      height: '80px',
      display: '',
      setProperty(name: string, value: string) {
        customProperties.set(name, value);
      },
      getPropertyValue(name: string) {
        return customProperties.get(name) ?? '';
      }
    },
    hidden: false,
    childElementCount: 0,
    parentElement: null,
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    append(node: FakeElement) {
      node.parentElement = element;
      element.childElementCount += 1;
    },
    appendChild(node: FakeElement) {
      element.append(node);
    },
    insertBefore(node: FakeElement) {
      element.append(node);
    },
    replaceChildren() {
      element.childElementCount = 0;
    },
    setAttribute() {},
    getBoundingClientRect() {
      return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
    }
  };
  return element;
}

test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  const canvas = fakeElement();
  const content = fakeElement();
  const card = fakeElement({ cardId: 'card-a' });
  const created: FakeElement[] = [];
  card.style.left = '20px';
  card.style.top = '20px';
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
  content.querySelector = (selector: string) => selector === ':scope > .zone-label-overlay' ? null : null;
  content.querySelectorAll = () => [];

  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 1000,
    innerHeight: 800,
    __coreTelemetry: [],
    location: { pathname: '/specs' },
    addEventListener() {},
    dispatchEvent() {},
    visualViewport: { addEventListener() {} }
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({ display: 'block', getPropertyValue: () => '' });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = () => 0;
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.canvas') return canvas;
      if (selector === '.canvas-content') return content;
      if (selector === '[data-card-id="card-a"]') return card;
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector === '[data-card-id]') return [card];
      return [];
    },
    createElement() {
      const element = fakeElement();
      created.push(element);
      return element;
    },
    createElementNS() {
      return fakeElement();
    }
  };

  const calls: RequestInit[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = (_url: string, init: RequestInit) => {
    calls.push(init);
    return new Promise(() => {});
  };

  const { state } = await import('../../src/runtime/state.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');

  state.activeTab = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.activeLedger = { cards: [{ id: 'card-a', x: 20, y: 20, w: 120, h: 80 }], annotations: [], relationships: [], notes: {} };
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = {
    intent: 'drag',
    targetKind: 'card',
    targetId: 'card-a',
    target: card,
    resizeHandle: null,
    start: { x: 0, y: 0 },
    current: { x: 10, y: 0 },
    startCanvas: { x: 0, y: 0 },
    currentCanvas: { x: 10, y: 0 },
    startedAt: 0
  };

  void handlePointerUp({ clientX: 15, clientY: 0, pointerId: 7, preventDefault() {} } as unknown as PointerEvent);

  assert.equal(state.pointer, null);
  assert.equal(card.offsetLeft, 25);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);

  handlePointerMove({ clientX: 200, clientY: 0, preventDefault() {} } as unknown as PointerEvent);

  assert.equal(card.offsetLeft, 25);
  assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);
  assert.ok(created.length >= 0);
});
diff --git a/frontend/test/runtime/drag-release-freeze.integration.test.ts b/frontend/test/runtime/drag-release-freeze.integration.test.ts
index c033a23..b0eed59 100644
--- a/frontend/test/runtime/drag-release-freeze.integration.test.ts
+++ b/frontend/test/runtime/drag-release-freeze.integration.test.ts
@@ -7,4 +7,7 @@ import assert from 'node:assert/strict';
 
 type FakeElement = {
+  tagName: string;
+  id: string;
+  className: string;
   dataset: Record<string, string>;
   style: {
@@ -13,10 +16,31 @@ type FakeElement = {
     width: string;
     height: string;
+    minHeight: string;
     display: string;
+    transition: string;
+    transform: string;
+    visibility: string;
+    color: string;
+    textShadow: string;
     setProperty(name: string, value: string): void;
     getPropertyValue(name: string): string;
+    removeProperty(name: string): void;
   };
   hidden: boolean;
+  textContent: string;
+  innerHTML: string;
+  type: string;
+  title: string;
+  ariaLabel: string;
+  value: string;
+  disabled: boolean;
+  scrollTop: number;
+  scrollLeft: number;
+  scrollHeight: number;
+  scrollWidth: number;
+  clientWidth: number;
+  clientHeight: number;
   childElementCount: number;
+  children: FakeElement[];
   offsetLeft: number;
   offsetTop: number;
@@ -24,56 +48,198 @@ type FakeElement = {
   offsetHeight: number;
   parentElement: FakeElement | null;
-  classList: { toggle(): void; add(): void; remove(): void; contains(): boolean };
+  isConnected: boolean;
+  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
   querySelector(selector: string): FakeElement | null;
   querySelectorAll(selector: string): FakeElement[];
-  append(node: FakeElement): void;
-  appendChild(node: FakeElement): void;
+  matches(selector: string): boolean;
+  closest(selector: string): FakeElement | null;
+  append(...nodes: FakeElement[]): void;
+  appendChild(node: FakeElement): FakeElement;
   insertBefore(node: FakeElement, before: FakeElement | null): void;
-  replaceChildren(): void;
+  replaceChildren(...nodes: FakeElement[]): void;
+  remove(): void;
   setAttribute(name: string, value: string): void;
+  getAttribute(name: string): string | null;
+  hasAttribute(name: string): boolean;
+  removeAttribute(name: string): void;
+  addEventListener(): void;
+  removeEventListener(): void;
+  blur(): void;
+  scrollTo(options?: unknown): void;
   getBoundingClientRect(): { left: number; top: number; width: number; height: number };
 };
 
-function fakeElement(dataset: Record<string, string> = {}): FakeElement {
+type RuntimeDom = {
+  root: FakeElement;
+  canvas: FakeElement;
+  content: FakeElement;
+  controlOverlay: FakeElement;
+  mediaOverlay: FakeElement;
+  telemetryList: FakeElement;
+  marquee: FakeElement;
+  panel: FakeElement;
+  threadPanel: FakeElement;
+  shell: FakeElement;
+  threadTarget: FakeElement;
+  threadHeading: FakeElement;
+  tabs: FakeElement;
+  topbarTitle: FakeElement;
+  kicker: FakeElement;
+};
+
+const runtimeDom = createRuntimeDom();
+
+function fakeElement(dataset: Record<string, string> = {}, tagName = 'div'): FakeElement {
   const customProperties = new Map<string, string>();
+  const attributes = new Map<string, string>();
+  const style = {
+    left: '0px',
+    top: '0px',
+    width: '120px',
+    height: '80px',
+    minHeight: '',
+    display: '',
+    transition: '',
+    transform: '',
+    visibility: '',
+    color: '',
+    textShadow: '',
+    setProperty(name: string, value: string) {
+      customProperties.set(name, value);
+    },
+    getPropertyValue(name: string) {
+      return customProperties.get(name) ?? '';
+    },
+    removeProperty(name: string) {
+      customProperties.delete(name);
+    }
+  };
   const element: FakeElement = {
+    tagName: tagName.toUpperCase(),
+    id: '',
+    className: '',
     dataset,
-    style: {
-      left: '0px',
-      top: '0px',
-      width: '120px',
-      height: '80px',
-      display: '',
-      setProperty(name: string, value: string) {
-        customProperties.set(name, value);
-      },
-      getPropertyValue(name: string) {
-        return customProperties.get(name) ?? '';
-      }
-    },
+    style,
     hidden: false,
-    childElementCount: 0,
+    textContent: '',
+    innerHTML: '',
+    type: '',
+    title: '',
+    ariaLabel: '',
+    value: '',
+    disabled: false,
+    scrollTop: 0,
+    scrollLeft: 0,
+    scrollHeight: 0,
+    scrollWidth: 0,
+    clientWidth: 120,
+    clientHeight: 80,
+    children: [],
     parentElement: null,
-    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
+    isConnected: true,
+    get childElementCount() { return element.children.length; },
     get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
     get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
     get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
     get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
-    querySelector() { return null; },
-    querySelectorAll() { return []; },
-    append(node: FakeElement) {
-      node.parentElement = element;
-      element.childElementCount += 1;
+    classList: {
+      toggle(name: string, force?: boolean) {
+        const classes = classSet(element);
+        const shouldAdd = force ?? !classes.has(name);
+        if (shouldAdd) classes.add(name);
+        else classes.delete(name);
+        element.className = [...classes].join(' ');
+        return shouldAdd;
+      },
+      add(...names: string[]) {
+        const classes = classSet(element);
+        for (const name of names) classes.add(name);
+        element.className = [...classes].join(' ');
+      },
+      remove(...names: string[]) {
+        const classes = classSet(element);
+        for (const name of names) classes.delete(name);
+        element.className = [...classes].join(' ');
+      },
+      contains(name: string) {
+        return classSet(element).has(name);
+      }
+    },
+    querySelector(selector: string) {
+      return element.querySelectorAll(selector)[0] ?? null;
+    },
+    querySelectorAll(selector: string) {
+      return queryAll(element, selector);
+    },
+    matches(selector: string) {
+      return matchesSelectorList(element, selector);
+    },
+    closest(selector: string) {
+      let current: FakeElement | null = element;
+      while (current) {
+        if (matchesSelectorList(current, selector)) return current;
+        current = current.parentElement;
+      }
+      return null;
+    },
+    append(...nodes: FakeElement[]) {
+      for (const node of nodes) appendChildElement(element, node);
     },
     appendChild(node: FakeElement) {
-      element.append(node);
+      appendChildElement(element, node);
+      return node;
+    },
+    insertBefore(node: FakeElement, before: FakeElement | null) {
+      detach(node);
+      const index = before ? element.children.indexOf(before) : -1;
+      if (index >= 0) element.children.splice(index, 0, node);
+      else element.children.push(node);
+      node.parentElement = element;
+      markConnected(node, true);
     },
-    insertBefore(node: FakeElement) {
-      element.append(node);
+    replaceChildren(...nodes: FakeElement[]) {
+      for (const child of element.children) {
+        child.parentElement = null;
+        markConnected(child, false);
+      }
+      element.children = [];
+      element.append(...nodes);
     },
-    replaceChildren() {
-      element.childElementCount = 0;
+    remove() {
+      detach(element);
+      markConnected(element, false);
+    },
+    setAttribute(name: string, value: string) {
+      attributes.set(name, value);
+      if (name === 'id') element.id = value;
+      if (name === 'class') element.className = value;
+      if (name.startsWith('data-')) element.dataset[dataKey(name.slice(5))] = value;
+    },
+    getAttribute(name: string) {
+      if (name === 'id') return element.id || null;
+      if (name === 'class') return element.className || null;
+      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] ?? null;
+      return attributes.get(name) ?? null;
+    },
+    hasAttribute(name: string) {
+      if (name === 'id') return Boolean(element.id);
+      if (name === 'class') return Boolean(element.className);
+      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] !== undefined;
+      return attributes.has(name);
+    },
+    removeAttribute(name: string) {
+      attributes.delete(name);
+      if (name === 'id') element.id = '';
+      if (name === 'class') element.className = '';
+      if (name.startsWith('data-')) delete element.dataset[dataKey(name.slice(5))];
+    },
+    addEventListener() {},
+    removeEventListener() {},
+    blur() {},
+    scrollTo(options?: unknown) {
+      const scroll = options as { left?: number; top?: number } | undefined;
+      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
+      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
     },
-    setAttribute() {},
     getBoundingClientRect() {
       return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
@@ -83,5 +249,42 @@ function fakeElement(dataset: Record<string, string> = {}): FakeElement {
 }
 
-test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
+function createRuntimeDom(): RuntimeDom {
+  const root = fakeElement({}, 'document');
+  const canvas = fakeElement({}, 'div');
+  const content = fakeElement({}, 'div');
+  const controlOverlay = fakeElement({}, 'div');
+  const mediaOverlay = fakeElement({}, 'div');
+  const telemetryList = fakeElement({}, 'ol');
+  const marquee = fakeElement({}, 'div');
+  const panel = fakeElement({}, 'aside');
+  const threadPanel = fakeElement({}, 'aside');
+  const shell = fakeElement({}, 'div');
+  const threadTarget = fakeElement({}, 'div');
+  const threadHeading = fakeElement({}, 'div');
+  const tabs = fakeElement({}, 'nav');
+  const topbarTitle = fakeElement({}, 'button');
+  const kicker = fakeElement({}, 'span');
+  canvas.className = 'canvas';
+  content.className = 'canvas-content';
+  controlOverlay.className = 'canvas-control-overlay';
+  mediaOverlay.className = 'canvas-media-overlay';
+  telemetryList.className = 'telemetry-list';
+  marquee.className = 'marquee';
+  panel.className = 'panel';
+  threadPanel.className = 'thread-panel';
+  shell.className = 'shell';
+  threadTarget.className = 'thread-target';
+  threadHeading.className = 'thread-heading';
+  tabs.className = 'tabs';
+  topbarTitle.className = 'topbar-title-action';
+  kicker.className = 'kicker';
+  root.append(canvas, telemetryList, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker);
+  canvas.append(content, controlOverlay, mediaOverlay);
+  content.append(marquee);
+  return { root, canvas, content, controlOverlay, mediaOverlay, telemetryList, marquee, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker };
+}
+
+function installRuntimeDom(): RuntimeDom {
+  resetRuntimeDom();
   (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
     detail: unknown;
@@ -90,17 +293,8 @@ test('card drag release clears pointer before slow geometry commit can accept la
     }
   };
-  const canvas = fakeElement();
-  const content = fakeElement();
-  const card = fakeElement({ cardId: 'card-a' });
-  const created: FakeElement[] = [];
-  card.style.left = '20px';
-  card.style.top = '20px';
-  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
-  content.querySelector = (selector: string) => selector === ':scope > .zone-label-overlay' ? null : null;
-  content.querySelectorAll = () => [];
-
   (globalThis as unknown as { window: unknown }).window = {
     innerWidth: 1000,
     innerHeight: 800,
+    devicePixelRatio: 1,
     __coreTelemetry: [],
     location: { pathname: '/specs' },
@@ -109,27 +303,222 @@ test('card drag release clears pointer before slow geometry commit can accept la
     visualViewport: { addEventListener() {} }
   };
-  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({ display: 'block', getPropertyValue: () => '' });
-  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = () => 0;
-  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };
+  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: FakeElement) => ({
+    display: node.style.display || 'block',
+    color: node.style.color || '',
+    textShadow: node.style.textShadow || '',
+    getPropertyValue: (name: string) => node.style.getPropertyValue(name)
+  });
+  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
+    callback(performance.now());
+    return 0;
+  };
+  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
+    observe() {}
+    disconnect() {}
+  };
+  (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
+  (globalThis as unknown as { SVGElement: unknown }).SVGElement = class SVGElement {};
+  (globalThis as unknown as { SVGSVGElement: unknown }).SVGSVGElement = class SVGSVGElement {};
+  (globalThis as unknown as { SVGPathElement: unknown }).SVGPathElement = class SVGPathElement {};
+  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
+  const storage = new Map<string, string>();
+  (globalThis as unknown as { localStorage: unknown }).localStorage = {
+    getItem(key: string) {
+      return storage.get(key) ?? null;
+    },
+    setItem(key: string, value: string) {
+      storage.set(key, String(value));
+    },
+    removeItem(key: string) {
+      storage.delete(key);
+    }
+  };
   (globalThis as unknown as { document: unknown }).document = {
+    title: '',
+    fonts: { ready: Promise.resolve() },
+    activeElement: fakeElement(),
     querySelector(selector: string) {
-      if (selector === '.canvas') return canvas;
-      if (selector === '.canvas-content') return content;
-      if (selector === '[data-card-id="card-a"]') return card;
-      return null;
+      return runtimeDom.root.querySelector(selector);
     },
     querySelectorAll(selector: string) {
-      if (selector === '[data-card-id]') return [card];
-      return [];
+      return runtimeDom.root.querySelectorAll(selector);
     },
-    createElement() {
-      const element = fakeElement();
-      created.push(element);
-      return element;
+    createElement(tagName: string) {
+      return fakeElement({}, tagName);
     },
-    createElementNS() {
-      return fakeElement();
+    createTextNode(text: string) {
+      const node = fakeElement({}, '#text');
+      node.textContent = text;
+      return node;
+    },
+    createElementNS(_namespace: string, tagName: string) {
+      return fakeElement({}, tagName);
     }
   };
+  return runtimeDom;
+}
+
+function resetRuntimeDom(): void {
+  for (const element of Object.values(runtimeDom)) {
+    element.children = [];
+    element.parentElement = null;
+    element.isConnected = true;
+    element.hidden = false;
+    element.textContent = '';
+    element.innerHTML = '';
+    element.style.left = '0px';
+    element.style.top = '0px';
+    element.style.width = '120px';
+    element.style.height = '80px';
+    element.style.minHeight = '';
+    element.style.display = '';
+    element.style.transition = '';
+    element.style.transform = '';
+    element.style.visibility = '';
+  }
+  runtimeDom.canvas.className = 'canvas';
+  runtimeDom.canvas.style.width = '1000px';
+  runtimeDom.canvas.style.height = '800px';
+  runtimeDom.content.className = 'canvas-content';
+  runtimeDom.controlOverlay.className = 'canvas-control-overlay';
+  runtimeDom.mediaOverlay.className = 'canvas-media-overlay';
+  runtimeDom.telemetryList.className = 'telemetry-list';
+  runtimeDom.marquee.className = 'marquee';
+  runtimeDom.marquee.hidden = true;
+  runtimeDom.panel.className = 'panel';
+  runtimeDom.threadPanel.className = 'thread-panel';
+  runtimeDom.shell.className = 'shell';
+  runtimeDom.threadTarget.className = 'thread-target';
+  runtimeDom.threadHeading.className = 'thread-heading';
+  runtimeDom.tabs.className = 'tabs';
+  runtimeDom.topbarTitle.className = 'topbar-title-action';
+  runtimeDom.kicker.className = 'kicker';
+  runtimeDom.root.append(runtimeDom.canvas, runtimeDom.telemetryList, runtimeDom.panel, runtimeDom.threadPanel, runtimeDom.shell, runtimeDom.threadTarget, runtimeDom.threadHeading, runtimeDom.tabs, runtimeDom.topbarTitle, runtimeDom.kicker);
+  runtimeDom.canvas.append(runtimeDom.content, runtimeDom.controlOverlay, runtimeDom.mediaOverlay);
+  runtimeDom.content.append(runtimeDom.marquee);
+}
+
+function classSet(element: FakeElement): Set<string> {
+  return new Set(element.className.split(/\s+/).filter(Boolean));
+}
+
+function appendChildElement(parent: FakeElement, child: FakeElement): void {
+  detach(child);
+  parent.children.push(child);
+  child.parentElement = parent;
+  markConnected(child, true);
+}
+
+function detach(element: FakeElement): void {
+  const parent = element.parentElement;
+  if (!parent) return;
+  parent.children = parent.children.filter((child) => child !== element);
+  element.parentElement = null;
+}
+
+function markConnected(element: FakeElement, connected: boolean): void {
+  element.isConnected = connected;
+  for (const child of element.children) markConnected(child, connected);
+}
+
+function dataKey(attribute: string): string {
+  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
+}
+
+function descendants(element: FakeElement): FakeElement[] {
+  return element.children.flatMap((child) => [child, ...descendants(child)]);
+}
+
+function queryAll(root: FakeElement, selector: string): FakeElement[] {
+  const matches: FakeElement[] = [];
+  const seen = new Set<FakeElement>();
+  for (const rawPart of selector.split(',')) {
+    const part = rawPart.trim();
+    if (!part) continue;
+    const direct = part.startsWith(':scope > ');
+    const normalized = part.replace(/^:scope\s*>\s*/, '').trim();
+    const candidates = direct ? root.children : descendants(root);
+    for (const candidate of candidates) {
+      if (seen.has(candidate)) continue;
+      if (matchesSelector(candidate, normalized)) {
+        seen.add(candidate);
+        matches.push(candidate);
+      }
+    }
+  }
+  return matches;
+}
+
+function matchesSelectorList(element: FakeElement, selector: string): boolean {
+  return selector.split(',').some((part) => matchesSelector(element, part.trim()));
+}
+
+function matchesSelector(element: FakeElement, selector: string): boolean {
+  if (!selector) return false;
+  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
+  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
+  remaining = remaining.replace(/:not\([^)]+\)/g, '');
+  if (notMatches.some((notSelector) => matchesSelector(element, notSelector))) return false;
+
+  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
+  if (idMatch && element.id !== idMatch[1]) return false;
+  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');
+
+  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
+  const classes = classSet(element);
+  if (classMatches.some((className) => !classes.has(className))) return false;
+  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');
+
+  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
+  for (const [, attribute, expected] of attributeMatches) {
+    const actual = attribute.startsWith('data-') ? element.dataset[dataKey(attribute.slice(5))] : element.getAttribute(attribute);
+    if (expected === undefined) {
+      if (actual === undefined || actual === null) return false;
+    } else if (actual !== expected) return false;
+  }
+  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();
+
+  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
+  return true;
+}
+
+function pointerEvent(input: { target?: FakeElement; clientX: number; clientY: number; pointerId?: number; shiftKey?: boolean; ctrlKey?: boolean; button?: number; buttons?: number }): PointerEvent {
+  return {
+    target: input.target ?? runtimeDom.canvas,
+    clientX: input.clientX,
+    clientY: input.clientY,
+    pointerId: input.pointerId ?? 1,
+    shiftKey: input.shiftKey ?? false,
+    ctrlKey: input.ctrlKey ?? false,
+    button: input.button ?? 0,
+    buttons: input.buttons ?? 1,
+    preventDefault() {},
+    stopPropagation() {}
+  } as unknown as PointerEvent;
+}
+
+function appendLedgerCard(id: string, x: number, y: number, width = 240, height = 132): FakeElement {
+  const card = fakeElement({ cardId: id }, 'article');
+  card.className = 'card ledger-node';
+  card.style.left = `${x}px`;
+  card.style.top = `${y}px`;
+  card.style.width = `${width}px`;
+  card.style.height = `${height}px`;
+  runtimeDom.content.insertBefore(card, runtimeDom.marquee);
+  return card;
+}
+
+async function flushAsync(): Promise<void> {
+  await Promise.resolve();
+  await new Promise((resolve) => setTimeout(resolve, 0));
+  await Promise.resolve();
+}
+
+test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
+  const { canvas, content } = installRuntimeDom();
+  const card = appendLedgerCard('card-a', 20, 20, 120, 80);
+  card.style.left = '20px';
+  card.style.top = '20px';
+  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
 
   const calls: RequestInit[] = [];
@@ -172,4 +561,225 @@ test('card drag release clears pointer before slow geometry commit can accept la
   assert.equal(card.offsetLeft, 25);
   assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);
-  assert.ok(created.length >= 0);
+  assert.ok(content.childElementCount >= 1);
+});
+
+test('active card drag keeps pointer snapshot through same-ledger load and commits the original target', async () => {
+  installRuntimeDom();
+  const cardA = appendLedgerCard('card-a', 20, 20);
+  appendLedgerCard('card-b', 200, 20);
+  const patchBodies: Array<Record<string, any>> = [];
+
+  const { state } = await import('../../src/runtime/state.js');
+  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
+  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
+  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
+  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTool = 'select';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.viewport = { x: 0, y: 0, scale: 1 };
+  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
+  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  state.pointer = null;
+  state.activeLedger = {
+    cards: [
+      { id: 'card-a', title: 'A', x: 20, y: 20, w: 240, h: 132 },
+      { id: 'card-b', title: 'B', x: 200, y: 20, w: 240, h: 132 }
+    ],
+    annotations: [],
+    relationships: [],
+    notes: {}
+  };
+
+  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
+    assert.equal(url, '/decision-os/specs');
+    if (init?.method === 'PATCH') {
+      const body = JSON.parse(String(init.body ?? '{}'));
+      patchBodies.push(body);
+      return {
+        ok: true,
+        async json() {
+          return structuredClone(state.activeLedger);
+        }
+      };
+    }
+    return {
+      ok: true,
+      async json() {
+        return {
+          cards: [
+            { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
+            { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 }
+          ],
+          annotations: [],
+          relationships: [],
+          notes: {}
+        };
+      }
+    };
+  };
+
+  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
+  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);
+
+  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
+  await loadActiveLedgerState();
+
+  assert.deepEqual(state.selection.cardIds, ['card-a']);
+  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);
+
+  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
+  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
+  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));
+
+  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a']);
+  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 80);
+  assert.equal(patchBodies[0].geometry.cards['card-b'], undefined);
+});
+
+test('multi-selection drag survives ledger content refresh and commits only the pointer snapshot', async () => {
+  installRuntimeDom();
+  const cardA = appendLedgerCard('card-a', 10, 10);
+  appendLedgerCard('card-b', 100, 10);
+  appendLedgerCard('card-c', 300, 10);
+  const patchBodies: Array<Record<string, any>> = [];
+  let resolveLoad!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
+  const loadStarted = new Promise<void>((resolveStarted) => {
+    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
+      assert.equal(url, '/decision-os/specs');
+      if (init?.method === 'PATCH') {
+        const body = JSON.parse(String(init.body ?? '{}'));
+        patchBodies.push(body);
+        return {
+          ok: true,
+          async json() {
+            return structuredClone(state.activeLedger);
+          }
+        };
+      }
+      resolveStarted();
+      return new Promise((resolve) => {
+        resolveLoad = resolve;
+      });
+    };
+  });
+
+  const { state } = await import('../../src/runtime/state.js');
+  const { requestLedgerContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
+  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
+  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
+  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
+
+  state.canvasMode = 'ledger';
+  state.activeTool = 'select';
+  state.activeTab = 'specs';
+  state.activeLedgerId = 'specs';
+  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
+  state.viewport = { x: 0, y: 0, scale: 1 };
+  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
+  state.selection = { cardIds: ['card-a', 'card-b'], zoneIds: [], groupIds: [] };
+  state.pointer = null;
+  state.activeLedger = {
+    cards: [
+      { id: 'card-a', title: 'A', x: 10, y: 10, w: 240, h: 132 },
+      { id: 'card-b', title: 'B', x: 100, y: 10, w: 240, h: 132 },
+      { id: 'card-c', title: 'C', x: 300, y: 10, w: 240, h: 132 }
+    ],
+    annotations: [],
+    relationships: [],
+    notes: {}
+  };
+
+  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
+  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a', 'card-b']);
+
+  handlePointerMove(pointerEvent({ target: cardA, clientX: 30, clientY: 0 }));
+  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
+  requestLedgerContentRefresh('card-content-change');
+  await loadStarted;
+  resolveLoad({
+    ok: true,
+    async json() {
+      return {
+        cards: [
+          { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
+          { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 },
+          { id: 'card-c', title: 'Server C', x: 5, y: 6, w: 220, h: 132 }
+        ],
+        annotations: [],
+        relationships: [],
+        notes: {}
+      };
+    }
+  });
+  await flushAsync();
+
+  assert.deepEqual(state.selection.cardIds, ['card-a', 'card-b']);
+  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
+  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
+  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));
+
+  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a', 'card-b']);
+  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 70);
+  assert.equal(patchBodies[0].geometry.cards['card-b'].x, 160);
+  assert.equal(patchBodies[0].geometry.cards['card-c'], undefined);
+});
+
+test('card resize resolves the current remounted node and commits pointer target geometry', async () => {
+  installRuntimeDom();
+  const originalCard = appendLedgerCard('card-a', 40, 50, 240, 150);
+  const resizeHandle = fakeElement({}, 'div');
+  resizeHandle.className = 'resize-handle se';
+  originalCard.append(resizeHandle);
+  const patchBodies: Array<Record<string, any>> = [];
+
+  const { state } = await import('../../src/runtime/state.js');
+  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
+  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
+  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
+
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-25","timestamp":"2026-07-10T04:37:32.012Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"25","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_13","codexTool":"/usr/bin/zsh -lc \"sed -n '1,520p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nsed -n '520,880p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nsed -n '1,520p' frontend/test/runtime/drag-release-freeze.integration.test.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,520p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
sed -n '520,880p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
sed -n '1,520p' frontend/test/runtime/drag-release-freeze.integration.test.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-26","timestamp":"2026-07-10T04:37:32.012Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"26","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_13","codexTool":"/usr/bin/zsh -lc \"sed -n '1,520p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nsed -n '520,880p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nsed -n '1,520p' frontend/test/runtime/drag-release-freeze.integration.test.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,520p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
sed -n '520,880p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
sed -n '1,520p' frontend/test/runtime/drag-release-freeze.integration.test.ts"`
Status: completed
Exit code: 0

````text
/**
 * WHAT: Runtime tests for transform-only canvas pan performance.
 * WHY: Canvas pan should not pay scale/detail-mode or unsampled telemetry costs on every pointermove.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePointerIntent, ctrlPanOnlySpec } from '../../src/runtime/gesture/helper/derive-pointer-intent.js';
import { state } from '../../src/runtime/state.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

type CanvasFakeStyle = Record<string, string> & {
  setProperty(name: string, value: string): void;
  getPropertyValue(name: string): string;
  removeProperty(name: string): void;
};

type CanvasFakeElement = {
  tagName: string;
  id: string;
  className: string;
  dataset: Record<string, string>;
  style: CanvasFakeStyle;
  hidden: boolean;
  textContent: string;
  innerHTML: string;
  type: string;
  title: string;
  ariaLabel: string;
  value: string;
  disabled: boolean;
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientWidth: number;
  clientHeight: number;
  children: CanvasFakeElement[];
  parentElement: CanvasFakeElement | null;
  isConnected: boolean;
  childElementCount: number;
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
  querySelector(selector: string): CanvasFakeElement | null;
  querySelectorAll(selector: string): CanvasFakeElement[];
  matches(selector: string): boolean;
  closest(selector: string): CanvasFakeElement | null;
  append(...nodes: CanvasFakeElement[]): void;
  appendChild(node: CanvasFakeElement): CanvasFakeElement;
  insertBefore(node: CanvasFakeElement, before: CanvasFakeElement | null): void;
  replaceChildren(...nodes: CanvasFakeElement[]): void;
  remove(): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
  addEventListener(): void;
  removeEventListener(): void;
  scrollTo(options?: unknown): void;
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number };
};

const canvasStorage = new Map<string, string>();
const canvasDom = createCanvasRuntimeDom();

function canvasElement(dataset: Record<string, string> = {}, tagName = 'div'): CanvasFakeElement {
  const customProperties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const style = {
    left: '0px',
    top: '0px',
    width: '120px',
    height: '80px',
    minHeight: '',
    display: '',
    transition: '',
    transform: '',
    visibility: '',
    right: '',
    bottom: '',
    maxWidth: '',
    position: '',
    zIndex: '',
    boxSizing: '',
    setProperty(name: string, value: string) {
      customProperties.set(name, value);
      style[name] = value;
    },
    getPropertyValue(name: string) {
      return customProperties.get(name) ?? style[name] ?? '';
    },
    removeProperty(name: string) {
      customProperties.delete(name);
      delete style[name];
    }
  } as unknown as CanvasFakeStyle;
  const element: CanvasFakeElement = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    dataset,
    style,
    hidden: false,
    textContent: '',
    innerHTML: '',
    type: '',
    title: '',
    ariaLabel: '',
    value: '',
    disabled: false,
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientWidth: 120,
    clientHeight: 80,
    children: [],
    parentElement: null,
    isConnected: true,
    get childElementCount() { return element.children.length; },
    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
    classList: {
      toggle(name: string, force?: boolean) {
        const classes = canvasClassSet(element);
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
        return shouldAdd;
      },
      add(...names: string[]) {
        const classes = canvasClassSet(element);
        for (const name of names) classes.add(name);
        element.className = [...classes].join(' ');
      },
      remove(...names: string[]) {
        const classes = canvasClassSet(element);
        for (const name of names) classes.delete(name);
        element.className = [...classes].join(' ');
      },
      contains(name: string) {
        return canvasClassSet(element).has(name);
      }
    },
    querySelector(selector: string) {
      return element.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector: string) {
      return canvasQueryAll(element, selector);
    },
    matches(selector: string) {
      return canvasMatchesSelectorList(element, selector);
    },
    closest(selector: string) {
      let current: CanvasFakeElement | null = element;
      while (current) {
        if (canvasMatchesSelectorList(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    append(...nodes: CanvasFakeElement[]) {
      for (const node of nodes) canvasAppendChild(element, node);
    },
    appendChild(node: CanvasFakeElement) {
      canvasAppendChild(element, node);
      return node;
    },
    insertBefore(node: CanvasFakeElement, before: CanvasFakeElement | null) {
      canvasDetach(node);
      const index = before ? element.children.indexOf(before) : -1;
      if (index >= 0) element.children.splice(index, 0, node);
      else element.children.push(node);
      node.parentElement = element;
      canvasMarkConnected(node, true);
    },
    replaceChildren(...nodes: CanvasFakeElement[]) {
      for (const child of element.children) {
        child.parentElement = null;
        canvasMarkConnected(child, false);
      }
      element.children = [];
      element.append(...nodes);
    },
    remove() {
      canvasDetach(element);
      canvasMarkConnected(element, false);
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
      if (name.startsWith('data-')) element.dataset[canvasDataKey(name.slice(5))] = value;
    },
    getAttribute(name: string) {
      if (name === 'id') return element.id || null;
      if (name === 'class') return element.className || null;
      if (name.startsWith('data-')) return element.dataset[canvasDataKey(name.slice(5))] ?? null;
      return attributes.get(name) ?? null;
    },
    hasAttribute(name: string) {
      if (name === 'id') return Boolean(element.id);
      if (name === 'class') return Boolean(element.className);
      if (name.startsWith('data-')) return element.dataset[canvasDataKey(name.slice(5))] !== undefined;
      return attributes.has(name);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
      if (name === 'id') element.id = '';
      if (name === 'class') element.className = '';
      if (name.startsWith('data-')) delete element.dataset[canvasDataKey(name.slice(5))];
    },
    addEventListener() {},
    removeEventListener() {},
    scrollTo(options?: unknown) {
      const scroll = options as { left?: number; top?: number } | undefined;
      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
    },
    getBoundingClientRect() {
      return {
        left: element.offsetLeft,
        top: element.offsetTop,
        right: element.offsetLeft + element.offsetWidth,
        bottom: element.offsetTop + element.offsetHeight,
        width: element.offsetWidth,
        height: element.offsetHeight
      };
    }
  };
  return element;
}

function createCanvasRuntimeDom() {
  const root = canvasElement({}, 'document');
  const canvas = canvasElement({}, 'div');
  const content = canvasElement({}, 'div');
  const controlOverlay = canvasElement({}, 'div');
  const mediaOverlay = canvasElement({}, 'div');
  const telemetryList = canvasElement({}, 'ol');
  const marquee = canvasElement({}, 'div');
  const panel = canvasElement({}, 'aside');
  const threadPanel = canvasElement({}, 'aside');
  const shell = canvasElement({}, 'div');
  const threadTarget = canvasElement({}, 'div');
  const threadHeading = canvasElement({}, 'div');
  const tabs = canvasElement({}, 'nav');
  const topbarTitle = canvasElement({}, 'button');
  const kicker = canvasElement({}, 'span');
  canvas.className = 'canvas';
  content.className = 'canvas-content';
  controlOverlay.className = 'canvas-control-overlay';
  mediaOverlay.className = 'canvas-media-overlay';
  telemetryList.className = 'telemetry-list';
  marquee.className = 'marquee';
  panel.className = 'panel';
  threadPanel.className = 'thread-panel';
  shell.className = 'shell';
  threadTarget.className = 'thread-target';
  threadHeading.className = 'thread-heading';
  tabs.className = 'tabs';
  topbarTitle.className = 'topbar-title-action';
  kicker.className = 'kicker';
  root.append(canvas, telemetryList, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker);
  canvas.append(content, controlOverlay, mediaOverlay);
  content.append(marquee);
  return { root, canvas, content, controlOverlay, mediaOverlay, telemetryList, marquee, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker };
}

function installCanvasRuntimeDom(): void {
  canvasStorage.clear();
  for (const element of Object.values(canvasDom)) {
    element.children = [];
    element.parentElement = null;
    element.isConnected = true;
    element.hidden = false;
    element.textContent = '';
    element.innerHTML = '';
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.width = '120px';
    element.style.height = '80px';
    element.style.minHeight = '';
    element.style.display = '';
    element.style.transition = '';
    element.style.transform = '';
    element.style.visibility = '';
  }
  canvasDom.canvas.className = 'canvas';
  canvasDom.canvas.style.width = '1000px';
  canvasDom.canvas.style.height = '800px';
  canvasDom.content.className = 'canvas-content';
  canvasDom.controlOverlay.className = 'canvas-control-overlay';
  canvasDom.mediaOverlay.className = 'canvas-media-overlay';
  canvasDom.telemetryList.className = 'telemetry-list';
  canvasDom.marquee.className = 'marquee';
  canvasDom.marquee.hidden = true;
  canvasDom.panel.className = 'panel';
  canvasDom.threadPanel.className = 'thread-panel';
  canvasDom.shell.className = 'shell';
  canvasDom.threadTarget.className = 'thread-target';
  canvasDom.threadHeading.className = 'thread-heading';
  canvasDom.tabs.className = 'tabs';
  canvasDom.topbarTitle.className = 'topbar-title-action';
  canvasDom.kicker.className = 'kicker';
  canvasDom.root.append(canvasDom.canvas, canvasDom.telemetryList, canvasDom.panel, canvasDom.threadPanel, canvasDom.shell, canvasDom.threadTarget, canvasDom.threadHeading, canvasDom.tabs, canvasDom.topbarTitle, canvasDom.kicker);
  canvasDom.canvas.append(canvasDom.content, canvasDom.controlOverlay, canvasDom.mediaOverlay);
  canvasDom.content.append(canvasDom.marquee);

  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 1000,
    innerHeight: 800,
    devicePixelRatio: 1,
    __coreTelemetry: [],
    location: { pathname: '/specs' },
    addEventListener() {},
    dispatchEvent() {},
    visualViewport: { addEventListener() {} }
  };
  (globalThis as unknown as { document: unknown }).document = {
    title: '',
    fonts: { ready: Promise.resolve() },
    activeElement: canvasElement(),
    querySelector(selector: string) {
      return canvasDom.root.querySelector(selector);
    },
    querySelectorAll(selector: string) {
      return canvasDom.root.querySelectorAll(selector);
    },
    createElement(tagName: string) {
      return canvasElement({}, tagName);
    },
    createTextNode(text: string) {
      const node = canvasElement({}, '#text');
      node.textContent = text;
      return node;
    },
    createElementNS(_namespace: string, tagName: string) {
      return canvasElement({}, tagName);
    }
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: CanvasFakeElement) => ({
    display: node.style.display || 'block',
    color: node.style.color || '',
    textShadow: node.style.textShadow || '',
    getPropertyValue: (name: string) => node.style.getPropertyValue(name)
  });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 0;
  };
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };
  (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
  (globalThis as unknown as { SVGElement: unknown }).SVGElement = class SVGElement {};
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem(key: string) {
      return canvasStorage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      canvasStorage.set(key, String(value));
    },
    removeItem(key: string) {
      canvasStorage.delete(key);
    }
  };
}

function canvasClassSet(element: CanvasFakeElement): Set<string> {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

function canvasAppendChild(parent: CanvasFakeElement, child: CanvasFakeElement): void {
  canvasDetach(child);
  parent.children.push(child);
  child.parentElement = parent;
  canvasMarkConnected(child, true);
}

function canvasDetach(element: CanvasFakeElement): void {
  const parent = element.parentElement;
  if (!parent) return;
  parent.children = parent.children.filter((child) => child !== element);
  element.parentElement = null;
}

function canvasMarkConnected(element: CanvasFakeElement, connected: boolean): void {
  element.isConnected = connected;
  for (const child of element.children) canvasMarkConnected(child, connected);
}

function canvasDataKey(attribute: string): string {
  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function canvasDescendants(element: CanvasFakeElement): CanvasFakeElement[] {
  return element.children.flatMap((child) => [child, ...canvasDescendants(child)]);
}

function canvasQueryAll(rootElement: CanvasFakeElement, selector: string): CanvasFakeElement[] {
  const matches: CanvasFakeElement[] = [];
  const seen = new Set<CanvasFakeElement>();
  for (const rawPart of selector.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const direct = part.startsWith(':scope > ');
    const normalized = part.replace(/^:scope\s*>\s*/, '').trim();
    const candidates = direct ? rootElement.children : canvasDescendants(rootElement);
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      if (canvasMatchesSelector(candidate, normalized)) {
        seen.add(candidate);
        matches.push(candidate);
      }
    }
  }
  return matches;
}

function canvasMatchesSelectorList(element: CanvasFakeElement, selector: string): boolean {
  return selector.split(',').some((part) => canvasMatchesSelector(element, part.trim()));
}

function canvasMatchesSelector(element: CanvasFakeElement, selector: string): boolean {
  if (!selector) return false;
  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
  remaining = remaining.replace(/:not\([^)]+\)/g, '');
  if (notMatches.some((notSelector) => canvasMatchesSelector(element, notSelector))) return false;

  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;
  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');

  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  const classes = canvasClassSet(element);
  if (classMatches.some((className) => !classes.has(className))) return false;
  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');

  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
  for (const [, attribute, expected] of attributeMatches) {
    const actual = attribute.startsWith('data-') ? element.dataset[canvasDataKey(attribute.slice(5))] : element.getAttribute(attribute);
    if (expected === undefined) {
      if (actual === undefined || actual === null) return false;
    } else if (actual !== expected) return false;
  }
  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();

  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
  return true;
}

function canvasPointerEvent(clientX: number, clientY: number, pointerId = 1): PointerEvent {
  return {
    target: canvasDom.canvas,
    clientX,
    clientY,
    pointerId,
    button: 0,
    buttons: 1,
    shiftKey: false,
    ctrlKey: false,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as PointerEvent;
}

function canvasWheelEvent(input: { clientX: number; clientY: number; deltaX?: number; deltaY: number; ctrlKey?: boolean }): WheelEvent {
  return {
    target: canvasDom.canvas,
    clientX: input.clientX,
    clientY: input.clientY,
    deltaX: input.deltaX ?? 0,
    deltaY: input.deltaY,
    ctrlKey: input.ctrlKey ?? false,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as WheelEvent;
}

async function waitForTimer(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test('canvas pan uses a transform-only path with sampled performance telemetry', () => {
  const pointerMove = source('frontend/src/runtime/gesture/controller/handle-pointer-move.ts');
  const panTransform = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const panTelemetry = source('frontend/src/runtime/gesture/effect/emit-pan-performance-telemetry.ts');
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const panningEffects = source('frontend/src/runtime/gesture/effect/schedule-panning-effects.ts');
  const finishPointer = source('frontend/src/runtime/gesture/effect/finish-pointer.ts');
  const pointHelper = source('frontend/src/runtime/gesture/helper/point.ts');
  const canvasCss = source('frontend/assets/canvas/canvas-layer.css');
  assert.match(pointerMove, /applyPanViewportTransform/);
  assert.match(pointerMove, /emitPanPerformanceTelemetry/);
  assert.match(pointerMove, /if \(isPan\)[\s\S]*return;/);
  assert.match(pointerMove, /const canvasPointer = isPan \? state\.pointer\.currentCanvas : canvasPoint\(pointer\)/);
  assert.match(panTransform, /content\.style\.transform/);
  assert.doesNotMatch(panTransform, /updateDetailMode/);
  assert.match(panTelemetry, /pan-frame-performance/);
  assert.match(panTelemetry, /pan-frame-performance/);
  assert.match(panTelemetry, /frame === 1 \|\| input\.durationMs >= 8 \|\| frame % 12 === 0/);
  assert.match(pointerDown, /startedAt: now/);
  assert.match(pointHelper, /cachedCanvasBounds/);
  assert.match(pointHelper, /invalidateCanvasPointBounds/);
  assert.doesNotMatch(pointerDown, /classList\.(?:add|toggle)\('is-panning'/);
  assert.match(pointerMove, /schedulePanningEffects\(\)/);
  assert.match(finishPointer, /clearPanningEffects\(\)/);
  assert.match(panningEffects, /requestAnimationFrame/);
  assert.match(panningEffects, /canvas\.classList\.add\('is-panning'\)/);
  assert.match(panningEffects, /canvas\.classList\.remove\('is-panning'\)/);
  assert.match(canvasCss, /\.canvas-content\s*{[\s\S]*will-change:\s*transform;/);
  assert.match(canvasCss, /\.canvas\.is-panning \.ledger-card-title,[\s\S]*text-shadow:\s*none;/);
  assert.match(canvasCss, /\.canvas\.is-panning \.card-status-indicator,[\s\S]*box-shadow:\s*none;/);
});

test('ctrl and middle-button drag always derive pan intent without selection side effects', () => {
  const previousTool = state.activeTool;
  const previousSelection = state.selection;
  state.activeTool = 'select';
  state.selection = { cardIds: ['card-a'], zoneIds: ['zone-a'], groupIds: ['group-a'] };

  try {
    const event = { shiftKey: false, ctrlKey: true, button: 0, buttons: 1, target: { closest: () => null } } as unknown as PointerEvent;
    const middleEvent = { shiftKey: false, ctrlKey: false, button: 1, buttons: 4, target: { closest: () => null } } as unknown as PointerEvent;
    const shiftEvent = { shiftKey: true, ctrlKey: false, target: { closest: () => null } } as unknown as PointerEvent;
    const resizeHandle = { className: 'resize-handle se' } as HTMLElement;
    assert.equal(ctrlPanOnlySpec, '9f04b1c2');
    assert.equal(derivePointerIntent(event, 'card', null), 'pan');
    assert.equal(derivePointerIntent(event, 'zone', null), 'pan');
    assert.equal(derivePointerIntent(event, 'group', null), 'pan');
    assert.equal(derivePointerIntent(event, 'canvas', null), 'pan');
    assert.equal(derivePointerIntent(event, 'card', resizeHandle), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'card', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'zone', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'group', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'canvas', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'card', resizeHandle), 'pan');
    assert.equal(derivePointerIntent(shiftEvent, 'canvas', null), 'marquee');

    const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
    const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
    assert.match(pointerDown, /const forcedPan = isForcedPanPointer\(event\)/);
    assert.match(pointerDown, /ctrlPan:\s*event\.ctrlKey,\s*forcedPan/);
    assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
    assert.match(pointerUp, /const pointerSession = state\.pointer/);
    assert.match(pointerUp, /const isForcedPan = Boolean\(pointerSession\.forcedPan \|\| pointerSession\.ctrlPan\)/);
    assert.match(pointerUp, /!isForcedPan && pointerIntent === 'pan'/);
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('card tool draws over zone and group backgrounds while select mode keeps zone pan precedence', () => {
  const previousTool = state.activeTool;
  const previousSelection = state.selection;
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };

  try {
    const zoneEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-zone-id]' ? { dataset: { zoneId: 'zone-a' } } : null } } as unknown as PointerEvent;
    const groupEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-group-id]' ? { dataset: { groupId: 'group-a' } } : null } } as unknown as PointerEvent;
    const ctrlZoneEvent = { shiftKey: false, ctrlKey: true, target: zoneEvent.target } as unknown as PointerEvent;

    state.activeTool = 'card';
    assert.equal(derivePointerIntent(zoneEvent, 'zone', null), 'draw-card');
    assert.equal(derivePointerIntent(groupEvent, 'group', null), 'draw-card');
    assert.equal(derivePointerIntent(ctrlZoneEvent, 'zone', null), 'pan');

    state.activeTool = 'select';
    assert.equal(derivePointerIntent(zoneEvent, 'zone', null), 'pan');
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('card creation preserves canvas x and y instead of clamping to positive space', () => {
  const createCard = source('frontend/src/runtime/card/effect/create-card-from-rect.ts');
  assert.match(createCard, /x:\s*rect\.x/);
  assert.match(createCard, /y:\s*rect\.y/);
  assert.doesNotMatch(createCard, /x:\s*Math\.max\(0,\s*rect\.x\)/);
  assert.doesNotMatch(createCard, /y:\s*Math\.max\(0,\s*rect\.y\)/);
});

test('direct canvas pointer down clears selection before pointer up', () => {
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  const specs = source('documentation/specs.json');

  assert.match(specs, /7d2c8b91/);
  assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
  assert.match(pointerDown, /canvas-background-pointer-down/);
  assert.match(pointerDown, /renderSelectionState\(\)/);
  assert.doesNotMatch(pointerUp, /canvas-background-click/);
  assert.doesNotMatch(pointerUp, /targetKind === 'canvas' && moved < 4[\s\S]*clear-transient-selection/);
});

test('plain pan pointer up does not force a full canvas rerender', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /const pointerIntent = pointerSession\.intent/);
  assert.match(pointerUp, /let releaseRendered = false/);
  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(gestureSelection\)/);
  assert.match(pointerUp, /if \(pointerIntent !== 'pan' && !releaseRendered\) renderCanvasSurface\(\)/);
  assert.match(pointerUp, /isClickMovement\(moved\)/);
});

test('manual runtime refresh preserves an active pan pointer and allows pan to continue', async () => {
  installCanvasRuntimeDom();
  const { refreshRuntimeState } = await import('../../src/runtime/refresh/controller/refresh-runtime-state.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 10, y: 20, scale: 1 };
  state.viewports = { specs: { x: 10, y: 20, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
  state.pointer = {
    intent: 'pan',
    targetKind: 'canvas',
    targetId: '',
    target: canvasDom.canvas,
    resizeHandle: null,
    start: { x: 100, y: 100 },
    current: { x: 100, y: 100 },
    startCanvas: { x: 100, y: 100 },
    currentCanvas: { x: 100, y: 100 },
    startedAt: 0
  };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      if (url === '/decision-os/data') return { ok: true, async json() { return {}; } };
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const refresh = refreshRuntimeState();
  await ledgerFetchStarted;
  resolveLedger({
    ok: true,
    async json() {
      return { cards: [], annotations: [], relationships: [], notes: {} };
    }
  });
  await refresh;

  assert.equal(state.pointer.intent, 'pan');
  handlePointerMove(canvasPointerEvent(130, 90));

  assert.deepEqual(state.viewport, { x: 40, y: 10, scale: 1 });
  assert.equal(canvasDom.content.style.transform, 'translate(40px, 10px) scale(1)');

  await handlePointerUp(canvasPointerEvent(130, 90));

  assert.equal(state.pointer, null);
  assert.deepEqual(JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}').viewport, { x: 40, y: 10, scale: 1 });
});

test('wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence', async () => {
  installCanvasRuntimeDom();
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handleWheel } = await import('../../src/runtime/gesture/controller/handle-wheel.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const load = loadActiveLedgerState();
  await ledgerFetchStarted;

  handleWheel(canvasWheelEvent({ clientX: 100, clientY: 80, deltaY: -120 }));
  const latestViewport = { ...state.viewport };
  assert.ok(latestViewport.scale > 1);

  resolveLedger({
    ok: true,
    async json() {
      return {
        viewport: { x: 999, y: 999, scale: 0.25 },
        cards: [],
        annotations: [],
        relationships: [],
        notes: {}
      };
    }
  });
  await load;

  assert.deepEqual(state.viewport, latestViewport);
  assert.deepEqual(state.viewports.specs, latestViewport);

  await waitForTimer(170);
  const persisted = JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}');
  assert.deepEqual(persisted.viewport, latestViewport);
  assert.deepEqual(persisted.viewports.specs, latestViewport);
});

test('wheel zoom stays transform-only and does not reroute relationships', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const scheduler = source('frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts');
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const density = source('frontend/src/runtime/canvas/helper/render-density.ts');
  const ledgerRenderer = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');
  const canvasPoint = source('frontend/src/runtime/canvas/helper/canvas-point.ts');
  const visibleCards = source('frontend/src/runtime/card/helper/visible-ledger-cards.ts');
  assert.match(wheel, /scheduleViewportTransform\(!event\.ctrlKey\)/);
  assert.match(density, /lowZoomRenderDensityThreshold = 0\.2/);
  assert.match(density, /lowZoomRenderDensity = 4/);
  assert.match(density, /state\.activeLedger && scale < lowZoomRenderDensityThreshold/);
  assert.match(density, /currentRenderDensity\(\): number \{[\s\S]*state\.activeLedger \? activeRenderDensity : 1/);
  assert.match(density, /effectiveViewportScale\(scale = Number\(state\.viewport\.scale\)\): number \{[\s\S]*scale \* currentRenderDensity\(\)/);
  assert.match(scheduler, /const animated = frameAnimated/);
  assert.match(scheduler, /const densityChanged = syncRenderDensity\(\)/);
  assert.match(scheduler, /if \(densityChanged\) \{[\s\S]*clearViewportCardDetails\(\);[\s\S]*renderLedgerSurface\(\);[\s\S]*renderSelectionState\(\);[\s\S]*renderZoneLabelOverlay\(\);[\s\S]*renderRelationshipOverlay\(\);[\s\S]*\}/);
  assert.match(scheduler, /const detailModeChanged = updateDetailMode\(\)/);
  assert.match(scheduler, /if \(densityChanged \|\| detailModeChanged\) syncViewportCardDetails\(\)/);
  assert.match(scheduler, /const animated = frameAnimated && !densityChanged/);
  assert.match(scheduler, /applyViewportTransform\(settled, animated\)/);
  assert.match(scheduler, /import \{ hideCanvasControlOverlay \} from '\.\/render-canvas-control-overlay\.js'/);
  assert.match(scheduler, /import \{ resumeCanvasMediaOverlay, suspendCanvasMediaOverlay \} from '\.\/render-canvas-media-overlay\.js'/);
  assert.match(scheduler, /if \(zooming\) \{\s*suspendCanvasMediaOverlay\(\);[\s\S]*hideCanvasControlOverlay\(\);[\s\S]*settleTimer = setTimeout\(finishZoomSettle, 120\)/);
  assert.match(scheduler, /settleTimer = setTimeout\(finishZoomSettle, 120\)/);
  assert.match(scheduler, /applyViewportSettledEffects\(\);[\s\S]*resumeCanvasMediaOverlay\(\)/);
  assert.doesNotMatch(scheduler, /syncScaleCssVars|applyViewportScaleCssVars/);
  assert.doesNotMatch(scheduler, /is-zooming|state\.viewport\.scale < 0\.35|classList\.add|classList\.remove/);
  assert.match(viewport, /export function applyViewportSettledEffects\(\)/);
  assert.match(viewport, /viewportTransformTransition = 'transform 90ms cubic-bezier/);
  assert.match(viewport, /export function applyViewportTransform\(settled = true, animated = false\)/);
  assert.match(viewport, /applyViewportTransformTransition\(animated\)/);
  assert.match(viewport, /content\.style\.transform = `translate\(\$\{x\}px, \$\{y\}px\) scale\(\$\{effectiveViewportScale\(\)\}\)`/);
  assert.match(ledgerRenderer, /syncRenderDensity\(\)/);
  assert.match(canvasPoint, /state\.viewport\.scale/);
  assert.doesNotMatch(canvasPoint, /effectiveViewportScale|currentRenderDensity|renderDensity/);
  assert.match(visibleCards, /const scale = Math\.max\(0\.0001, finiteNumber\(viewport\.scale, 1\)\)/);
  assert.doesNotMatch(visibleCards, /effectiveViewportScale|currentRenderDensity|renderDensity/);
  assert.doesNotMatch(wheel, /renderRelationshipOverlay/);
});

test('canvas debug overlay is URL-param gated and reports zoom density state', () => {
  const debugRuntime = source('frontend/src/runtime/debug/effect/render-canvas-debug-overlay.ts');
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const pan = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const surface = source('frontend/src/runtime/canvas/effect/render-canvas-surface.ts');
  const canvasCss = source('frontend/assets/canvas.css');
  const debugCss = source('frontend/assets/canvas/debug.css');

  assert.match(canvasCss, /@import url\('\.\/canvas\/debug\.css'\)/);
  assert.match(debugRuntime, /params\.has\('canvasDebug'\)/);
  assert.match(debugRuntime, /params\.get\('debug'\) === 'canvas'/);
  assert.match(debugRuntime, /params\.get\('debugCanvas'\) === '1'/);
  assert.match(debugRuntime, /if \(!canvasDebugEnabled\(\)\) return/);
  assert.match(debugRuntime, /className = 'canvas-debug-overlay'/);
  assert.match(debugRuntime, /row\('raw zoom', formatNumber\(state\.viewport\.scale, 4\)\)/);
  assert.match(debugRuntime, /row\('effective zoom', formatNumber\(effectiveViewportScale\(\), 4\)\)/);
  assert.match(debugRuntime, /row\('render density', String\(currentRenderDensity\(\)\)\)/);
  assert.match(debugRuntime, /row\('detail mode', detailMode\(\)\)/);
  assert.match(debugRuntime, /row\('detail DOM', String\(count\(':scope > \.card \.ledger-card-detail-layer'\)\)\)/);
  assert.match(debugRuntime, /row\('transform', content\?\.style\.transform \|\| 'none'\)/);
  assert.doesNotMatch(debugRuntime, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(viewport, /renderCanvasDebugOverlay\(settled \? 'viewport-settled' : 'viewport-frame'\)/);
  assert.match(pan, /renderCanvasDebugOverlay\('pan'\)/);
  assert.match(surface, /renderCanvasDebugOverlay\('surface'\)/);
  assert.match(surface, /options: \{ renderThreadPanel\?: boolean \} = \{\}/);
  assert.match(surface, /if \(options\.renderThreadPanel !== false\) renderThreadPanel\(\)/);
  assert.match(debugCss, /\.canvas-debug-overlay\s*{[^}]*position:\s*fixed;[^}]*z-index:\s*10000;/s);
  assert.match(debugCss, /\.canvas-debug-overlay table\s*{[^}]*border-collapse:\s*collapse;/s);
});

test('normal detail reveal is viewport-local and layout-free', () => {
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const pan = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const sync = source('frontend/src/runtime/canvas/effect/sync-viewport-card-details.ts');
  const cardRenderer = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const detailRenderer = source('frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts');
  const detailMode = source('frontend/src/runtime/canvas/effect/update-detail-mode.ts');
  const cardPatch = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const zonePatch = source('frontend/src/runtime/ledger/component/patch-ledger-zone.ts');
  const relationships = source('frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts');
  const css = source('frontend/assets/canvas/canvas-layer.css');
  const objects = source('frontend/assets/canvas/objects.css');

  assert.match(viewport, /syncViewportCardDetails\(\)/);
  assert.match(pan, /syncViewportCardDetails\(\)/);
  assert.match(pan, /content\.style\.transition !== 'none'/);
  assert.match(pan, /scale\(\$\{effectiveViewportScale\(\)\}\)/);
  assert.match(cardPatch, /const renderedGeometry = renderGeometry\(geometry\)/);
  assert.match(cardPatch, /element\.style\.left = `\$\{renderedGeometry\.x\}px`/);
  assert.match(cardPatch, /element\.style\.minHeight = `\$\{renderedGeometry\.height\}px`/);
  assert.match(zonePatch, /const renderedGeometry = renderGeometry\(geometry\)/);
  assert.match(zonePatch, /element\.style\.minHeight = `\$\{renderedGeometry\.height\}px`/);
  assert.match(relationships, /overlay\.setAttribute\('viewBox', `0 0 \$\{bounds\.width\} \$\{bounds\.height\}`\)/);
  assert.match(relationships, /overlay\.style\.width = `\$\{renderLength\(bounds\.width\)\}px`/);
  assert.match(sync, /const detailedCardIds = new Set<string>\(\)/);
  assert.match(sync, /activeLedgerCardMap\(\)/);
  assert.match(sync, /viewportWorldBounds\(state\.viewport, viewportCanvasSize\(\)\)/);
  assert.match(sync, /canvasBoundsIntersect\(ledgerCardBounds\(ledgerCard\), bounds\)/);
  assert.match(sync, /renderLedgerCardDetailLayer\(ledgerCard\)/);
  assert.match(sync, /directChildByClass\(card, 'ledger-card-detail-layer'\)/);
  assert.match(sync, /directChildByClass\(card, 'ledger-card-detail-layer'\)\?\.remove\(\)/);
  assert.match(sync, /export function clearViewportCardDetails\(\)/);
  assert.match(sync, /content\.querySelectorAll\(':scope > \.card\.detail-visible, :scope > \.card > \.ledger-card-detail-layer'\)/);
  assert.match(sync, /detailedCardIds\.clear\(\)/);
  assert.match(sync, /if \(canvas\.classList\.contains\('low-detail'\)\) \{[\s\S]*clearViewportCardDetails\(\);[\s\S]*return;/);
  assert.match(detailMode, /export function updateDetailMode\(\): boolean/);
  assert.match(detailMode, /return hasLowDetail !== shouldUseLowDetail \|\| hasOverviewDetail !== shouldUseOverviewDetail/);
  assert.doesNotMatch(detailMode, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(sync, /classList\.add\('detail-visible'\)/);
  assert.match(sync, /classList\.remove\('detail-visible'\)/);
  assert.doesNotMatch(sync, /querySelectorAll<HTMLElement>\(':scope > \.card\[data-card-id\]'\)/);
  assert.doesNotMatch(sync, /classList\.toggle\('detail-visible'/);
  assert.match(cardRenderer, /const detailVisible = element\.className\.split\(\/\\s\+\/\)\.includes\('detail-visible'\)/);
  assert.match(cardRenderer, /card ledger-node\$\{detailVisible \? ' detail-visible' : ''\}/);
  assert.match(cardRenderer, /mountedDetail \? renderLedgerCardDetailLayer\(card, mountedDetail\) : null/);
  assert.doesNotMatch(cardRenderer, /renderLedgerCardMarkdown\(ledgerCardBody\(card\)/);
  assert.match(detailRenderer, /renderLedgerCardMarkdown\(ledgerCardBody\(card\)/);
  assert.match(detailRenderer, /renderLedgerCardTabFrame\(card, fields, activeTab\)/);
  assert.doesNotMatch(sync, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-detail-layer/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-overview-layer/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-detail-layer/);
  assert.match(objects, /\.ledger-card-detail-layer\s*{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s);
  assert.match(objects, /\.card\.detail-visible \.ledger-card-detail-layer\s*{[^}]*opacity:\s*1;[^}]*transition:\s*opacity 160ms ease-out;/s);
  assert.match(objects, /\.card:not\(\.detail-visible\),\s*\.card\.connected:not\(\.detail-visible\)\s*{[^}]*box-shadow:\s*none;/s);
  assert.doesNotMatch(cardRenderer, /const body = hasFieldTabs/);
});
/**
 * WHAT: Regression coverage for card drag release while the geometry commit is still in flight.
 * WHY: Releasing the pointer must freeze the card at the release coordinate, not at a later cursor move.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

type FakeElement = {
  tagName: string;
  id: string;
  className: string;
  dataset: Record<string, string>;
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
    minHeight: string;
    display: string;
    transition: string;
    transform: string;
    visibility: string;
    color: string;
    textShadow: string;
    setProperty(name: string, value: string): void;
    getPropertyValue(name: string): string;
    removeProperty(name: string): void;
  };
  hidden: boolean;
  textContent: string;
  innerHTML: string;
  type: string;
  title: string;
  ariaLabel: string;
  value: string;
  disabled: boolean;
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientWidth: number;
  clientHeight: number;
  childElementCount: number;
  children: FakeElement[];
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  parentElement: FakeElement | null;
  isConnected: boolean;
  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  matches(selector: string): boolean;
  closest(selector: string): FakeElement | null;
  append(...nodes: FakeElement[]): void;
  appendChild(node: FakeElement): FakeElement;
  insertBefore(node: FakeElement, before: FakeElement | null): void;
  replaceChildren(...nodes: FakeElement[]): void;
  remove(): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
  addEventListener(): void;
  removeEventListener(): void;
  blur(): void;
  scrollTo(options?: unknown): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
};

type RuntimeDom = {
  root: FakeElement;
  canvas: FakeElement;
  content: FakeElement;
  controlOverlay: FakeElement;
  mediaOverlay: FakeElement;
  telemetryList: FakeElement;
  marquee: FakeElement;
  panel: FakeElement;
  threadPanel: FakeElement;
  shell: FakeElement;
  threadTarget: FakeElement;
  threadHeading: FakeElement;
  tabs: FakeElement;
  topbarTitle: FakeElement;
  kicker: FakeElement;
};

const runtimeDom = createRuntimeDom();

function fakeElement(dataset: Record<string, string> = {}, tagName = 'div'): FakeElement {
  const customProperties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const style = {
    left: '0px',
    top: '0px',
    width: '120px',
    height: '80px',
    minHeight: '',
    display: '',
    transition: '',
    transform: '',
    visibility: '',
    color: '',
    textShadow: '',
    setProperty(name: string, value: string) {
      customProperties.set(name, value);
    },
    getPropertyValue(name: string) {
      return customProperties.get(name) ?? '';
    },
    removeProperty(name: string) {
      customProperties.delete(name);
    }
  };
  const element: FakeElement = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    dataset,
    style,
    hidden: false,
    textContent: '',
    innerHTML: '',
    type: '',
    title: '',
    ariaLabel: '',
    value: '',
    disabled: false,
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientWidth: 120,
    clientHeight: 80,
    children: [],
    parentElement: null,
    isConnected: true,
    get childElementCount() { return element.children.length; },
    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
    classList: {
      toggle(name: string, force?: boolean) {
        const classes = classSet(element);
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
        return shouldAdd;
      },
      add(...names: string[]) {
        const classes = classSet(element);
        for (const name of names) classes.add(name);
        element.className = [...classes].join(' ');
      },
      remove(...names: string[]) {
        const classes = classSet(element);
        for (const name of names) classes.delete(name);
        element.className = [...classes].join(' ');
      },
      contains(name: string) {
        return classSet(element).has(name);
      }
    },
    querySelector(selector: string) {
      return element.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector: string) {
      return queryAll(element, selector);
    },
    matches(selector: string) {
      return matchesSelectorList(element, selector);
    },
    closest(selector: string) {
      let current: FakeElement | null = element;
      while (current) {
        if (matchesSelectorList(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    append(...nodes: FakeElement[]) {
      for (const node of nodes) appendChildElement(element, node);
    },
    appendChild(node: FakeElement) {
      appendChildElement(element, node);
      return node;
    },
    insertBefore(node: FakeElement, before: FakeElement | null) {
      detach(node);
      const index = before ? element.children.indexOf(before) : -1;
      if (index >= 0) element.children.splice(index, 0, node);
      else element.children.push(node);
      node.parentElement = element;
      markConnected(node, true);
    },
    replaceChildren(...nodes: FakeElement[]) {
      for (const child of element.children) {
        child.parentElement = null;
        markConnected(child, false);
      }
      element.children = [];
      element.append(...nodes);
    },
    remove() {
      detach(element);
      markConnected(element, false);
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
      if (name.startsWith('data-')) element.dataset[dataKey(name.slice(5))] = value;
    },
    getAttribute(name: string) {
      if (name === 'id') return element.id || null;
      if (name === 'class') return element.className || null;
      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] ?? null;
      return attributes.get(name) ?? null;
    },
    hasAttribute(name: string) {
      if (name === 'id') return Boolean(element.id);
      if (name === 'class') return Boolean(element.className);
      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] !== undefined;
      return attributes.has(name);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
      if (name === 'id') element.id = '';
      if (name === 'class') element.className = '';
      if (name.startsWith('data-')) delete element.dataset[dataKey(name.slice(5))];
    },
    addEventListener() {},
    removeEventListener() {},
    blur() {},
    scrollTo(options?: unknown) {
      const scroll = options as { left?: number; top?: number } | undefined;
      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
    },
    getBoundingClientRect() {
      return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
    }
  };
  return element;
}

function createRuntimeDom(): RuntimeDom {
  const root = fakeElement({}, 'document');
  const canvas = fakeElement({}, 'div');
  const content = fakeElement({}, 'div');
  const controlOverlay = fakeElement({}, 'div');
  const mediaOverlay = fakeElement({}, 'div');
  const telemetryList = fakeElement({}, 'ol');
  const marquee = fakeElement({}, 'div');
  const panel = fakeElement({}, 'aside');
  const threadPanel = fakeElement({}, 'aside');
  const shell = fakeElement({}, 'div');
  const threadTarget = fakeElement({}, 'div');
  const threadHeading = fakeElement({}, 'div');
  const tabs = fakeElement({}, 'nav');
  const topbarTitle = fakeElement({}, 'button');
  const kicker = fakeElement({}, 'span');
  canvas.className = 'canvas';
  content.className = 'canvas-content';
  controlOverlay.className = 'canvas-control-overlay';
  mediaOverlay.className = 'canvas-media-overlay';
  telemetryList.className = 'telemetry-list';
  marquee.className = 'marquee';
  panel.className = 'panel';
  threadPanel.className = 'thread-panel';
  shell.className = 'shell';
  threadTarget.className = 'thread-target';
  threadHeading.className = 'thread-heading';
  tabs.className = 'tabs';
  topbarTitle.className = 'topbar-title-action';
  kicker.className = 'kicker';
  root.append(canvas, telemetryList, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker);
  canvas.append(content, controlOverlay, mediaOverlay);
  content.append(marquee);
  return { root, canvas, content, controlOverlay, mediaOverlay, telemetryList, marquee, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker };
}

function installRuntimeDom(): RuntimeDom {
  resetRuntimeDom();
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 1000,
    innerHeight: 800,
    devicePixelRatio: 1,
    __coreTelemetry: [],
    location: { pathname: '/specs' },
    addEventListener() {},
    dispatchEvent() {},
    visualViewport: { addEventListener() {} }
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: FakeElement) => ({
    display: node.style.display || 'block',
    color: node.style.color || '',
    textShadow: node.style.textShadow || '',
    getPropertyValue: (name: string) => node.style.getPropertyValue(name)
  });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 0;
  };
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };
  (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
  (globalThis as unknown as { SVGElement: unknown }).SVGElement = class SVGElement {};
  (globalThis as unknown as { SVGSVGElement: unknown }).SVGSVGElement = class SVGSVGElement {};
  (globalThis as unknown as { SVGPathElement: unknown }).SVGPathElement = class SVGPathElement {};
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
  const storage = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value));
    },
    removeItem(key: string) {
      storage.delete(key);
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    title: '',
    fonts: { ready: Promise.resolve() },
    activeElement: fakeElement(),
    querySelector(selector: string) {
      return runtimeDom.root.querySelector(selector);
    },
    querySelectorAll(selector: string) {
      return runtimeDom.root.querySelectorAll(selector);
    },
    createElement(tagName: string) {
      return fakeElement({}, tagName);
    },
    createTextNode(text: string) {
      const node = fakeElement({}, '#text');
      node.textContent = text;
      return node;
    },
    createElementNS(_namespace: string, tagName: string) {
      return fakeElement({}, tagName);
    }
  };
  return runtimeDom;
}

function resetRuntimeDom(): void {
  for (const element of Object.values(runtimeDom)) {
    element.children = [];
    element.parentElement = null;
    element.isConnected = true;
    element.hidden = false;
    element.textContent = '';
    element.innerHTML = '';
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.width = '120px';
    element.style.height = '80px';
    element.style.minHeight = '';
    element.style.display = '';
    element.style.transition = '';
    element.style.transform = '';
    element.style.visibility = '';
  }
  runtimeDom.canvas.className = 'canvas';
  runtimeDom.canvas.style.width = '1000px';
  runtimeDom.canvas.style.height = '800px';
  runtimeDom.content.className = 'canvas-content';
  runtimeDom.controlOverlay.className = 'canvas-control-overlay';
  runtimeDom.mediaOverlay.className = 'canvas-media-overlay';
  runtimeDom.telemetryList.className = 'telemetry-list';
  runtimeDom.marquee.className = 'marquee';
  runtimeDom.marquee.hidden = true;
  runtimeDom.panel.className = 'panel';
  runtimeDom.threadPanel.className = 'thread-panel';
  runtimeDom.shell.className = 'shell';
  runtimeDom.threadTarget.className = 'thread-target';
  runtimeDom.threadHeading.className = 'thread-heading';
  runtimeDom.tabs.className = 'tabs';
  runtimeDom.topbarTitle.className = 'topbar-title-action';
  runtimeDom.kicker.className = 'kicker';
  runtimeDom.root.append(runtimeDom.canvas, runtimeDom.telemetryList, runtimeDom.panel, runtimeDom.threadPanel, runtimeDom.shell, runtimeDom.threadTarget, runtimeDom.threadHeading, runtimeDom.tabs, runtimeDom.topbarTitle, runtimeDom.kicker);
  runtimeDom.canvas.append(runtimeDom.content, runtimeDom.controlOverlay, runtimeDom.mediaOverlay);
  runtimeDom.content.append(runtimeDom.marquee);
}

function classSet(element: FakeElement): Set<string> {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

function appendChildElement(parent: FakeElement, child: FakeElement): void {
  detach(child);
  parent.children.push(child);
  child.parentElement = parent;
  markConnected(child, true);
}

function detach(element: FakeElement): void {
  const parent = element.parentElement;
  if (!parent) return;
  parent.children = parent.children.filter((child) => child !== element);
  element.parentElement = null;
}

function markConnected(element: FakeElement, connected: boolean): void {
  element.isConnected = connected;
  for (const child of element.children) markConnected(child, connected);
}

function dataKey(attribute: string): string {
  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function descendants(element: FakeElement): FakeElement[] {
  return element.children.flatMap((child) => [child, ...descendants(child)]);
}

function queryAll(root: FakeElement, selector: string): FakeElement[] {
  const matches: FakeElement[] = [];
  const seen = new Set<FakeElement>();
  for (const rawPart of selector.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const direct = part.startsWith(':scope > ');
    const normalized = part.replace(/^:scope\s*>\s*/, '').trim();
    const candidates = direct ? root.children : descendants(root);
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      if (matchesSelector(candidate, normalized)) {
        seen.add(candidate);
        matches.push(candidate);
      }
    }
  }
  return matches;
}

function matchesSelectorList(element: FakeElement, selector: string): boolean {
  return selector.split(',').some((part) => matchesSelector(element, part.trim()));
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  if (!selector) return false;
  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
  remaining = remaining.replace(/:not\([^)]+\)/g, '');
  if (notMatches.some((notSelector) => matchesSelector(element, notSelector))) return false;

  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;
  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');

  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  const classes = classSet(element);
  if (classMatches.some((className) => !classes.has(className))) return false;
  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');

  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
  for (const [, attribute, expected] of attributeMatches) {
    const actual = attribute.startsWith('data-') ? element.dataset[dataKey(attribute.slice(5))] : element.getAttribute(attribute);
    if (expected === undefined) {
      if (actual === undefined || actual === null) return false;
    } else if (actual !== expected) return false;
  }
  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();

  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
  return true;
}

function pointerEvent(input: { target?: FakeElement; clientX: number; clientY: number; pointerId?: number; shiftKey?: boolean; ctrlKey?: boolean; button?: number; buttons?: number }): PointerEvent {
  return {
    target: input.target ?? runtimeDom.canvas,
    clientX: input.clientX,
    clientY: input.clientY,
    pointerId: input.pointerId ?? 1,
    shiftKey: input.shiftKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    button: input.button ?? 0,
    buttons: input.buttons ?? 1,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as PointerEvent;
}

function appendLedgerCard(id: string, x: number, y: number, width = 240, height = 132): FakeElement {
  const card = fakeElement({ cardId: id }, 'article');
  card.className = 'card ledger-node';
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  card.style.width = `${width}px`;
  card.style.height = `${height}px`;
  runtimeDom.content.insertBefore(card, runtimeDom.marquee);
  return card;
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
  const { canvas, content } = installRuntimeDom();
  const card = appendLedgerCard('card-a', 20, 20, 120, 80);
  card.style.left = '20px';
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-27","timestamp":"2026-07-10T04:38:00.274Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"27","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_14","codexTool":"/usr/bin/zsh -lc \"find frontend/src/runtime -maxdepth 2 -type d | sort\nfind frontend/src -maxdepth 3 -type d | rg '/(shared|common|dom|util|helper)\"'$'\"'\nfind frontend/test -maxdepth 3 -type d | rg 'fixture' || true\nrg -n \\\"selectedTargets\\\\(|function renderCanvasControlOverlay|export function renderCanvasControlOverlay\\\" frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\nsed -n '190,240p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\nsed -n '1,120p' frontend/src/runtime/selection/helper/selection-includes-target.ts\nsed -n '1,100p' frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts\nsed -n '1,140p' frontend/src/runtime/ledger/effect/load-active-ledger-state.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "find frontend/src/runtime -maxdepth 2 -type d | sort
find frontend/src -maxdepth 3 -type d | rg '/(shared|common|dom|util|helper)"'$'"'
find frontend/test -maxdepth 3 -type d | rg 'fixture' || true
rg -n \"selectedTargets\\(|function renderCanvasControlOverlay|export function renderCanvasControlOverlay\" frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
sed -n '190,240p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
sed -n '1,120p' frontend/src/runtime/selection/helper/selection-includes-target.ts
sed -n '1,100p' frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts
sed -n '1,140p' frontend/src/runtime/ledger/effect/load-active-ledger-state.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-28","timestamp":"2026-07-10T04:38:00.274Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"28","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_14","codexTool":"/usr/bin/zsh -lc \"find frontend/src/runtime -maxdepth 2 -type d | sort\nfind frontend/src -maxdepth 3 -type d | rg '/(shared|common|dom|util|helper)\"'$'\"'\nfind frontend/test -maxdepth 3 -type d | rg 'fixture' || true\nrg -n \\\"selectedTargets\\\\(|function renderCanvasControlOverlay|export function renderCanvasControlOverlay\\\" frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\nsed -n '190,240p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\nsed -n '1,120p' frontend/src/runtime/selection/helper/selection-includes-target.ts\nsed -n '1,100p' frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts\nsed -n '1,140p' frontend/src/runtime/ledger/effect/load-active-ledger-state.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "find frontend/src/runtime -maxdepth 2 -type d | sort
find frontend/src -maxdepth 3 -type d | rg '/(shared|common|dom|util|helper)"'$'"'
find frontend/test -maxdepth 3 -type d | rg 'fixture' || true
rg -n \"selectedTargets\\(|function renderCanvasControlOverlay|export function renderCanvasControlOverlay\" frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
sed -n '190,240p' frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
sed -n '1,120p' frontend/src/runtime/selection/helper/selection-includes-target.ts
sed -n '1,100p' frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts
sed -n '1,140p' frontend/src/runtime/ledger/effect/load-active-ledger-state.ts"`
Status: completed
Exit code: 0

````text
frontend/src/runtime
frontend/src/runtime/boot
frontend/src/runtime/boot/controller
frontend/src/runtime/canvas
frontend/src/runtime/canvas/effect
frontend/src/runtime/canvas/helper
frontend/src/runtime/card
frontend/src/runtime/card/component
frontend/src/runtime/card/controller
frontend/src/runtime/card/effect
frontend/src/runtime/card/helper
frontend/src/runtime/clipboard
frontend/src/runtime/clipboard/controller
frontend/src/runtime/codex
frontend/src/runtime/codex/component
frontend/src/runtime/codex/controller
frontend/src/runtime/codex/effect
frontend/src/runtime/codex/helper
frontend/src/runtime/debug
frontend/src/runtime/debug/effect
frontend/src/runtime/gesture
frontend/src/runtime/gesture/controller
frontend/src/runtime/gesture/effect
frontend/src/runtime/gesture/helper
frontend/src/runtime/group
frontend/src/runtime/group/controller
frontend/src/runtime/group/effect
frontend/src/runtime/group/helper
frontend/src/runtime/input
frontend/src/runtime/input/controller
frontend/src/runtime/input/effect
frontend/src/runtime/input/helper
frontend/src/runtime/ledger
frontend/src/runtime/ledger/component
frontend/src/runtime/ledger/effect
frontend/src/runtime/ledger/helper
frontend/src/runtime/navigation
frontend/src/runtime/navigation/controller
frontend/src/runtime/navigation/effect
frontend/src/runtime/navigation/helper
frontend/src/runtime/persistence
frontend/src/runtime/persistence/effect
frontend/src/runtime/persistence/helper
frontend/src/runtime/refresh
frontend/src/runtime/refresh/controller
frontend/src/runtime/refresh/effect
frontend/src/runtime/relationship
frontend/src/runtime/relationship/component
frontend/src/runtime/relationship/effect
frontend/src/runtime/relationship/helper
frontend/src/runtime/selection
frontend/src/runtime/selection/controller
frontend/src/runtime/selection/effect
frontend/src/runtime/selection/helper
frontend/src/runtime/telemetry
frontend/src/runtime/telemetry/effect
frontend/src/runtime/thread
frontend/src/runtime/thread/controller
frontend/src/runtime/thread/effect
frontend/src/runtime/thread/helper
frontend/src/runtime/toolbox
frontend/src/runtime/toolbox/controller
frontend/src/runtime/toolbox/effect
frontend/src/runtime/voice
frontend/src/runtime/voice/component
frontend/src/runtime/voice/controller
frontend/src/runtime/voice/effect
frontend/src/runtime/voice/helper
frontend/src/runtime/voice/services
frontend/src/runtime/zone
frontend/src/runtime/zone/controller
frontend/src/runtime/zone/effect
frontend/src/runtime/zone/helper
frontend/src/runtime/relationship/helper
frontend/src/runtime/voice/helper
frontend/src/runtime/navigation/helper
frontend/src/runtime/persistence/helper
frontend/src/runtime/ledger/helper
frontend/src/runtime/group/helper
frontend/src/runtime/card/helper
frontend/src/runtime/gesture/helper
frontend/src/runtime/canvas/helper
frontend/src/runtime/thread/helper
frontend/src/runtime/selection/helper
frontend/src/runtime/zone/helper
frontend/src/runtime/codex/helper
frontend/src/runtime/input/helper
frontend/src/business/relationship/helper
frontend/src/business/refresh/helper
frontend/src/business/voice/helper
frontend/src/business/navigation/helper
frontend/src/business/toolbox/helper
frontend/src/business/group/helper
frontend/src/business/card/helper
frontend/src/business/gesture/helper
frontend/src/business/boot/helper
frontend/src/business/canvas/helper
frontend/src/business/thread/helper
frontend/src/business/selection/helper
frontend/src/business/zone/helper
75:function selectedTargets(): ControlTarget[] {
84:  for (const target of selectedTargets()) byKey.set(targetKey(target), target);
207:export function renderCanvasControlOverlay(): void {
    controls.push(color);
  } else if (zone.classList.contains('ledger-node')) {
    const deleteButton = document.createElement('button');
    deleteButton.className = 'ledger-group-delete terminal-button terminal-button--compact';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'confirm-delete-group';
    deleteButton.dataset.groupId = id;
    deleteButton.title = 'Delete group';
    deleteButton.setAttribute('aria-label', 'Delete group');
    deleteButton.textContent = 'X';
    controls.push(deleteButton);
  }

  group.replaceChildren(...controls);
  return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);
}

export function renderCanvasControlOverlay(): void {
  if (controlsDisabled()) {
    clearCanvasControlOverlay();
    return;
  }
  const overlay = resolveControlOverlay();
  if (!overlay || !canvas || !content) return;
  const activeKeys = new Set<string>();
  for (const target of visibleTargets()) {
    const source = sourceElement(target);
    if (!source || source.hidden || source.style.display === 'none') continue;
    const key = targetKey(target);
    let control = overlay.querySelector(`[data-control-key="${CSS.escape(key)}"]`) as HTMLElement | null;
    const isNew = !control;
    if (!control) {
      control = document.createElement('div');
      control.dataset.controlKey = key;
    }
    const visible = target.kind === 'card'
      ? syncCardControls(control, source)
      : syncZoneControls(control, source, target.kind);
    if (!visible) continue;
    activeKeys.add(key);
    cancelScheduledRemoval(control);
    if (isNew) {
      overlay.append(control);
      nextFrame(() => nextFrame(() => control?.classList.add('is-visible')));
    } else {
      control.classList.add('is-visible');
    }
  }
  for (const control of Array.from(overlay.querySelectorAll('.canvas-control')) as HTMLElement[]) {
    if (!activeKeys.has(control.dataset.controlKey ?? '')) scheduleRemoval(control);
  }
type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };

export function selectionIncludesTarget(selection: SelectionState, kind: string, id: string): boolean {
  if (!id) return false;
  if (kind === 'card') return selection.cardIds.includes(id);
  if (kind === 'zone') return selection.zoneIds.includes(id);
  if (kind === 'group') return selection.groupIds.includes(id);
  return false;
}
/**
 * WHAT: Decides whether pointer down should keep the current selection set.
 * WHY: Direct card clicks must be able to escape zone-expanded selections.
 */
import { selectionIncludesTarget } from './selection-includes-target.js';

type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };

export const directCardClickReplacesZoneSelectionSpec = 'a6c2f0d4';

export function shouldPreservePointerSelection(selection: SelectionState, kind: string, id: string, additive: boolean): boolean {
  if (additive) return false;
  if (kind === 'card' && selection.zoneIds.length > 0) return false;
  return selectionIncludesTarget(selection, kind, id);
}
/**
 * WHAT: Loads the active route ledger from the backend.
 * WHY: Server ledgers are authoritative, while optimistic thread notes must survive stale refreshes.
 */
import { emptySelectionState, restoreSelectionFromPointerSnapshot, state } from '../../state.js';
import { pruneSelectionToActiveLedger } from '../helper/active-ledger-geometry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import { mergeLocalCanvasStateIntoLedger } from '../helper/merge-local-canvas-state.js';
import { mergeLocalThreadNotes } from '../helper/merge-local-thread-notes.js';
import { refreshZoneAttributionCache } from '../helper/zone-attribution-cache.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function loadActiveLedgerState(): Promise<void> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  const ledgerStateId = state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab;
  const canMergeLocalCanvas = Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
  const canPreserveSelection = canMergeLocalCanvas;
  const localLedger = canMergeLocalCanvas ? state.activeLedger : null;
  if (!endpoint) {
    state.activeLedger = null;
    state.activeLedgerId = '';
    state.selection = emptySelectionState();
    refreshZoneAttributionCache('missing-ledger-tab');
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false, source: 'missing-ledger-tab' });
    return;
  }
  const response = await fetch(endpoint).catch(() => undefined);
  if (!response?.ok) {
    state.activeLedger = null;
    state.activeLedgerId = '';
    state.selection = emptySelectionState();
    refreshZoneAttributionCache('load-failed');
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false });
    return;
  }
  const ledger = await response.json().catch(() => null);
  const canKeepCurrentViewport = Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
  const localViewport = canKeepCurrentViewport ? { ...state.viewport } : null;
  state.activeLedger = mergeLocalThreadNotes(canMergeLocalCanvas ? mergeLocalCanvasStateIntoLedger(ledger, localLedger) : ledger);
  state.activeLedgerId = ledgerStateId;
  refreshZoneAttributionCache('load-active-ledger-state');
  if (localViewport) {
    Object.assign(state.viewport, localViewport);
    if (state.canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...localViewport } };
  } else if (state.canvasMode === 'ledgers') Object.assign(state.viewport, ledger?.viewport ?? state.viewport);
  else Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? ledger?.viewport ?? state.viewport);
  if (canPreserveSelection) {
    state.selection = pruneSelectionToActiveLedger(state.selection);
    restoreSelectionFromPointerSnapshot(ledgerStateId);
  } else {
    state.selection = emptySelectionState();
  }
  telemetry('load-ledger-state', { activeTab: state.activeTab, canvasMode: state.canvasMode, ok: Boolean(ledger), cards: ledger?.cards?.length ?? 0, relationships: ledger?.relationships?.length ?? 0 });
}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-29","timestamp":"2026-07-10T04:38:20.010Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"29","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_15","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"selection/effect/move-selected|moveSelected\\\\(\\\" frontend/src frontend/test tests | head -160\nrg -n \\\"resizeSelectedCard|resizeSelectedZone|commitSelectedLedgerGeometry|loadActiveLedgerState\\\" frontend/test | head -200\nrg -n \\\"state\\\\.ts|active-ledger-geometry|resize-selected-card|resize-selected-zone|move-selected\\\" frontend/test/runtime/{active-ledger-zone-lifecycle.integration.test.ts,canvas-pan-performance.integration.test.ts,drag-release-freeze.integration.test.ts,ledger-content-refresh.integration.test.ts} tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"selection/effect/move-selected|moveSelected\\(\" frontend/src frontend/test tests | head -160
rg -n \"resizeSelectedCard|resizeSelectedZone|commitSelectedLedgerGeometry|loadActiveLedgerState\" frontend/test | head -200
rg -n \"state\\.ts|active-ledger-geometry|resize-selected-card|resize-selected-zone|move-selected\" frontend/test/runtime/{active-ledger-zone-lifecycle.integration.test.ts,canvas-pan-performance.integration.test.ts,drag-release-freeze.integration.test.ts,ledger-content-refresh.integration.test.ts} tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-30","timestamp":"2026-07-10T04:38:20.010Z","status":"failed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"30","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_15","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"selection/effect/move-selected|moveSelected\\\\(\\\" frontend/src frontend/test tests | head -160\nrg -n \\\"resizeSelectedCard|resizeSelectedZone|commitSelectedLedgerGeometry|loadActiveLedgerState\\\" frontend/test | head -200\nrg -n \\\"state\\\\.ts|active-ledger-geometry|resize-selected-card|resize-selected-zone|move-selected\\\" frontend/test/runtime/{active-ledger-zone-lifecycle.integration.test.ts,canvas-pan-performance.integration.test.ts,drag-release-freeze.integration.test.ts,ledger-content-refresh.integration.test.ts} tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\"","codexExitCode":"1"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"selection/effect/move-selected|moveSelected\\(\" frontend/src frontend/test tests | head -160
rg -n \"resizeSelectedCard|resizeSelectedZone|commitSelectedLedgerGeometry|loadActiveLedgerState\" frontend/test | head -200
rg -n \"state\\.ts|active-ledger-geometry|resize-selected-card|resize-selected-zone|move-selected\" frontend/test/runtime/{active-ledger-zone-lifecycle.integration.test.ts,canvas-pan-performance.integration.test.ts,drag-release-freeze.integration.test.ts,ledger-content-refresh.integration.test.ts} tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: failed
Exit code: 1

````text
frontend/test/runtime/input-controller-routing.integration.test.ts:140:    'frontend/src/runtime/selection/effect/move-selected.ts',
frontend/test/runtime/relationship-ledger-geometry-performance.integration.test.ts:34:  const moveSelected = source('frontend/src/runtime/selection/effect/move-selected.ts');
frontend/test/runtime/zone-label-overlay.integration.test.ts:20:  const moveSelected = source('frontend/src/runtime/selection/effect/move-selected.ts');
frontend/src/runtime/gesture/controller/handle-pointer-move.ts:9:import { moveSelected } from '../../selection/effect/move-selected.js';
frontend/src/runtime/gesture/controller/handle-pointer-move.ts:45:    moveSelected(canvasDx, canvasDy, state.pointer.selectionSnapshot ?? state.selection);
frontend/src/runtime/gesture/controller/handle-pointer-up.ts:18:import { moveSelected } from '../../selection/effect/move-selected.js';
frontend/src/runtime/gesture/controller/handle-pointer-up.ts:77:      if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);
frontend/src/runtime/selection/effect/move-selected.ts:9:export function moveSelected(dx: number, dy: number, selection: Partial<SelectionState> = state.selection): void {
frontend/test/runtime/input-controller-routing.integration.test.ts:20:  assert.match(pointerUp, /commitSelectedLedgerGeometry/);
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:239:  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:278:  await loadActiveLedgerState();
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:306:  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:346:  await loadActiveLedgerState();
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:370:  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:395:  const load = loadActiveLedgerState();
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:431:  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:474:  await loadActiveLedgerState();
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:13:import { loadActiveLedgerState } from '../../src/runtime/ledger/effect/load-active-ledger-state.js';
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:553:    await loadActiveLedgerState();
frontend/test/runtime/keyboard-card-resize-shortcut.integration.test.ts:16:  assert.match(keyboard, /resizeSelectedCardsController/);
frontend/test/runtime/keyboard-card-resize-shortcut.integration.test.ts:18:  assert.match(keyboard, /event\.preventDefault\(\);\s*\n\s*await resizeSelectedCardsController\(\);/);
frontend/test/runtime/keyboard-card-resize-shortcut.integration.test.ts:19:  assert.match(actionClick, /action === 'resize'[\s\S]*await resizeSelectedCardsController\(\);/);
frontend/test/runtime/drag-release-freeze.integration.test.ts:573:  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
frontend/test/runtime/drag-release-freeze.integration.test.ts:629:  await loadActiveLedgerState();
frontend/test/runtime/selection-direct-card-click.integration.test.ts:40:  const geometryCommitIndex = pointerUp.indexOf('await commitSelectedLedgerGeometry()');
frontend/test/runtime/selection-direct-card-click.integration.test.ts:44:  assert.match(pointerUp, /await commitSelectedLedgerGeometry\(\)/);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:293:  assert.match(refresh, /resizeSelectedCardsToContent\(\{ cardIds: \[cardId\], zoneIds: \[\] \}\)/);
frontend/test/runtime/canvas-pan-performance.integration.test.ts:622:  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(gestureSelection\)/);
frontend/test/runtime/canvas-pan-performance.integration.test.ts:693:  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
frontend/test/runtime/canvas-pan-performance.integration.test.ts:720:  const load = loadActiveLedgerState();
frontend/test/unit/card/effect/resize-selected-card.test.ts:42:    const { resizeSelectedCard } = await import('../../../../src/runtime/card/effect/resize-selected-card.js');
frontend/test/unit/card/effect/resize-selected-card.test.ts:43:    resizeSelectedCard(40, 30);
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-31","timestamp":"2026-07-10T04:38:28.071Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"31","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_16","codexTool":"/usr/bin/zsh -lc \"git diff -- package.json && sed -n '1,100p' package.json && sed -n '1,80p' package-lock.json && git status --short package-lock.json node_modules package.json && git check-ignore -v node_modules package-lock.json || true\""} -->

**Tool call** `/usr/bin/zsh -lc "git diff -- package.json && sed -n '1,100p' package.json && sed -n '1,80p' package-lock.json && git status --short package-lock.json node_modules package.json && git check-ignore -v node_modules package-lock.json || true"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-32","timestamp":"2026-07-10T04:38:28.071Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"32","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_16","codexTool":"/usr/bin/zsh -lc \"git diff -- package.json && sed -n '1,100p' package.json && sed -n '1,80p' package-lock.json && git status --short package-lock.json node_modules package.json && git check-ignore -v node_modules package-lock.json || true\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "git diff -- package.json && sed -n '1,100p' package.json && sed -n '1,80p' package-lock.json && git status --short package-lock.json node_modules package.json && git check-ignore -v node_modules package-lock.json || true"`
Status: completed
Exit code: 0

````text
diff --git a/package.json b/package.json
index eeca6f2..4476f2f 100644
--- a/package.json
+++ b/package.json
@@ -23,5 +23,7 @@
     "coverage:functions:frontend": "node tools/unit-coverage/frontend-summary.mjs",
     "test:front-back": "npm run typecheck:frontend && npm run typecheck:backend && npm test --prefix frontend && npm test --prefix backend && npm run test:browser"
   },
-  "devDependencies": {}
+  "devDependencies": {
+    "@playwright/test": "^1.61.1"
+  }
 }
{
  "name": "decision-os",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "bin": {
    "decision-os-server": "./bin/decision-os-server.mjs",
    "ledger-cli": "./bin/ledger-cli.mjs",
    "normalize-card-heights": "./bin/normalize-card-heights.mjs",
    "save-html": "./bin/save-html.mjs"
  },
  "scripts": {
    "start:workspace": "node ./bin/decision-os-server.mjs",
    "save-html": "node ./bin/save-html.mjs",
    "typecheck:frontend": "frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit",
    "typecheck:backend": "backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit",
    "test:browser": "node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs \"tests/browser/**/*.spec.ts\"",
    "verify:live": "node tools/live-verify/cli.mjs",
    "verify:live:summary": "node tools/live-verify/summary.mjs",
    "verify:live:drag-trace": "node tools/live-verify/card-drag-trace-suite.mjs",
    "verify:live:manual-trace": "node tools/live-verify/manual-commit-trace.mjs",
    "coverage:frontend": "cd frontend && node --test --experimental-test-coverage --import tsx \"test/**/*.test.ts\"",
    "coverage:functions:frontend": "node tools/unit-coverage/frontend-summary.mjs",
    "test:front-back": "npm run typecheck:frontend && npm run typecheck:backend && npm test --prefix frontend && npm test --prefix backend && npm run test:browser"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1"
  }
}
{
  "name": "decision-os",
  "version": "0.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "decision-os",
      "version": "0.0.0",
      "bin": {
        "decision-os-server": "bin/decision-os-server.mjs",
        "ledger-cli": "bin/ledger-cli.mjs",
        "normalize-card-heights": "bin/normalize-card-heights.mjs",
        "save-html": "bin/save-html.mjs"
      },
      "devDependencies": {
        "@playwright/test": "^1.61.1"
      }
    },
    "node_modules/@playwright/test": {
      "version": "1.61.1",
      "resolved": "https://registry.npmjs.org/@playwright/test/-/test-1.61.1.tgz",
      "integrity": "sha512-8nKv6+0RJSL9FE4jYOEGXnPeM/Hg12qZpmqzZjRh3qM0Y7c3z1mrOTfFLids72RDQYVh9WpLEfR5WdpNX4fkig==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "playwright": "1.61.1"
      },
      "bin": {
        "playwright": "cli.js"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/fsevents": {
      "version": "2.3.2",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.2.tgz",
      "integrity": "sha512-xiqMQR4xAeHTuB9uWm+fFRcIOgKBMiOBP+eXiyT7jsgVCq1bkVygt00oASowB7EdtpOHaaPgKt812P9ab+DDKA==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/playwright": {
      "version": "1.61.1",
      "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.61.1.tgz",
      "integrity": "sha512-DWnY5o3YbLWK4GovuAVwpqL+1VwGNdUGrRr++8j8PtQQzvAVZUIMjKQ90fY689sEJZJBbZVw1rXaOKSTitkzPQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "playwright-core": "1.61.1"
      },
      "bin": {
        "playwright": "cli.js"
      },
      "engines": {
        "node": ">=18"
      },
      "optionalDependencies": {
        "fsevents": "2.3.2"
      }
    },
    "node_modules/playwright-core": {
      "version": "1.61.1",
      "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.61.1.tgz",
      "integrity": "sha512-h7Qlt6m4REp25qvIdvbDtVmD4LqVXfpRxhORv9L0jzETM05p4fuPJ3dKyuSXQxDSbXnmS79HAgi9589lGSpLkg==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "playwright-core": "cli.js"
      },
      "engines": {
        "node": ">=18"
 M package.json
?? node_modules/
?? package-lock.json
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-33","timestamp":"2026-07-10T04:38:44.347Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"33","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_17"} -->

I found one higher-risk clean-code defect beyond file placement: `moveSelected()` temporarily replaced global `state.selection` only to render controls for the gesture snapshot. I am removing that hidden state mutation by passing the explicit selection into the control-overlay render path; zone labels and relationships already render from geometry and need no selection swap.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-34","timestamp":"2026-07-10T04:40:25.014Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"34","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_18"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/card/effect/resize-selected-card.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/controller/handle-pointer-down.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/refresh/controller/refresh-runtime-state.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/effect/move-selected.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/helper/clone-selection-state.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/helper/selection-states-equal.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/state.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/zone/effect/resize-selected-zone.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/ledger-content-refresh.integration.test.ts: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-35","timestamp":"2026-07-10T04:40:25.014Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"35","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_18"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/card/effect/resize-selected-card.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/controller/handle-pointer-down.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/refresh/controller/refresh-runtime-state.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/effect/move-selected.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/helper/clone-selection-state.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/selection/helper/selection-states-equal.ts: add
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/state.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/zone/effect/resize-selected-zone.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/ledger-content-refresh.integration.test.ts: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-36","timestamp":"2026-07-10T04:40:39.297Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"36","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_19"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/ledger-content-refresh.integration.test.ts: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-37","timestamp":"2026-07-10T04:40:39.297Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"37","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_19"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/ledger-content-refresh.integration.test.ts: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-38","timestamp":"2026-07-10T04:40:39.297Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"38","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_20","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"from '../../state\\\\.js'.*(cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelection)|from '../../state\\\\.js';\\\" frontend/src/runtime/{selection,gesture,ledger,refresh,card,zone} | head -200\nrg -n \\\"cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|pruneSelectionToActiveLedger|resolveCurrentPointerTarget\\\" frontend/src frontend/test tests | head -240\ngit diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"from '../../state\\.js'.*(cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelection)|from '../../state\\.js';\" frontend/src/runtime/{selection,gesture,ledger,refresh,card,zone} | head -200
rg -n \"cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|pruneSelectionToActiveLedger|resolveCurrentPointerTarget\" frontend/src frontend/test tests | head -240
git diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-39","timestamp":"2026-07-10T04:40:39.297Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"39","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_20","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"from '../../state\\\\.js'.*(cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelection)|from '../../state\\\\.js';\\\" frontend/src/runtime/{selection,gesture,ledger,refresh,card,zone} | head -200\nrg -n \\\"cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|pruneSelectionToActiveLedger|resolveCurrentPointerTarget\\\" frontend/src frontend/test tests | head -240\ngit diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"from '../../state\\.js'.*(cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelection)|from '../../state\\.js';\" frontend/src/runtime/{selection,gesture,ledger,refresh,card,zone} | head -200
rg -n \"cloneSelectionState|selectionStatesEqual|emptySelectionState|createPointerSelectionSnapshot|restoreSelectionFromPointerSnapshot|pruneSelectionToActiveLedger|resolveCurrentPointerTarget\" frontend/src frontend/test tests | head -240
git diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: completed
Exit code: 0

````text
frontend/src/runtime/zone/helper/cards-intersecting-zone.ts:3:import { state } from '../../state.js';
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts:5:import { state } from '../../state.js';
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:6:import { state } from '../../state.js';
frontend/src/runtime/selection/helper/clone-selection-state.ts:5:import type { SelectionState } from '../../state.js';
frontend/src/runtime/card/helper/resolve-card-work-status.ts:5:import { state } from '../../state.js';
frontend/src/runtime/gesture/helper/derive-pointer-intent.ts:1:import { state } from '../../state.js';
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:11:import { state } from '../../state.js';
frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts:6:import { state, type SelectionState } from '../../state.js';
frontend/src/runtime/card/helper/card-has-agent-last-answer.ts:5:import { state } from '../../state.js';
frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts:5:import type { PointerSelectionSnapshot, SelectionState } from '../../state.js';
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:5:import { state, type SelectionState } from '../../state.js';
frontend/src/runtime/ledger/helper/merge-local-thread-notes.ts:5:import { state } from '../../state.js';
frontend/src/runtime/selection/helper/selection-has-target.ts:1:import { state } from '../../state.js';
frontend/src/runtime/card/controller/resize-selected-cards-controller.ts:4:import { state } from '../../state.js';
frontend/src/runtime/zone/effect/begin-zone-label-edit.ts:4:import { state } from '../../state.js';
frontend/src/runtime/selection/helper/selection-states-equal.ts:5:import type { SelectionState } from '../../state.js';
frontend/src/runtime/card/controller/delete-card-image-controller.ts:9:import { state } from '../../state.js';
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts:1:import { state } from '../../state.js';
frontend/src/runtime/card/controller/delete-card-controller.ts:6:import { state } from '../../state.js';
frontend/src/runtime/ledger/helper/ledger-endpoint-for-tab.ts:1:import { state } from '../../state.js';
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:6:import { state } from '../../state.js';
frontend/src/runtime/ledger/helper/active-ledgers.ts:5:import { state } from '../../state.js';
frontend/src/runtime/card/controller/switch-card-tab-controller.ts:1:import { state } from '../../state.js';
frontend/src/runtime/ledger/effect/commit-active-ledger-mutation.ts:5:import { state } from '../../state.js';
frontend/src/runtime/gesture/controller/handle-pointer-up.ts:5:import { state } from '../../state.js';
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:6:import { state } from '../../state.js';
frontend/src/runtime/ledger/effect/create-new-ledger.ts:1:import { state } from '../../state.js';
frontend/src/runtime/zone/effect/resize-selected-zone.ts:5:import { state } from '../../state.js';
frontend/src/runtime/ledger/effect/load-decision-os-state.ts:1:import { state } from '../../state.js';
frontend/src/runtime/selection/controller/select-target.ts:1:import { state } from '../../state.js';
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:5:import { state, type SelectionState } from '../../state.js';
frontend/src/runtime/gesture/controller/handle-wheel.ts:5:import { state } from '../../state.js';
frontend/src/runtime/gesture/controller/handle-pointer-move.ts:5:import { state } from '../../state.js';
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:5:import { state } from '../../state.js';
frontend/src/runtime/zone/effect/delete-selected-zones.ts:2:import { state } from '../../state.js';
frontend/src/runtime/gesture/effect/emit-pan-performance-telemetry.ts:5:import { state } from '../../state.js';
frontend/src/runtime/ledger/effect/send-active-ledger-mutation.ts:5:import { state } from '../../state.js';
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:2:import { state } from '../../state.js';
frontend/src/runtime/zone/effect/create-zone-from-rect.ts:5:import { state } from '../../state.js';
frontend/src/runtime/gesture/effect/finish-pointer.ts:2:import { state } from '../../state.js';
frontend/src/runtime/card/effect/resize-selected-card.ts:7:import { state } from '../../state.js';
frontend/src/runtime/card/effect/create-card-from-rect.ts:6:import { state } from '../../state.js';
frontend/src/runtime/selection/effect/render-selection-state.ts:1:import { state } from '../../state.js';
frontend/src/runtime/gesture/effect/schedule-panning-effects.ts:2:import { state } from '../../state.js';
frontend/src/runtime/selection/effect/select-intersecting.ts:1:import { state } from '../../state.js';
frontend/src/runtime/card/effect/begin-ledger-card-edit.ts:7:import { state } from '../../state.js';
frontend/src/runtime/selection/effect/move-selected.ts:5:import { state, type SelectionState } from '../../state.js';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:6:import { state } from '../../state.js';
frontend/src/runtime/ledger/component/patch-ledger-card.ts:5:import { state } from '../../state.js';
frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts:14:import { state } from '../../state.js';
frontend/src/runtime/ledger/component/append-inline-nodes.ts:3:import { state } from '../../state.js';
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:5:import { state } from '../../state.js';
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:16:import { state } from '../../state.js';
frontend/test/runtime/ledger-content-refresh.integration.test.ts:285:  assert.match(refresh, /const selectionAtRefreshStart = cloneSelectionState\(state\.selection\)/);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:286:  assert.match(refresh, /selectionStatesEqual\(state\.selection, selectionAtRefreshStart\)/);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:287:  assert.match(refresh, /state\.selection = cloneSelectionState\(selectionAtRefreshStart\)/);
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:12:import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:13:import { selectionStatesEqual } from '../../selection/helper/selection-states-equal.js';
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:121:  const selectionAtRefreshStart = cloneSelectionState(state.selection);
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:126:    if (!state.pointer && selectionStatesEqual(state.selection, selectionAtRefreshStart)) {
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:127:      state.selection = cloneSelectionState(selectionAtRefreshStart);
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:6:import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:119:  const current = cloneSelectionState(selection);
frontend/src/runtime/card/effect/resize-selected-card.ts:11:import { resolveCurrentPointerTarget } from '../../gesture/helper/resolve-current-pointer-target.js';
frontend/src/runtime/card/effect/resize-selected-card.ts:17:  const card = resolveCurrentPointerTarget('card', cardId, savedCard);
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:6:import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:7:import { pruneSelectionToActiveLedger } from '../../selection/helper/prune-selection-to-active-ledger.js';
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:52:    const prunedSelection = pruneSelectionToActiveLedger(state.selection);
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:57:      ? cloneSelectionState(pointerSnapshot)
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:7:export function resolveCurrentPointerTarget(
frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts:6:import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts:8:export function createPointerSelectionSnapshot(input: {
frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts:15:    ...cloneSelectionState(input.selection),
frontend/src/runtime/zone/effect/resize-selected-zone.ts:11:import { resolveCurrentPointerTarget } from '../../gesture/helper/resolve-current-pointer-target.js';
frontend/src/runtime/zone/effect/resize-selected-zone.ts:18:  const zone = resolveCurrentPointerTarget(targetKind, id, savedZone);
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:18:import { createPointerSelectionSnapshot } from '../helper/create-pointer-selection-snapshot.js';
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:50:    state.pointer.selectionSnapshot = createPointerSelectionSnapshot({
frontend/src/runtime/selection/effect/move-selected.ts:6:import { cloneSelectionState } from '../helper/clone-selection-state.js';
frontend/src/runtime/selection/effect/move-selected.ts:15:  const movingSelection = cloneSelectionState(selection);
frontend/src/runtime/selection/helper/clone-selection-state.ts:7:export function cloneSelectionState(selection?: Partial<SelectionState> | null): SelectionState {
frontend/src/runtime/selection/helper/selection-states-equal.ts:6:import { cloneSelectionState } from './clone-selection-state.js';
frontend/src/runtime/selection/helper/selection-states-equal.ts:8:export function selectionStatesEqual(
frontend/src/runtime/selection/helper/selection-states-equal.ts:12:  const current = cloneSelectionState(left);
frontend/src/runtime/selection/helper/selection-states-equal.ts:13:  const expected = cloneSelectionState(right);
frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts:7:import { cloneSelectionState } from './clone-selection-state.js';
frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts:9:export function pruneSelectionToActiveLedger(selection: Partial<SelectionState> = state.selection): SelectionState {
frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts:10:  const current = cloneSelectionState(selection);
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-40","timestamp":"2026-07-10T04:40:41.412Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"40","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_21","codexTool":"/usr/bin/zsh -lc 'npm run typecheck:frontend'"} -->

**Tool call** `/usr/bin/zsh -lc 'npm run typecheck:frontend'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-41","timestamp":"2026-07-10T04:40:43.382Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"41","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_21","codexTool":"/usr/bin/zsh -lc 'npm run typecheck:frontend'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'npm run typecheck:frontend'`
Status: completed
Exit code: 0

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-42","timestamp":"2026-07-10T04:40:47.011Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"42","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_22"} -->

The production refactor now typechecks. The runtime state file again contains only runtime shape and values; selection cloning/equality/pruning and pointer target resolution now live in focused helpers, and card/zone resize share one remount-resolution contract. I’m running the interaction suites before deciding whether any test-fixture extraction is still warranted.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-43","timestamp":"2026-07-10T04:40:51.023Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"43","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_23","codexTool":"/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-44","timestamp":"2026-07-10T04:40:51.023Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"44","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_23","codexTool":"/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts'`
Status: completed
Exit code: 0

````text
# Subtest: specs and data ledger tabs commit canvas mutations through the server ledger endpoint
ok 1 - specs and data ledger tabs commit canvas mutations through the server ledger endpoint
  ---
  duration_ms: 187.980781
  type: 'test'
  ...
# Subtest: active ledger load keeps server geometry authoritative over stale browser persistence
ok 2 - active ledger load keeps server geometry authoritative over stale browser persistence
  ---
  duration_ms: 8.591888
  type: 'test'
  ...
# Subtest: active ledger refresh keeps local canvas geometry and viewport while accepting server content
ok 3 - active ledger refresh keeps local canvas geometry and viewport while accepting server content
  ---
  duration_ms: 1.998281
  type: 'test'
  ...
# Subtest: active ledger refresh keeps viewport moves made while the server load is in flight
ok 4 - active ledger refresh keeps viewport moves made while the server load is in flight
  ---
  duration_ms: 1.470124
  type: 'test'
  ...
# Subtest: same-ledger active load preserves selected records and prunes missing records
ok 5 - same-ledger active load preserves selected records and prunes missing records
  ---
  duration_ms: 1.120047
  type: 'test'
  ...
# Subtest: non-geometry mutation responses keep newer local canvas geometry
ok 6 - non-geometry mutation responses keep newer local canvas geometry
  ---
  duration_ms: 0.958386
  type: 'test'
  ...
# Subtest: patch-geometry mutation responses keep unrelated newer local canvas geometry
ok 7 - patch-geometry mutation responses keep unrelated newer local canvas geometry
  ---
  duration_ms: 0.996587
  type: 'test'
  ...
# Subtest: canvas pan uses a transform-only path with sampled performance telemetry
ok 8 - canvas pan uses a transform-only path with sampled performance telemetry
  ---
  duration_ms: 2.157314
  type: 'test'
  ...
# Subtest: ctrl and middle-button drag always derive pan intent without selection side effects
ok 9 - ctrl and middle-button drag always derive pan intent without selection side effects
  ---
  duration_ms: 0.644399
  type: 'test'
  ...
# Subtest: card tool draws over zone and group backgrounds while select mode keeps zone pan precedence
ok 10 - card tool draws over zone and group backgrounds while select mode keeps zone pan precedence
  ---
  duration_ms: 0.274702
  type: 'test'
  ...
# Subtest: card creation preserves canvas x and y instead of clamping to positive space
ok 11 - card creation preserves canvas x and y instead of clamping to positive space
  ---
  duration_ms: 0.357864
  type: 'test'
  ...
# Subtest: direct canvas pointer down clears selection before pointer up
ok 12 - direct canvas pointer down clears selection before pointer up
  ---
  duration_ms: 0.599775
  type: 'test'
  ...
# Subtest: plain pan pointer up does not force a full canvas rerender
ok 13 - plain pan pointer up does not force a full canvas rerender
  ---
  duration_ms: 0.230025
  type: 'test'
  ...
# Subtest: manual runtime refresh preserves an active pan pointer and allows pan to continue
ok 14 - manual runtime refresh preserves an active pan pointer and allows pan to continue
  ---
  duration_ms: 235.481125
  type: 'test'
  ...
# Subtest: wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence
ok 15 - wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence
  ---
  duration_ms: 184.91931
  type: 'test'
  ...
# Subtest: wheel zoom stays transform-only and does not reroute relationships
ok 16 - wheel zoom stays transform-only and does not reroute relationships
  ---
  duration_ms: 0.804512
  type: 'test'
  ...
# Subtest: canvas debug overlay is URL-param gated and reports zoom density state
ok 17 - canvas debug overlay is URL-param gated and reports zoom density state
  ---
  duration_ms: 0.5408
  type: 'test'
  ...
# Subtest: normal detail reveal is viewport-local and layout-free
ok 18 - normal detail reveal is viewport-local and layout-free
  ---
  duration_ms: 0.553495
  type: 'test'
  ...
# Subtest: card drag release clears pointer before slow geometry commit can accept later cursor movement
ok 19 - card drag release clears pointer before slow geometry commit can accept later cursor movement
  ---
  duration_ms: 217.075834
  type: 'test'
  ...
# Subtest: active card drag keeps pointer snapshot through same-ledger load and commits the original target
ok 20 - active card drag keeps pointer snapshot through same-ledger load and commits the original target
  ---
  duration_ms: 33.456275
  type: 'test'
  ...
# Subtest: multi-selection drag survives ledger content refresh and commits only the pointer snapshot
ok 21 - multi-selection drag survives ledger content refresh and commits only the pointer snapshot
  ---
  duration_ms: 34.584
  type: 'test'
  ...
# Subtest: card resize resolves the current remounted node and commits pointer target geometry
ok 22 - card resize resolves the current remounted node and commits pointer target geometry
  ---
  duration_ms: 8.039689
  type: 'test'
  ...
# Subtest: ledger content refresh is deferred while voice recording is active
ok 23 - ledger content refresh is deferred while voice recording is active
  ---
  duration_ms: 175.224922
  type: 'test'
  ...
# Subtest: thread content refresh is deferred separately from canvas refresh while voice recording is active
ok 24 - thread content refresh is deferred separately from canvas refresh while voice recording is active
  ---
  duration_ms: 1.701011
  type: 'test'
  ...
# Subtest: thread content refresh keeps newer selection made while same-ledger load is in flight
ok 25 - thread content refresh keeps newer selection made while same-ledger load is in flight
  ---
  duration_ms: 7.151195
  type: 'test'
  ...
# Subtest: thread content events rerender the thread panel without remounting the canvas
ok 26 - thread content events rerender the thread panel without remounting the canvas
  ---
  duration_ms: 0.397696
  type: 'test'
  ...
# Subtest: card content refresh resizes the changed card after the refreshed render
ok 27 - card content refresh resizes the changed card after the refreshed render
  ---
  duration_ms: 0.304267
  type: 'test'
  ...
# Subtest: changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file
ok 28 - changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file
  ---
  duration_ms: 1.209933
  type: 'test'
  ...
1..28
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 633.487164
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-45","timestamp":"2026-07-10T04:40:57.009Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"45","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_24","codexTool":"/usr/bin/zsh -lc \"cat frontend/package.json\nrg -n 'jsdom|happy-dom|linkedom' frontend/package-lock.json package-lock.json frontend/package.json package.json || true\nsed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nsed -n '480,785p' frontend/test/runtime/drag-release-freeze.integration.test.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "cat frontend/package.json
rg -n 'jsdom|happy-dom|linkedom' frontend/package-lock.json package-lock.json frontend/package.json package.json || true
sed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
sed -n '480,785p' frontend/test/runtime/drag-release-freeze.integration.test.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-46","timestamp":"2026-07-10T04:40:57.009Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"46","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_24","codexTool":"/usr/bin/zsh -lc \"cat frontend/package.json\nrg -n 'jsdom|happy-dom|linkedom' frontend/package-lock.json package-lock.json frontend/package.json package.json || true\nsed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nsed -n '480,785p' frontend/test/runtime/drag-release-freeze.integration.test.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "cat frontend/package.json
rg -n 'jsdom|happy-dom|linkedom' frontend/package-lock.json package-lock.json frontend/package.json package.json || true
sed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
sed -n '480,785p' frontend/test/runtime/drag-release-freeze.integration.test.ts"`
Status: completed
Exit code: 0

````text
{
  "name": "frontend",
  "version": "0.0.0-generated",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test --import tsx \"test/**/*.test.ts\"",
    "test:integration": "find test -path \"*/unit/*\" -prune -o -name \"*.test.ts\" -print | xargs node --test --import tsx",
    "test:unit": "find test/unit -name \"*.test.ts\" -print | xargs node --test --import tsx",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.8.0"
  },
  "dependencies": {
    "highlight.js": "^11.11.1"
  }
}
  assert.match(createCard, /y:\s*rect\.y/);
  assert.doesNotMatch(createCard, /x:\s*Math\.max\(0,\s*rect\.x\)/);
  assert.doesNotMatch(createCard, /y:\s*Math\.max\(0,\s*rect\.y\)/);
});

test('direct canvas pointer down clears selection before pointer up', () => {
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  const specs = source('documentation/specs.json');

  assert.match(specs, /7d2c8b91/);
  assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
  assert.match(pointerDown, /canvas-background-pointer-down/);
  assert.match(pointerDown, /renderSelectionState\(\)/);
  assert.doesNotMatch(pointerUp, /canvas-background-click/);
  assert.doesNotMatch(pointerUp, /targetKind === 'canvas' && moved < 4[\s\S]*clear-transient-selection/);
});

test('plain pan pointer up does not force a full canvas rerender', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /const pointerIntent = pointerSession\.intent/);
  assert.match(pointerUp, /let releaseRendered = false/);
  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(gestureSelection\)/);
  assert.match(pointerUp, /if \(pointerIntent !== 'pan' && !releaseRendered\) renderCanvasSurface\(\)/);
  assert.match(pointerUp, /isClickMovement\(moved\)/);
});

test('manual runtime refresh preserves an active pan pointer and allows pan to continue', async () => {
  installCanvasRuntimeDom();
  const { refreshRuntimeState } = await import('../../src/runtime/refresh/controller/refresh-runtime-state.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 10, y: 20, scale: 1 };
  state.viewports = { specs: { x: 10, y: 20, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
  state.pointer = {
    intent: 'pan',
    targetKind: 'canvas',
    targetId: '',
    target: canvasDom.canvas,
    resizeHandle: null,
    start: { x: 100, y: 100 },
    current: { x: 100, y: 100 },
    startCanvas: { x: 100, y: 100 },
    currentCanvas: { x: 100, y: 100 },
    startedAt: 0
  };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      if (url === '/decision-os/data') return { ok: true, async json() { return {}; } };
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const refresh = refreshRuntimeState();
  await ledgerFetchStarted;
  resolveLedger({
    ok: true,
    async json() {
      return { cards: [], annotations: [], relationships: [], notes: {} };
    }
  });
  await refresh;

  assert.equal(state.pointer.intent, 'pan');
  handlePointerMove(canvasPointerEvent(130, 90));

  assert.deepEqual(state.viewport, { x: 40, y: 10, scale: 1 });
  assert.equal(canvasDom.content.style.transform, 'translate(40px, 10px) scale(1)');

  await handlePointerUp(canvasPointerEvent(130, 90));

  assert.equal(state.pointer, null);
  assert.deepEqual(JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}').viewport, { x: 40, y: 10, scale: 1 });
});

test('wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence', async () => {
  installCanvasRuntimeDom();
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handleWheel } = await import('../../src/runtime/gesture/controller/handle-wheel.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const load = loadActiveLedgerState();
  await ledgerFetchStarted;

  handleWheel(canvasWheelEvent({ clientX: 100, clientY: 80, deltaY: -120 }));
  const latestViewport = { ...state.viewport };
  assert.ok(latestViewport.scale > 1);

  resolveLedger({
    ok: true,
    async json() {
      return {
        viewport: { x: 999, y: 999, scale: 0.25 },
        cards: [],
        annotations: [],
        relationships: [],
        notes: {}
      };
    }
  });
  await load;

  assert.deepEqual(state.viewport, latestViewport);
  assert.deepEqual(state.viewports.specs, latestViewport);

  await waitForTimer(170);
  const persisted = JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}');
  assert.deepEqual(persisted.viewport, latestViewport);
  assert.deepEqual(persisted.viewports.specs, latestViewport);
});

test('wheel zoom stays transform-only and does not reroute relationships', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const scheduler = source('frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts');
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const density = source('frontend/src/runtime/canvas/helper/render-density.ts');
  const ledgerRenderer = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');
  const canvasPoint = source('frontend/src/runtime/canvas/helper/canvas-point.ts');
  const visibleCards = source('frontend/src/runtime/card/helper/visible-ledger-cards.ts');
  assert.match(wheel, /scheduleViewportTransform\(!event\.ctrlKey\)/);
  assert.match(density, /lowZoomRenderDensityThreshold = 0\.2/);
  assert.match(density, /lowZoomRenderDensity = 4/);

  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
  return true;
}

function pointerEvent(input: { target?: FakeElement; clientX: number; clientY: number; pointerId?: number; shiftKey?: boolean; ctrlKey?: boolean; button?: number; buttons?: number }): PointerEvent {
  return {
    target: input.target ?? runtimeDom.canvas,
    clientX: input.clientX,
    clientY: input.clientY,
    pointerId: input.pointerId ?? 1,
    shiftKey: input.shiftKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    button: input.button ?? 0,
    buttons: input.buttons ?? 1,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as PointerEvent;
}

function appendLedgerCard(id: string, x: number, y: number, width = 240, height = 132): FakeElement {
  const card = fakeElement({ cardId: id }, 'article');
  card.className = 'card ledger-node';
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  card.style.width = `${width}px`;
  card.style.height = `${height}px`;
  runtimeDom.content.insertBefore(card, runtimeDom.marquee);
  return card;
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
  const { canvas, content } = installRuntimeDom();
  const card = appendLedgerCard('card-a', 20, 20, 120, 80);
  card.style.left = '20px';
  card.style.top = '20px';
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });

  const calls: RequestInit[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = (_url: string, init: RequestInit) => {
    calls.push(init);
    return new Promise(() => {});
  };

  const { state } = await import('../../src/runtime/state.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');

  state.activeTab = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.activeLedger = { cards: [{ id: 'card-a', x: 20, y: 20, w: 120, h: 80 }], annotations: [], relationships: [], notes: {} };
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = {
    intent: 'drag',
    targetKind: 'card',
    targetId: 'card-a',
    target: card,
    resizeHandle: null,
    start: { x: 0, y: 0 },
    current: { x: 10, y: 0 },
    startCanvas: { x: 0, y: 0 },
    currentCanvas: { x: 10, y: 0 },
    startedAt: 0
  };

  void handlePointerUp({ clientX: 15, clientY: 0, pointerId: 7, preventDefault() {} } as unknown as PointerEvent);

  assert.equal(state.pointer, null);
  assert.equal(card.offsetLeft, 25);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);

  handlePointerMove({ clientX: 200, clientY: 0, preventDefault() {} } as unknown as PointerEvent);

  assert.equal(card.offsetLeft, 25);
  assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);
  assert.ok(content.childElementCount >= 1);
});

test('active card drag keeps pointer snapshot through same-ledger load and commits the original target', async () => {
  installRuntimeDom();
  const cardA = appendLedgerCard('card-a', 20, 20);
  appendLedgerCard('card-b', 200, 20);
  const patchBodies: Array<Record<string, any>> = [];

  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'A', x: 20, y: 20, w: 240, h: 132 },
      { id: 'card-b', title: 'B', x: 200, y: 20, w: 240, h: 132 }
    ],
    annotations: [],
    relationships: [],
    notes: {}
  };

  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    assert.equal(url, '/decision-os/specs');
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body ?? '{}'));
      patchBodies.push(body);
      return {
        ok: true,
        async json() {
          return structuredClone(state.activeLedger);
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          cards: [
            { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
            { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 }
          ],
          annotations: [],
          relationships: [],
          notes: {}
        };
      }
    };
  };

  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);

  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
  await loadActiveLedgerState();

  assert.deepEqual(state.selection.cardIds, ['card-a']);
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);

  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));

  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a']);
  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 80);
  assert.equal(patchBodies[0].geometry.cards['card-b'], undefined);
});

test('multi-selection drag survives ledger content refresh and commits only the pointer snapshot', async () => {
  installRuntimeDom();
  const cardA = appendLedgerCard('card-a', 10, 10);
  appendLedgerCard('card-b', 100, 10);
  appendLedgerCard('card-c', 300, 10);
  const patchBodies: Array<Record<string, any>> = [];
  let resolveLoad!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const loadStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
      assert.equal(url, '/decision-os/specs');
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body ?? '{}'));
        patchBodies.push(body);
        return {
          ok: true,
          async json() {
            return structuredClone(state.activeLedger);
          }
        };
      }
      resolveStarted();
      return new Promise((resolve) => {
        resolveLoad = resolve;
      });
    };
  });

  const { state } = await import('../../src/runtime/state.js');
  const { requestLedgerContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: ['card-a', 'card-b'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'A', x: 10, y: 10, w: 240, h: 132 },
      { id: 'card-b', title: 'B', x: 100, y: 10, w: 240, h: 132 },
      { id: 'card-c', title: 'C', x: 300, y: 10, w: 240, h: 132 }
    ],
    annotations: [],
    relationships: [],
    notes: {}
  };

  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a', 'card-b']);

  handlePointerMove(pointerEvent({ target: cardA, clientX: 30, clientY: 0 }));
  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
  requestLedgerContentRefresh('card-content-change');
  await loadStarted;
  resolveLoad({
    ok: true,
    async json() {
      return {
        cards: [
          { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
          { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 },
          { id: 'card-c', title: 'Server C', x: 5, y: 6, w: 220, h: 132 }
        ],
        annotations: [],
        relationships: [],
        notes: {}
      };
    }
  });
  await flushAsync();

  assert.deepEqual(state.selection.cardIds, ['card-a', 'card-b']);
  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));

  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a', 'card-b']);
  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 70);
  assert.equal(patchBodies[0].geometry.cards['card-b'].x, 160);
  assert.equal(patchBodies[0].geometry.cards['card-c'], undefined);
});

test('card resize resolves the current remounted node and commits pointer target geometry', async () => {
  installRuntimeDom();
  const originalCard = appendLedgerCard('card-a', 40, 50, 240, 150);
  const resizeHandle = fakeElement({}, 'div');
  resizeHandle.className = 'resize-handle se';
  originalCard.append(resizeHandle);
  const patchBodies: Array<Record<string, any>> = [];

  const { state } = await import('../../src/runtime/state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'A', x: 40, y: 50, w: 240, h: 150 }],
    annotations: [],
    relationships: [],
    notes: {}
  };

  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    assert.equal(url, '/decision-os/specs');
    const body = JSON.parse(String(init?.body ?? '{}'));
    patchBodies.push(body);
    return {
      ok: true,
      async json() {
        return structuredClone(state.activeLedger);
      }
    };
  };

  handlePointerDown(pointerEvent({ target: resizeHandle, clientX: 0, clientY: 0 }));
  originalCard.remove();
  const remountedCard = appendLedgerCard('card-a', 40, 50, 240, 150);

  handlePointerMove(pointerEvent({ target: remountedCard, clientX: 40, clientY: 20 }));
  await handlePointerUp(pointerEvent({ target: remountedCard, clientX: 40, clientY: 20 }));

  assert.equal(originalCard.style.width, '240px');
  assert.equal(remountedCard.style.width, '280px');
  assert.equal(remountedCard.style.height, '170px');
  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a']);
  assert.equal(patchBodies[0].geometry.cards['card-a'].width, 280);
  assert.equal(patchBodies[0].geometry.cards['card-a'].height, 170);
});
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-47","timestamp":"2026-07-10T04:41:19.010Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"47","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_25","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"from '@playwright/test'|from 'playwright'\\\" tests/browser | head -80\nrg -n \\\"function startDecisionOsServer|function freePort|chromiumExecutablePath|spawn\\\\(process.execPath\\\" tests/browser | head -120\nrg -n \\\"\"'^/'\"\\\\*\\\\*|WHAT:|WHY:\\\" frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/helper/*.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | head -260\nwc -l frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"from '@playwright/test'|from 'playwright'\" tests/browser | head -80
rg -n \"function startDecisionOsServer|function freePort|chromiumExecutablePath|spawn\\(process.execPath\" tests/browser | head -120
rg -n \""'^/'"\\*\\*|WHAT:|WHY:\" frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/helper/*.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | head -260
wc -l frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-48","timestamp":"2026-07-10T04:41:19.010Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"48","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_25","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"from '@playwright/test'|from 'playwright'\\\" tests/browser | head -80\nrg -n \\\"function startDecisionOsServer|function freePort|chromiumExecutablePath|spawn\\\\(process.execPath\\\" tests/browser | head -120\nrg -n \\\"\"'^/'\"\\\\*\\\\*|WHAT:|WHY:\\\" frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/helper/*.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | head -260\nwc -l frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"from '@playwright/test'|from 'playwright'\" tests/browser | head -80
rg -n \"function startDecisionOsServer|function freePort|chromiumExecutablePath|spawn\\(process.execPath\" tests/browser | head -120
rg -n \""'^/'"\\*\\*|WHAT:|WHY:\" frontend/src/runtime/state.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/helper/*.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | head -260
wc -l frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts"`
Status: completed
Exit code: 0

````text
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:13:import { chromium, type Browser, type Page } from '@playwright/test';
tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts:13:import { chromium, type Browser } from '@playwright/test';
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:43:const chromiumExecutablePath = '/snap/bin/chromium';
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:161:    executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:166:async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:169:  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts:207:async function freePort(): Promise<number> {
tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts:16:const chromiumExecutablePath = '/snap/bin/chromium';
tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts:25:      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts:67:async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts:70:  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts:94:async function freePort(): Promise<number> {
frontend/src/runtime/card/effect/resize-selected-card.ts:1:/**
frontend/src/runtime/card/effect/resize-selected-card.ts:2: * WHAT: Applies pointer resize deltas to the selected card and its active-ledger geometry.
frontend/src/runtime/card/effect/resize-selected-card.ts:3: * WHY: Resizing must survive canvas remounts by resolving the live node from pointer identity.
frontend/src/runtime/card/effect/resize-selected-card.ts:19:  // WHAT: Stop only when neither persisted geometry nor a live target remains.
frontend/src/runtime/card/effect/resize-selected-card.ts:20:  // WHY: A remounted canvas can invalidate either representation independently.
frontend/src/runtime/card/effect/resize-selected-card.ts:36:  // WHAT: Clamp west and north movement while preserving the opposite edge.
frontend/src/runtime/card/effect/resize-selected-card.ts:37:  // WHY: Resizing must honor the card minimum without shifting the anchored edge.
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:1:/**
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:2: * WHAT: Renders contextual card, zone, and group controls for hovered and selected canvas targets.
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:3: * WHY: Control placement must follow current geometry and may use an explicit gesture selection.
frontend/src/runtime/selection/effect/move-selected.ts:1:/**
frontend/src/runtime/selection/effect/move-selected.ts:2: * WHAT: Moves one explicit selection through ledger geometry or static DOM geometry.
frontend/src/runtime/selection/effect/move-selected.ts:3: * WHY: Active gestures must keep using their pointer-down selection across refresh and live selection changes.
frontend/src/runtime/selection/effect/move-selected.ts:16:  // WHAT: Patch the authoritative ledger when present; otherwise update static canvas nodes.
frontend/src/runtime/selection/effect/move-selected.ts:17:  // WHY: Both canvas modes share gesture control flow but own geometry in different stores.
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:1:/**
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:2: * WHAT: Resolves the live DOM node for a pointer target after a canvas remount.
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:3: * WHY: Gesture state retains target identity, while refresh may detach the element captured on pointer down.
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:12:  // WHAT: Preserve the saved node for non-ledger targets that have no stable id.
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:13:  // WHY: Static canvas resize behavior still relies on the pointer-down element.
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:17:  // WHAT: Reuse the original node only while it still represents the active target in the document.
frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts:18:  // WHY: A refresh can leave the saved object detached or replace it with a node for the same id.
frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts:1:/**
frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts:2: * WHAT: Captures immutable selection and target identity for one pointer session.
frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts:3: * WHY: Refresh and live selection changes must not change the operands of an active gesture.
frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts:1:/**
frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts:2: * WHAT: Decides whether pointer down should keep the current selection set.
frontend/src/runtime/selection/helper/should-preserve-pointer-selection.ts:3: * WHY: Direct card clicks must be able to escape zone-expanded selections.
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts:1:/**
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts:2: * WHAT: Reloads persisted runtime and authoritative ledger state for the active route.
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts:3: * WHY: Manual refresh must preserve live viewport and pointer continuity while accepting server data.
frontend/src/runtime/selection/helper/selection-states-equal.ts:1:/**
frontend/src/runtime/selection/helper/selection-states-equal.ts:2: * WHAT: Compares two runtime selections by ordered ids.
frontend/src/runtime/selection/helper/selection-states-equal.ts:3: * WHY: An async refresh may restore its captured selection only when the operator has not changed it.
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:1:/**
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:2: * WHAT: Reads, normalizes, and patches active-ledger canvas geometry.
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts:3: * WHY: Canvas effects need one geometry contract across cards, zones, and groups.
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:1:/**
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:2: * WHAT: Subscribes to backend card content file change events.
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:3: * WHY: direct Markdown file patches must refresh rendered card content without disturbing active voice recording.
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:124:    // WHAT: Restore a detached clone only when the awaited load did not observe newer operator state.
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:125:    // WHY: A stale thread refresh must never overwrite a selection made while its request was in flight.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:1:/**
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:2: * WHAT: Loads the active route ledger from the backend.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:3: * WHY: Server ledgers are authoritative, while optimistic thread notes must survive stale refreshes.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:20:    // WHAT: Clear state that cannot belong to an unresolved route ledger.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:21:    // WHY: Retaining either ledger data or selection would expose stale targets.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:31:    // WHAT: Clear state when the authoritative ledger cannot be loaded.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:32:    // WHY: Selection cannot remain valid without its owning ledger.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:54:    // WHAT: Prefer the active pointer operand for the same ledger; otherwise keep only refreshed ids.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:55:    // WHY: A live gesture must remain stable while an idle selection must drop deleted records.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:60:    // WHAT: Reset selection across ledger identity changes.
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts:61:    // WHY: Selection ids are scoped to their owning ledger.
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:1:/**
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:2: * WHAT: Commits active-ledger geometry for one explicit selection.
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:3: * WHY: Pointer release must persist the same target ids used throughout the gesture.
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:10:  // WHAT: Skip static canvases that have no active ledger mutation endpoint.
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:11:  // WHY: Their geometry is persisted through the local runtime state path.
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:15:  // WHAT: Avoid an empty mutation when every selected id disappeared from the ledger.
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts:16:  // WHY: A no-op request would trigger unnecessary refresh and rendering work.
frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts:1:/**
frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts:2: * WHAT: Removes selected ids that no longer exist in the active ledger or changed annotation kind.
frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts:3: * WHY: Same-ledger refreshes preserve valid operator context without retaining stale targets.
frontend/src/runtime/gesture/controller/handle-pointer-up.ts:1:/**
frontend/src/runtime/gesture/controller/handle-pointer-up.ts:2: * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.
frontend/src/runtime/gesture/controller/handle-pointer-up.ts:3: * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.
frontend/src/runtime/gesture/controller/handle-pointer-move.ts:1:/**
frontend/src/runtime/gesture/controller/handle-pointer-move.ts:2: * WHAT: Applies active pointer gesture movement to the canvas runtime.
frontend/src/runtime/gesture/controller/handle-pointer-move.ts:3: * WHY: Pan must stay transform-only while drag, resize, and draw paths update their owned geometry.
frontend/src/runtime/selection/helper/clone-selection-state.ts:1:/**
frontend/src/runtime/selection/helper/clone-selection-state.ts:2: * WHAT: Normalizes and clones the three runtime selection id lists.
frontend/src/runtime/selection/helper/clone-selection-state.ts:3: * WHY: Gesture snapshots and async refresh guards must never share mutable selection arrays.
frontend/src/runtime/state.ts:1:/**
frontend/src/runtime/state.ts:2: * WHAT: Defines and initializes mutable client runtime state.
frontend/src/runtime/state.ts:3: * WHY: Controllers and effects need one canonical store for the active workspace session.
frontend/src/runtime/zone/effect/resize-selected-zone.ts:1:/**
frontend/src/runtime/zone/effect/resize-selected-zone.ts:2: * WHAT: Applies pointer resize deltas to a selected zone or group and its ledger annotation.
frontend/src/runtime/zone/effect/resize-selected-zone.ts:3: * WHY: Region resizing must survive canvas remounts without losing target identity or variant limits.
frontend/src/runtime/zone/effect/resize-selected-zone.ts:20:  // WHAT: Stop only when neither persisted annotation geometry nor a live target remains.
frontend/src/runtime/zone/effect/resize-selected-zone.ts:21:  // WHY: A remounted canvas can invalidate either representation independently.
frontend/src/runtime/zone/effect/resize-selected-zone.ts:38:  // WHAT: Clamp west and north movement while preserving the opposite edge.
frontend/src/runtime/zone/effect/resize-selected-zone.ts:39:  // WHY: Region resizing must honor variant minimums without shifting the anchored edge.
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:1:/**
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:2: * WHAT: Starts canvas pointer gestures and resolves their target intent.
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:3: * WHY: Drag, pan, resize, draw, and edit control flow must share one canonical pointer entrypoint.
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:48:    // WHAT: Freeze gesture identity after pointer-down selection has settled.
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:49:    // WHY: Async refresh and later selection changes must not redirect movement or commit payloads.
   48 frontend/src/runtime/state.ts
   16 frontend/src/runtime/selection/helper/clone-selection-state.ts
   20 frontend/src/runtime/selection/helper/selection-states-equal.ts
   24 frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
   20 frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
   24 frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts
   69 frontend/src/runtime/card/effect/resize-selected-card.ts
   67 frontend/src/runtime/zone/effect/resize-selected-zone.ts
   74 frontend/src/runtime/selection/effect/move-selected.ts
  140 frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
  274 frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
  776 total
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-49","timestamp":"2026-07-10T04:41:29.057Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"49","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_26","codexTool":"/usr/bin/zsh -lc 'npm test --prefix frontend'"} -->

**Tool call** `/usr/bin/zsh -lc 'npm test --prefix frontend'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-50","timestamp":"2026-07-10T04:41:31.013Z","status":"failed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"50","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_26","codexTool":"/usr/bin/zsh -lc 'npm test --prefix frontend'","codexExitCode":"1"} -->

**Tool call** `/usr/bin/zsh -lc 'npm test --prefix frontend'`
Status: failed
Exit code: 1

````text
TAP version 13
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/boot/boot-surface.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487810:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487810:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487810:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487810:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/boot/boot-surface.integration.test.ts
not ok 1 - test/boot/boot-surface.integration.test.ts
  ---
  duration_ms: 333.885706
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/boot/boot-surface.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/canvas/canvas-interaction.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487817:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487817:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487817:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487817:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/canvas/canvas-interaction.integration.test.ts
not ok 2 - test/canvas/canvas-interaction.integration.test.ts
  ---
  duration_ms: 316.233273
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/canvas/canvas-interaction.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/card/card-labels.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487832:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487832:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487832:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487832:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/card/card-labels.integration.test.ts
not ok 3 - test/card/card-labels.integration.test.ts
  ---
  duration_ms: 472.753005
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/card/card-labels.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/card/card-lifecycle.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487879:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487879:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487879:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487879:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/card/card-lifecycle.integration.test.ts
not ok 4 - test/card/card-lifecycle.integration.test.ts
  ---
  duration_ms: 474.763466
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/card/card-lifecycle.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/group/group-selection.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487850:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487850:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487850:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487850:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/group/group-selection.integration.test.ts
not ok 5 - test/group/group-selection.integration.test.ts
  ---
  duration_ms: 491.805195
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/group/group-selection.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/navigation/navigation-tab-switch.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487835:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487835:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487835:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487835:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/navigation/navigation-tab-switch.integration.test.ts
not ok 6 - test/navigation/navigation-tab-switch.integration.test.ts
  ---
  duration_ms: 315.994136
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/navigation/navigation-tab-switch.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/refresh/client-refresh.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487842:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487842:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487842:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487842:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/refresh/client-refresh.integration.test.ts
not ok 7 - test/refresh/client-refresh.integration.test.ts
  ---
  duration_ms: 316.991152
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/refresh/client-refresh.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/relationship/relationship-rendering.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487804:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487804:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487804:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658487804:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/relationship/relationship-rendering.integration.test.ts
not ok 8 - test/relationship/relationship-rendering.integration.test.ts
  ---
  duration_ms: 304.120064
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/relationship/relationship-rendering.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: specs and data ledger tabs commit canvas mutations through the server ledger endpoint
ok 9 - specs and data ledger tabs commit canvas mutations through the server ledger endpoint
  ---
  duration_ms: 266.534482
  type: 'test'
  ...
# Subtest: active ledger load keeps server geometry authoritative over stale browser persistence
ok 10 - active ledger load keeps server geometry authoritative over stale browser persistence
  ---
  duration_ms: 18.232009
  type: 'test'
  ...
# Subtest: active ledger refresh keeps local canvas geometry and viewport while accepting server content
ok 11 - active ledger refresh keeps local canvas geometry and viewport while accepting server content
  ---
  duration_ms: 1.888709
  type: 'test'
  ...
# Subtest: active ledger refresh keeps viewport moves made while the server load is in flight
ok 12 - active ledger refresh keeps viewport moves made while the server load is in flight
  ---
  duration_ms: 2.841702
  type: 'test'
  ...
# Subtest: same-ledger active load preserves selected records and prunes missing records
ok 13 - same-ledger active load preserves selected records and prunes missing records
  ---
  duration_ms: 3.032666
  type: 'test'
  ...
# Subtest: non-geometry mutation responses keep newer local canvas geometry
ok 14 - non-geometry mutation responses keep newer local canvas geometry
  ---
  duration_ms: 1.641237
  type: 'test'
  ...
# Subtest: patch-geometry mutation responses keep unrelated newer local canvas geometry
ok 15 - patch-geometry mutation responses keep unrelated newer local canvas geometry
  ---
  duration_ms: 1.514626
  type: 'test'
  ...
# Subtest: canvas pan uses a transform-only path with sampled performance telemetry
ok 16 - canvas pan uses a transform-only path with sampled performance telemetry
  ---
  duration_ms: 1.796541
  type: 'test'
  ...
# Subtest: ctrl and middle-button drag always derive pan intent without selection side effects
ok 17 - ctrl and middle-button drag always derive pan intent without selection side effects
  ---
  duration_ms: 0.609522
  type: 'test'
  ...
# Subtest: card tool draws over zone and group backgrounds while select mode keeps zone pan precedence
ok 18 - card tool draws over zone and group backgrounds while select mode keeps zone pan precedence
  ---
  duration_ms: 0.248876
  type: 'test'
  ...
# Subtest: card creation preserves canvas x and y instead of clamping to positive space
ok 19 - card creation preserves canvas x and y instead of clamping to positive space
  ---
  duration_ms: 0.303755
  type: 'test'
  ...
# Subtest: direct canvas pointer down clears selection before pointer up
ok 20 - direct canvas pointer down clears selection before pointer up
  ---
  duration_ms: 0.534457
  type: 'test'
  ...
# Subtest: plain pan pointer up does not force a full canvas rerender
ok 21 - plain pan pointer up does not force a full canvas rerender
  ---
  duration_ms: 0.220046
  type: 'test'
  ...
# Subtest: manual runtime refresh preserves an active pan pointer and allows pan to continue
ok 22 - manual runtime refresh preserves an active pan pointer and allows pan to continue
  ---
  duration_ms: 379.212569
  type: 'test'
  ...
# Subtest: wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence
ok 23 - wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence
  ---
  duration_ms: 222.111042
  type: 'test'
  ...
# Subtest: wheel zoom stays transform-only and does not reroute relationships
ok 24 - wheel zoom stays transform-only and does not reroute relationships
  ---
  duration_ms: 1.08643
  type: 'test'
  ...
# Subtest: canvas debug overlay is URL-param gated and reports zoom density state
ok 25 - canvas debug overlay is URL-param gated and reports zoom density state
  ---
  duration_ms: 0.901787
  type: 'test'
  ...
# Subtest: normal detail reveal is viewport-local and layout-free
ok 26 - normal detail reveal is viewport-local and layout-free
  ---
  duration_ms: 1.737235
  type: 'test'
  ...
# Subtest: canvas wheel zoom supports wide overview scale
ok 27 - canvas wheel zoom supports wide overview scale
  ---
  duration_ms: 1.437812
  type: 'test'
  ...
# Subtest: card label chips are positioned top right and inherit the card color
ok 28 - card label chips are positioned top right and inherit the card color
  ---
  duration_ms: 1.555756
  type: 'test'
  ...
# Subtest: card markdown html directives render as sandboxed ledger-scoped iframe media
ok 29 - card markdown html directives render as sandboxed ledger-scoped iframe media
  ---
  duration_ms: 2.068544
  type: 'test'
  ...
# Subtest: card markdown images render as resizeable aspect-preserving media and adjacent images become a carousel
ok 30 - card markdown images render as resizeable aspect-preserving media and adjacent images become a carousel
  ---
  duration_ms: 3.593116
  type: 'test'
  ...
# Subtest: card markdown inline code and bold styling follow card color specs
ok 31 - card markdown inline code and bold styling follow card color specs
  ---
  duration_ms: 2.856759
  type: 'test'
  ...
# Subtest: low-detail mode switches card paint layers without threshold layout measurement
ok 32 - low-detail mode switches card paint layers without threshold layout measurement
  ---
  duration_ms: 1.245437
  type: 'test'
  ...
# Subtest: card height normalization command backs up and migrates legacy natural-height cards
ok 33 - card height normalization command backs up and migrates legacy natural-height cards
  ---
  duration_ms: 0.322547
  type: 'test'
  ...
# Subtest: description editor preserves rendered body size and lets textarea own wheel scroll
ok 34 - description editor preserves rendered body size and lets textarea own wheel scroll
  ---
  duration_ms: 0.737588
  type: 'test'
  ...
# Subtest: local app and asset routes are served without browser cache ambiguity
ok 35 - local app and asset routes are served without browser cache ambiguity
  ---
  duration_ms: 0.531728
  type: 'test'
  ...
# Subtest: card field tabs preserve measured description height and fade panel switches
ok 36 - card field tabs preserve measured description height and fade panel switches
  ---
  duration_ms: 2.327931
  type: 'test'
  ...
# Subtest: card media carousel slide state persists locally outside the ledger
ok 37 - card media carousel slide state persists locally outside the ledger
  ---
  duration_ms: 1.817819
  type: 'test'
  ...
# Subtest: multi-tab cards use fixed ledger height while wheel capture is scroll-gated
ok 38 - multi-tab cards use fixed ledger height while wheel capture is scroll-gated
  ---
  duration_ms: 1.836397
  type: 'test'
  ...
# Subtest: wheel capture helper returns false for non-scrollable tab frames
ok 39 - wheel capture helper returns false for non-scrollable tab frames
  ---
  duration_ms: 0.439414
  type: 'test'
  ...
# Subtest: wheel capture helper returns true for scrollable active fields
ok 40 - wheel capture helper returns true for scrollable active fields
  ---
  duration_ms: 0.245594
  type: 'test'
  ...
# Subtest: wheel capture helper lets command chrome fall through to canvas zoom
ok 41 - wheel capture helper lets command chrome fall through to canvas zoom
  ---
  duration_ms: 0.162455
  type: 'test'
  ...
# Subtest: wheel capture helper keeps editing inputs out of canvas zoom
ok 42 - wheel capture helper keeps editing inputs out of canvas zoom
  ---
  duration_ms: 0.160807
  type: 'test'
  ...
# Subtest: ledger card chrome renders todo processing and done workflow statuses
ok 43 - ledger card chrome renders todo processing and done workflow statuses
  ---
  duration_ms: 254.716831
  type: 'test'
  ...
# Subtest: card status chip stays in the header flow instead of overlaying the title
ok 44 - card status chip stays in the header flow instead of overlaying the title
  ---
  duration_ms: 0.63807
  type: 'test'
  ...
# Subtest: card status toggle color follows the visible next status action
ok 45 - card status toggle color follows the visible next status action
  ---
  duration_ms: 0.512481
  type: 'test'
  ...
# Subtest: ledger card zone color is resolved from ledger geometry before DOM measurement
ok 46 - ledger card zone color is resolved from ledger geometry before DOM measurement
  ---
  duration_ms: 6.988732
  type: 'test'
  ...
# Subtest: loadCodexSkills returns server skill summaries
ok 47 - loadCodexSkills returns server skill summaries
  ---
  duration_ms: 35.633637
  type: 'test'
  ...
# Subtest: requestCardSkillProcess posts active card skill payload
ok 48 - requestCardSkillProcess posts active card skill payload
  ---
  duration_ms: 0.822188
  type: 'test'
  ...
# Subtest: requestThreadCodexProcess posts active thread payload
ok 49 - requestThreadCodexProcess posts active thread payload
  ---
  duration_ms: 0.680895
  type: 'test'
  ...
# Subtest: threadCodexCardId only resolves card-backed threads
ok 50 - threadCodexCardId only resolves card-backed threads
  ---
  duration_ms: 0.241899
  type: 'test'
  ...
# Subtest: requestCardSkillRunStatus queries derived run progress
ok 51 - requestCardSkillRunStatus queries derived run progress
  ---
  duration_ms: 1.089966
  type: 'test'
  ...
# [codex-continue-debug] {
#   source: 'frontend',
#   traceId: 'continue-codex-skill-3000-cache-b0e6cbde-a836-477b-add3-fbf37ff7fc2b',
#   phase: 'click',
#   at: '2026-07-10T04:41:28.556Z',
#   ledgerId: 'specs',
#   cardId: 'card-a',
#   runId: 'codex-skill-3000-cache',
#   since: 12,
#   terminal: true,
#   inFlight: false,
#   continueInFlight: false,
#   datasetStatus: 'complete',
#   newSession: true,
#   previousSummaryStatus: 'complete',
#   previousSummaryLineCount: 12
# }
# [codex-continue-debug] {
#   source: 'frontend',
#   traceId: 'continue-codex-skill-3000-cache-b0e6cbde-a836-477b-add3-fbf37ff7fc2b',
#   phase: 'optimistic-running-painted',
#   at: '2026-07-10T04:41:28.557Z',
#   ledgerId: 'specs',
#   cardId: 'card-a',
#   runId: 'codex-skill-3000-cache',
#   since: 0,
#   terminal: false,
#   inFlight: false,
#   continueInFlight: true,
#   datasetStatus: 'running'
# }
# [codex-continue-debug] {
#   source: 'frontend',
#   traceId: 'continue-codex-skill-3000-cache-b0e6cbde-a836-477b-add3-fbf37ff7fc2b',
#   phase: 'continue-response',
#   at: '2026-07-10T04:41:28.567Z',
#   ledgerId: 'specs',
#   cardId: 'card-a',
#   runId: 'codex-skill-3000-cache',
#   since: 0,
#   terminal: false,
#   inFlight: false,
#   continueInFlight: false,
#   datasetStatus: 'running',
#   ok: true,
#   status: 'running',
#   error: '',
#   pid: 0,
#   continuedMessageCount: 0
# }
# [codex-continue-debug] {
#   source: 'frontend',
#   traceId: 'continue-codex-skill-3000-cache-b0e6cbde-a836-477b-add3-fbf37ff7fc2b',
#   phase: 'continue-response-schedule-poll',
#   at: '2026-07-10T04:41:28.589Z',
#   ledgerId: 'specs',
#   cardId: 'card-a',
#   runId: 'codex-skill-3000-cache',
#   since: 0,
#   terminal: false,
#   inFlight: false,
#   continueInFlight: false,
#   datasetStatus: 'running'
# }
# Subtest: externally started Codex runs clear terminal widget cache and restart polling
ok 52 - externally started Codex runs clear terminal widget cache and restart polling
  ---
  duration_ms: 30.164848
  type: 'test'
  ...
# Subtest: requestCardSkillRunCancel posts active card run cancellation
ok 53 - requestCardSkillRunCancel posts active card run cancellation
  ---
  duration_ms: 28.648621
  type: 'test'
  ...
# Subtest: requestCardSkillRunContinue can start a new session with the selected model and effort
ok 54 - requestCardSkillRunContinue can start a new session with the selected model and effort
  ---
  duration_ms: 1.205319
  type: 'test'
  ...
# Subtest: cardCodexRunId falls back to the durable output card id
ok 55 - cardCodexRunId falls back to the durable output card id
  ---
  duration_ms: 0.754548
  type: 'test'
  ...
# Subtest: browser title follows the selected ledger title
ok 56 - browser title follows the selected ledger title
  ---
  duration_ms: 1.946561
  type: 'test'
  ...
# Subtest: card drag release clears pointer before slow geometry commit can accept later cursor movement
ok 57 - card drag release clears pointer before slow geometry commit can accept later cursor movement
  ---
  duration_ms: 275.161094
  type: 'test'
  ...
# Subtest: active card drag keeps pointer snapshot through same-ledger load and commits the original target
ok 58 - active card drag keeps pointer snapshot through same-ledger load and commits the original target
  ---
  duration_ms: 59.278316
  type: 'test'
  ...
# Subtest: multi-selection drag survives ledger content refresh and commits only the pointer snapshot
ok 59 - multi-selection drag survives ledger content refresh and commits only the pointer snapshot
  ---
  duration_ms: 87.068623
  type: 'test'
  ...
# Subtest: card resize resolves the current remounted node and commits pointer target geometry
ok 60 - card resize resolves the current remounted node and commits pointer target geometry
  ---
  duration_ms: 17.188726
  type: 'test'
  ...
# Subtest: browser inputs route ledger commands through runtime controllers before server effects
not ok 61 - browser inputs route ledger commands through runtime controllers before server effects
  ---
  duration_ms: 28.641791
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/input-controller-routing.integration.test.ts:1:357'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /export function renderCanvasControlOverlay\(\): void \{\s*if \(controlsDisabled\(\)\) \{[\s\S]*clearCanvasControlOverlay\(\);[\s\S]*return;/. Input:
    
    '/**\n' +
      ' * WHAT: Renders contextual card, zone, and group controls for hovered and selected canvas targets.\n' +
      ' * WHY: Control placement must follow current geometry and may use an explicit gesture selection.\n' +
      ' */\n' +
      "import { canvas, content, controlOverlay as initialControlOverlay } from '../../dom.js';\n" +
      "import { renderLedgerCardDeleteButton } from '../../ledger/component/render-ledger-card-delete-button.js';\n" +
      "import { renderLedgerCardStatusButton } from '../../ledger/component/render-ledger-card-status-button.js';\n" +
      "import { state, type SelectionState } from '../../state.js';\n" +
      '\n' +
      'type ControlTarget = {\n' +
      "  kind: 'card' | 'zone' | 'group';\n" +
      '  id: string;\n' +
      '};\n' +
      '\n' +
      'let hoveredTarget: ControlTarget | null = null;\n' +
      'let hoverBindingInitialized = false;\n' +
      'const removalTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();\n' +
      'const controlFadeDurationMs = 160;\n' +
      '\n' +
      'function targetKey(target: ControlTarget | null): string {\n' +
      "  return target ? `${target.kind}:${target.id}` : '';\n" +
      '}\n' +
      '\n' +
      'function sameTarget(a: ControlTarget | null, b: ControlTarget | null): boolean {\n' +
      '  return targetKey(a) === targetKey(b);\n' +
      '}\n' +
      '\n' +
      'function resolveControlOverlay(): HTMLElement | null {\n' +
      '  if (initialControlOverlay?.isConnected) return initialControlOverlay;\n' +
      "  if (!canvas || typeof canvas.querySelector !== 'function') return null;\n" +
      "  const existing = canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;\n" +
      '  if (existing) return existing;\n' +
      "  const overlay = document.createElement('div');\n" +
      "  overlay.className = 'canvas-control-overlay';\n" +
      '  canvas.append(overlay);\n' +
      '  return overlay;\n' +
      '}\n' +
      '\n' +
      'function existingControlOverlay(): HTMLElement | null {\n' +
      '  if (initialControlOverlay?.isConnected) return initialControlOverlay;\n' +
      "  if (!canvas || typeof canvas.querySelector !== 'function') return null;\n" +
      "  return canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;\n" +
      '}\n' +
      '\n' +
      'function clearCanvasControlOverlay(): void {\n' +
      '  hoveredTarget = null;\n' +
      '  existingControlOverlay()?.replaceChildren();\n' +
      '}\n' +
      '\n' +
      'export function hideCanvasControlOverlay(): void {\n' +
      '  existingControlOverlay()?.replaceChildren();\n' +
      '}\n' +
      '\n' +
      'function controlsDisabled(): boolean {\n' +
      "  return Boolean(canvas?.classList?.contains('low-detail'));\n" +
      '}\n' +
      '\n' +
      'function targetFromElement(element: EventTarget | null): ControlTarget | null {\n' +
      '  const node = element as HTMLElement | null;\n' +
      "  const control = node?.closest?.('.canvas-control') as HTMLElement | null;\n" +
      "  if (control?.dataset.cardId) return { kind: 'card', id: control.dataset.cardId };\n" +
      "  if (control?.dataset.zoneId) return { kind: 'zone', id: control.dataset.zoneId };\n" +
      "  if (control?.dataset.groupId) return { kind: 'group', id: control.dataset.groupId };\n" +
      '\n' +
      "  const canvasNode = node?.closest?.('.canvas-content > .card[data-card-id], .canvas-content > .zone[data-zone-id], .canvas-content > .zone[data-group-id]') as HTMLElement | null;\n" +
      "  if (canvasNode?.dataset.cardId) return { kind: 'card', id: canvasNode.dataset.cardId };\n" +
      "  if (canvasNode?.dataset.zoneId) return { kind: 'zone', id: canvasNode.dataset.zoneId };\n" +
      "  if (canvasNode?.dataset.groupId) return { kind: 'group', id: canvasNode.dataset.groupId };\n" +
      '  return null;\n' +
      '}\n' +
      '\n' +
      'function sourceElement(target: ControlTarget): HTMLElement | null {\n' +
      '  if (!content) return null;\n' +
      '  if (target.kind === \'card\') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;\n' +
      '  if (target.kind === \'zone\') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;\n' +
      '  return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;\n' +
      '}\n' +
      '\n' +
      'function selectedTargets(selection: Partial<SelectionState>): ControlTarget[] {\n' +
      '  const targets: ControlTarget[] = [];\n' +
      "  for (const id of new Set(selection.zoneIds ?? [])) targets.push({ kind: 'zone', id });\n" +
      "  for (const id of new Set(selection.groupIds ?? [])) targets.push({ kind: 'group', id });\n" +
      '  return targets;\n' +
      '}\n' +
      '\n' +
      'function visibleTargets(selection: Partial<SelectionState>): ControlTarget[] {\n' +
      '  const byKey = new Map<string, ControlTarget>();\n' +
      '  for (const target of selectedTargets(selection)) byKey.set(targetKey(target), target);\n' +
      '  if (hoveredTarget) byKey.set(targetKey(hoveredTarget), hoveredTarget);\n' +
      '  return [...byKey.values()];\n' +
      '}\n' +
      '\n' +
      'function nextFrame(callback: () => void): void {\n' +
      "  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);\n" +
      '  else setTimeout(callback, 0);\n' +
      '}\n' +
      '\n' +
      'function cancelScheduledRemoval(control: HTMLElement): void {\n' +
      '  const timer = removalTimers.get(control);\n' +
      '  if (timer) clearTimeout(timer);\n' +
      '  removalTimers.delete(control);\n' +
      '}\n' +
      '\n' +
      'function scheduleRemoval(control: HTMLElement): void {\n' +
      '  if (removalTimers.has(control)) return;\n' +
      "  control.classList.remove('is-visible');\n" +
      '  const timer = setTimeout(() => {\n' +
      "    if (!control.classList.contains('is-visible')) control.remove();\n" +
      '    removalTimers.delete(control);\n' +
      '  }, controlFadeDurationMs);\n' +
      '  removalTimers.set(control, timer);\n' +
      '}\n' +
      '\n' +
      "function placeControlGroup(group: HTMLElement, source: HTMLElement, align: 'left' | 'right', yOffset = 6): boolean {\n" +
      '  const canvasRect = canvas.getBoundingClientRect();\n' +
      '  const rect = source.getBoundingClientRect();\n' +
      '  if (rect.right < canvasRect.left || rect.left > canvasRect.right || rect.bottom < canvasRect.top || rect.top > canvasRect.bottom) return false;\n' +
      "  const x = align === 'right' ? rect.right - canvasRect.left - 6 : rect.left - canvasRect.left + 6;\n" +
      '  const y = rect.top - canvasRect.top + yOffset;\n' +
      '  group.style.left = `${Math.round(x)}px`;\n' +
      '  group.style.top = `${Math.round(y)}px`;\n' +
      "  group.style.transform = align === 'right' ? 'translateX(-100%)' : 'none';\n" +
      '  return true;\n' +
      '}\n' +
      '\n' +
      'function syncCardControls(group: HTMLElement, card: HTMLElement): boolean {\n' +
      "  if (!card.classList.contains('ledger-node')) return false;\n" +
      "  const cardId = card.dataset.cardId ?? '';\n" +
      '  if (!cardId) return false;\n' +
      "  const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';\n" +
      "  const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;\n" +
      "  const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();\n" +
      "  group.className = 'canvas-control canvas-control--card';\n" +
      '  group.dataset.cardId = cardId;\n' +
      "  if (cardZoneColor) group.style.setProperty('--card-zone-color', cardZoneColor);\n" +
      "  else group.style.removeProperty('--card-zone-color');\n" +
      "  const edit = document.createElement('button');\n" +
      "  edit.className = 'icon-button terminal-button terminal-button--compact';\n" +
      "  edit.type = 'button';\n" +
      "  edit.dataset.action = 'edit-card-title';\n" +
      '  edit.dataset.cardId = cardId;\n' +
      "  edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';\n" +
      '  edit.ariaLabel = edit.title;\n' +
      "  edit.textContent = '✎';\n" +
      "  const editBody = document.createElement('button');\n" +
      "  editBody.className = 'ledger-card-edit-toggle terminal-button terminal-button--compact';\n" +
      "  editBody.type = 'button';\n" +
      "  editBody.dataset.action = 'edit-card-description';\n" +
      '  editBody.dataset.cardId = cardId;\n' +
      "  editBody.title = 'Edit card content';\n" +
      "  editBody.setAttribute('aria-label', editBody.title);\n" +
      "  editBody.textContent = 'edit';\n" +
      "  const skill = document.createElement('button');\n" +
      "  skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';\n" +
      "  skill.type = 'button';\n" +
      "  skill.dataset.action = 'open-card-skill-modal';\n" +
      '  skill.dataset.cardId = cardId;\n' +
      "  skill.title = 'Run Codex skill';\n" +
      "  skill.setAttribute('aria-label', skill.title);\n" +
      "  skill.textContent = 'fx';\n" +
      '  const controls = card.dataset.targetLedgerId\n' +
      '    ? [edit, renderLedgerCardDeleteButton(cardId)]\n' +
      '    : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];\n' +
      '  group.replaceChildren(...controls);\n' +
      "  return placeControlGroup(group, card, 'right');\n" +
      '}\n' +
      '\n' +
      "function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' | 'group'): boolean {\n" +
      "  const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';\n" +
      '  if (!id) return false;\n' +
      '  group.className = `canvas-control canvas-control--${kind}`;\n' +
      "  if (kind === 'zone') group.dataset.zoneId = id;\n" +
      '  else group.dataset.groupId = id;\n' +
      '\n' +
      "  const edit = document.createElement('button');\n" +
      "  edit.className = 'icon-button terminal-button terminal-button--compact';\n" +
      "  edit.type = 'button';\n" +
      "  edit.dataset.action = 'edit-zone';\n" +
      "  if (kind === 'zone') edit.dataset.zoneId = id;\n" +
      '  else edit.dataset.groupId = id;\n' +
      "  edit.title = kind === 'zone' ? 'Edit zone name' : 'Edit group name';\n" +
      '  edit.ariaLabel = edit.title;\n' +
      "  edit.textContent = '✎';\n" +
      '  const controls: HTMLElement[] = [edit];\n' +
      '\n' +
      "  if (kind === 'zone') {\n" +
      "    const color = document.createElement('input');\n" +
      "    color.type = 'color';\n" +
      "    color.className = 'zone-color-edit';\n" +
      "    color.dataset.action = 'edit-zone-color';\n" +
      '    color.dataset.zoneId = id;\n' +
      "    color.ariaLabel = 'Edit zone color';\n" +
      "    color.value = zone.style.getPropertyValue('--zone-color').trim() || '#55b8ff';\n" +
      '    controls.push(color);\n' +
      "  } else if (zone.classList.contains('ledger-node')) {\n" +
      "    const deleteButton = document.createElement('button');\n" +
      "    deleteButton.className = 'ledger-group-delete terminal-button terminal-button--compact';\n" +
      "    deleteButton.type = 'button';\n" +
      "    deleteButton.dataset.action = 'confirm-delete-group';\n" +
      '    deleteButton.dataset.groupId = id;\n' +
      "    deleteButton.title = 'Delete group';\n" +
      "    deleteButton.setAttribute('aria-label', 'Delete group');\n" +
      "    deleteButton.textContent = 'X';\n" +
      '    controls.push(deleteButton);\n' +
      '  }\n' +
      '\n' +
      '  group.replaceChildren(...controls);\n' +
      "  return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);\n" +
      '}\n' +
      '\n' +
      'export function renderCanvasControlOverlay(selection: Partial<SelectionState> = state.selection): void {\n' +
      '  if (controlsDisabled()) {\n' +
      '    clearCanvasControlOverlay();\n' +
      '    return;\n' +
      '  }\n' +
      '  const overlay = resolveControlOverlay();\n' +
      '  if (!overlay || !canvas || !content) return;\n' +
      '  const activeKeys = new Set<string>();\n' +
      '  for (const target of visibleTargets(selection)) {\n' +
      '    const source = sourceEl'... 1885 more characters
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    /**
     * WHAT: Renders contextual card, zone, and group controls for hovered and selected canvas targets.
     * WHY: Control placement must follow current geometry and may use an explicit gesture selection.
     */
    import { canvas, content, controlOverlay as initialControlOverlay } from '../../dom.js';
    import { renderLedgerCardDeleteButton } from '../../ledger/component/render-ledger-card-delete-button.js';
    import { renderLedgerCardStatusButton } from '../../ledger/component/render-ledger-card-status-button.js';
    import { state, type SelectionState } from '../../state.js';
    
    type ControlTarget = {
      kind: 'card' | 'zone' | 'group';
      id: string;
    };
    
    let hoveredTarget: ControlTarget | null = null;
    let hoverBindingInitialized = false;
    const removalTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
    const controlFadeDurationMs = 160;
    
    function targetKey(target: ControlTarget | null): string {
      return target ? `${target.kind}:${target.id}` : '';
    }
    
    function sameTarget(a: ControlTarget | null, b: ControlTarget | null): boolean {
      return targetKey(a) === targetKey(b);
    }
    
    function resolveControlOverlay(): HTMLElement | null {
      if (initialControlOverlay?.isConnected) return initialControlOverlay;
      if (!canvas || typeof canvas.querySelector !== 'function') return null;
      const existing = canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
      if (existing) return existing;
      const overlay = document.createElement('div');
      overlay.className = 'canvas-control-overlay';
      canvas.append(overlay);
      return overlay;
    }
    
    function existingControlOverlay(): HTMLElement | null {
      if (initialControlOverlay?.isConnected) return initialControlOverlay;
      if (!canvas || typeof canvas.querySelector !== 'function') return null;
      return canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
    }
    
    function clearCanvasControlOverlay(): void {
      hoveredTarget = null;
      existingControlOverlay()?.replaceChildren();
    }
    
    export function hideCanvasControlOverlay(): void {
      existingControlOverlay()?.replaceChildren();
    }
    
    function controlsDisabled(): boolean {
      return Boolean(canvas?.classList?.contains('low-detail'));
    }
    
    function targetFromElement(element: EventTarget | null): ControlTarget | null {
      const node = element as HTMLElement | null;
      const control = node?.closest?.('.canvas-control') as HTMLElement | null;
      if (control?.dataset.cardId) return { kind: 'card', id: control.dataset.cardId };
      if (control?.dataset.zoneId) return { kind: 'zone', id: control.dataset.zoneId };
      if (control?.dataset.groupId) return { kind: 'group', id: control.dataset.groupId };
    
      const canvasNode = node?.closest?.('.canvas-content > .card[data-card-id], .canvas-content > .zone[data-zone-id], .canvas-content > .zone[data-group-id]') as HTMLElement | null;
      if (canvasNode?.dataset.cardId) return { kind: 'card', id: canvasNode.dataset.cardId };
      if (canvasNode?.dataset.zoneId) return { kind: 'zone', id: canvasNode.dataset.zoneId };
      if (canvasNode?.dataset.groupId) return { kind: 'group', id: canvasNode.dataset.groupId };
      return null;
    }
    
    function sourceElement(target: ControlTarget): HTMLElement | null {
      if (!content) return null;
      if (target.kind === 'card') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
      if (target.kind === 'zone') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
      return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
    }
    
    function selectedTargets(selection: Partial<SelectionState>): ControlTarget[] {
      const targets: ControlTarget[] = [];
      for (const id of new Set(selection.zoneIds ?? [])) targets.push({ kind: 'zone', id });
      for (const id of new Set(selection.groupIds ?? [])) targets.push({ kind: 'group', id });
      return targets;
    }
    
    function visibleTargets(selection: Partial<SelectionState>): ControlTarget[] {
      const byKey = new Map<string, ControlTarget>();
      for (const target of selectedTargets(selection)) byKey.set(targetKey(target), target);
      if (hoveredTarget) byKey.set(targetKey(hoveredTarget), hoveredTarget);
      return [...byKey.values()];
    }
    
    function nextFrame(callback: () => void): void {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
      else setTimeout(callback, 0);
    }
    
    function cancelScheduledRemoval(control: HTMLElement): void {
      const timer = removalTimers.get(control);
      if (timer) clearTimeout(timer);
      removalTimers.delete(control);
    }
    
    function scheduleRemoval(control: HTMLElement): void {
      if (removalTimers.has(control)) return;
      control.classList.remove('is-visible');
      const timer = setTimeout(() => {
        if (!control.classList.contains('is-visible')) control.remove();
        removalTimers.delete(control);
      }, controlFadeDurationMs);
      removalTimers.set(control, timer);
    }
    
    function placeControlGroup(group: HTMLElement, source: HTMLElement, align: 'left' | 'right', yOffset = 6): boolean {
      const canvasRect = canvas.getBoundingClientRect();
      const rect = source.getBoundingClientRect();
      if (rect.right < canvasRect.left || rect.left > canvasRect.right || rect.bottom < canvasRect.top || rect.top > canvasRect.bottom) return false;
      const x = align === 'right' ? rect.right - canvasRect.left - 6 : rect.left - canvasRect.left + 6;
      const y = rect.top - canvasRect.top + yOffset;
      group.style.left = `${Math.round(x)}px`;
      group.style.top = `${Math.round(y)}px`;
      group.style.transform = align === 'right' ? 'translateX(-100%)' : 'none';
      return true;
    }
    
    function syncCardControls(group: HTMLElement, card: HTMLElement): boolean {
      if (!card.classList.contains('ledger-node')) return false;
      const cardId = card.dataset.cardId ?? '';
      if (!cardId) return false;
      const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';
      const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;
      const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();
      group.className = 'canvas-control canvas-control--card';
      group.dataset.cardId = cardId;
      if (cardZoneColor) group.style.setProperty('--card-zone-color', cardZoneColor);
      else group.style.removeProperty('--card-zone-color');
      const edit = document.createElement('button');
      edit.className = 'icon-button terminal-button terminal-button--compact';
      edit.type = 'button';
      edit.dataset.action = 'edit-card-title';
      edit.dataset.cardId = cardId;
      edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';
      edit.ariaLabel = edit.title;
      edit.textContent = '✎';
      const editBody = document.createElement('button');
      editBody.className = 'ledger-card-edit-toggle terminal-button terminal-button--compact';
      editBody.type = 'button';
      editBody.dataset.action = 'edit-card-description';
      editBody.dataset.cardId = cardId;
      editBody.title = 'Edit card content';
      editBody.setAttribute('aria-label', editBody.title);
      editBody.textContent = 'edit';
      const skill = document.createElement('button');
      skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';
      skill.type = 'button';
      skill.dataset.action = 'open-card-skill-modal';
      skill.dataset.cardId = cardId;
      skill.title = 'Run Codex skill';
      skill.setAttribute('aria-label', skill.title);
      skill.textContent = 'fx';
      const controls = card.dataset.targetLedgerId
        ? [edit, renderLedgerCardDeleteButton(cardId)]
        : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];
      group.replaceChildren(...controls);
      return placeControlGroup(group, card, 'right');
    }
    
    function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' | 'group'): boolean {
      const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';
      if (!id) return false;
      group.className = `canvas-control canvas-control--${kind}`;
      if (kind === 'zone') group.dataset.zoneId = id;
      else group.dataset.groupId = id;
    
      const edit = document.createElement('button');
      edit.className = 'icon-button terminal-button terminal-button--compact';
      edit.type = 'button';
      edit.dataset.action = 'edit-zone';
      if (kind === 'zone') edit.dataset.zoneId = id;
      else edit.dataset.groupId = id;
      edit.title = kind === 'zone' ? 'Edit zone name' : 'Edit group name';
      edit.ariaLabel = edit.title;
      edit.textContent = '✎';
      const controls: HTMLElement[] = [edit];
    
      if (kind === 'zone') {
        const color = document.createElement('input');
        color.type = 'color';
        color.className = 'zone-color-edit';
        color.dataset.action = 'edit-zone-color';
        color.dataset.zoneId = id;
        color.ariaLabel = 'Edit zone color';
        color.value = zone.style.getPropertyValue('--zone-color').trim() || '#55b8ff';
        controls.push(color);
      } else if (zone.classList.contains('ledger-node')) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'ledger-group-delete terminal-button terminal-button--compact';
        deleteButton.type = 'button';
        deleteButton.dataset.action = 'confirm-delete-group';
        deleteButton.dataset.groupId = id;
        deleteButton.title = 'Delete group';
        deleteButton.setAttribute('aria-label', 'Delete group');
        deleteButton.textContent = 'X';
        controls.push(deleteButton);
      }
    
      group.replaceChildren(...controls);
      return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);
    }
    
    export function renderCanvasControlOverlay(selection: Partial<SelectionState> = state.selection): void {
      if (controlsDisabled()) {
        clearCanvasControlOverlay();
        return;
      }
      const overlay = resolveControlOverlay();
      if (!overlay || !canvas || !content) return;
      const activeKeys = new Set<string>();
      for (const target of visibleTargets(selection)) {
        const source = sourceElement(target);
        if (!source || source.hidden || source.style.display === 'none') continue;
        const key = targetKey(target);
        let control = overlay.querySelector(`[data-control-key="${CSS.escape(key)}"]`) as HTMLElement | null;
        const isNew = !control;
        if (!control) {
          control = document.createElement('div');
          control.dataset.controlKey = key;
        }
        const visible = target.kind === 'card'
          ? syncCardControls(control, source)
          : syncZoneControls(control, source, target.kind);
        if (!visible) continue;
        activeKeys.add(key);
        cancelScheduledRemoval(control);
        if (isNew) {
          overlay.append(control);
          nextFrame(() => nextFrame(() => control?.classList.add('is-visible')));
        } else {
          control.classList.add('is-visible');
        }
      }
      for (const control of Array.from(overlay.querySelectorAll('.canvas-control')) as HTMLElement[]) {
        if (!activeKeys.has(control.dataset.controlKey ?? '')) scheduleRemoval(control);
      }
    }
    
    export function bindCanvasControlOverlayHover(): void {
      if (hoverBindingInitialized || !canvas) return;
      hoverBindingInitialized = true;
      canvas.addEventListener('mouseover', (event) => {
        if (controlsDisabled()) {
          clearCanvasControlOverlay();
          return;
        }
        const next = targetFromElement(event.target);
        if (!next || sameTarget(hoveredTarget, next)) return;
        hoveredTarget = next;
        renderCanvasControlOverlay();
      });
      canvas.addEventListener('mouseout', (event) => {
        if (controlsDisabled()) {
          clearCanvasControlOverlay();
          return;
        }
        const previous = targetFromElement(event.target);
        if (!previous) return;
        const next = targetFromElement(event.relatedTarget);
        if (sameTarget(previous, next)) return;
        if (sameTarget(previous, hoveredTarget)) {
          hoveredTarget = next;
          renderCanvasControlOverlay();
        }
      });
    }
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/input-controller-routing.integration.test.ts:289:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: ctrl-d routes selected card resize through the same controller as the toolbar command
ok 62 - ctrl-d routes selected card resize through the same controller as the toolbar command
  ---
  duration_ms: 1.654455
  type: 'test'
  ...
# Subtest: ctrl-d zone fit can shrink a selected zone down to smaller card bounds
ok 63 - ctrl-d zone fit can shrink a selected zone down to smaller card bounds
  ---
  duration_ms: 1.018405
  type: 'test'
  ...
# Subtest: runbook button opens current workspace, image, and voice configuration notes
ok 64 - runbook button opens current workspace, image, and voice configuration notes
  ---
  duration_ms: 4.967543
  type: 'test'
  ...
# Subtest: ledger cards render markdown descriptions as DOM elements
ok 65 - ledger cards render markdown descriptions as DOM elements
  ---
  duration_ms: 3.976918
  type: 'test'
  ...
# Subtest: ledger cards render markdown tables as table elements
ok 66 - ledger cards render markdown tables as table elements
  ---
  duration_ms: 0.965549
  type: 'test'
  ...
# Subtest: ledger cards render markdown and bare urls as links
ok 67 - ledger cards render markdown and bare urls as links
  ---
  duration_ms: 3.05245
  type: 'test'
  ...
# Subtest: ledger cards render markdown headings through the shared markdown renderer
ok 68 - ledger cards render markdown headings through the shared markdown renderer
  ---
  duration_ms: 1.019757
  type: 'test'
  ...
# Subtest: ledger cards render horizontal rules through the shared markdown renderer
ok 69 - ledger cards render horizontal rules through the shared markdown renderer
  ---
  duration_ms: 0.426016
  type: 'test'
  ...
# Subtest: ledger cards render fenced code blocks with syntax spans
ok 70 - ledger cards render fenced code blocks with syntax spans
  ---
  duration_ms: 1.202738
  type: 'test'
  ...
# Subtest: ledger cards use highlight.js for mainstream language fences when available
ok 71 - ledger cards use highlight.js for mainstream language fences when available
  ---
  duration_ms: 3.32216
  type: 'test'
  ...
# Subtest: runtime loads vendored highlight.js assets before canvas boot
ok 72 - runtime loads vendored highlight.js assets before canvas boot
  ---
  duration_ms: 39.184749
  type: 'test'
  ...
# Subtest: ledger cards render visual labels as top-right card-colored chips
ok 73 - ledger cards render visual labels as top-right card-colored chips
  ---
  duration_ms: 1.445706
  type: 'test'
  ...
# Subtest: ledger cards receive deterministic zone color before tab controls paint
ok 74 - ledger cards receive deterministic zone color before tab controls paint
  ---
  duration_ms: 1.831821
  type: 'test'
  ...
# Subtest: ledger card titles include PascalCase word break opportunities without changing text
ok 75 - ledger card titles include PascalCase word break opportunities without changing text
  ---
  duration_ms: 0.463241
  type: 'test'
  ...
# Subtest: ledger card titles render inline markdown without dropping title wrapping
ok 76 - ledger card titles render inline markdown without dropping title wrapping
  ---
  duration_ms: 0.437946
  type: 'test'
  ...
# Subtest: ledger card detail title exposes a hover edit action beside the title
ok 77 - ledger card detail title exposes a hover edit action beside the title
  ---
  duration_ms: 0.394462
  type: 'test'
  ...
# Subtest: ledger card delete action is rendered by overlay controls, not inside card DOM
ok 78 - ledger card delete action is rendered by overlay controls, not inside card DOM
  ---
  duration_ms: 0.423864
  type: 'test'
  ...
# Subtest: ledger card shell stays overview-only unless detail is already mounted
ok 79 - ledger card shell stays overview-only unless detail is already mounted
  ---
  duration_ms: 0.741341
  type: 'test'
  ...
# Subtest: linked ledger overview cards expose target ledger id and omit status chrome
ok 80 - linked ledger overview cards expose target ledger id and omit status chrome
  ---
  duration_ms: 0.371968
  type: 'test'
  ...
# Subtest: ledger groups leave delete action to overlay controls
ok 81 - ledger groups leave delete action to overlay controls
  ---
  duration_ms: 0.427738
  type: 'test'
  ...
# Subtest: ledger cards with fields render description and fields tab panels
ok 82 - ledger cards with fields render description and fields tab panels
  ---
  duration_ms: 0.846793
  type: 'test'
  ...
# Subtest: ledger content refresh is deferred while voice recording is active
ok 83 - ledger content refresh is deferred while voice recording is active
  ---
  duration_ms: 210.014732
  type: 'test'
  ...
# Subtest: thread content refresh is deferred separately from canvas refresh while voice recording is active
ok 84 - thread content refresh is deferred separately from canvas refresh while voice recording is active
  ---
  duration_ms: 1.606422
  type: 'test'
  ...
# Subtest: thread content refresh keeps newer selection made while same-ledger load is in flight
ok 85 - thread content refresh keeps newer selection made while same-ledger load is in flight
  ---
  duration_ms: 6.86531
  type: 'test'
  ...
# Subtest: thread content events rerender the thread panel without remounting the canvas
ok 86 - thread content events rerender the thread panel without remounting the canvas
  ---
  duration_ms: 0.548933
  type: 'test'
  ...
# Subtest: card content refresh resizes the changed card after the refreshed render
ok 87 - card content refresh resizes the changed card after the refreshed render
  ---
  duration_ms: 0.323774
  type: 'test'
  ...
# Subtest: changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file
ok 88 - changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file
  ---
  duration_ms: 1.765863
  type: 'test'
  ...
# Subtest: ledgers canvas route and endpoint resolve separately from real ledgers
ok 89 - ledgers canvas route and endpoint resolve separately from real ledgers
  ---
  duration_ms: 1.256821
  type: 'test'
  ...
# Subtest: overview ledger entry is resolved from the hovered card element
ok 90 - overview ledger entry is resolved from the hovered card element
  ---
  duration_ms: 0.346829
  type: 'test'
  ...
# Subtest: canonical ledger entry viewport uses min scale centered framing
ok 91 - canonical ledger entry viewport uses min scale centered framing
  ---
  duration_ms: 0.330904
  type: 'test'
  ...
# Subtest: default ledgers are real decision-os ledgers and are not rendered as header tabs
ok 92 - default ledgers are real decision-os ledgers and are not rendered as header tabs
  ---
  duration_ms: 1.674726
  type: 'test'
  ...
# Subtest: relationship labels inherit cached endpoint colors without class overrides
ok 93 - relationship labels inherit cached endpoint colors without class overrides
  ---
  duration_ms: 2.09662
  type: 'test'
  ...
# Subtest: relationship endpoint labels are routed outside expanded card boxes
not ok 94 - relationship endpoint labels are routed outside expanded card boxes
  ---
  duration_ms: 3.947455
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts:1:1401'
  failureType: 'testCodeFailure'
  error: "Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts"
  code: 'ERR_MODULE_NOT_FOUND'
  stack: |-
    Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
    packageResolve (node:internal/modules/esm/resolve:768:81)
    moduleResolve (node:internal/modules/esm/resolve:855:18)
    defaultResolve (node:internal/modules/esm/resolve:985:11)
    nextResolve (node:internal/modules/esm/hooks:748:28)
    resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488231:2:3744)
    resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488231:2:4243)
    resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488231:2:4984)
    resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488231:2:5361)
    nextResolve (node:internal/modules/esm/hooks:748:28)
  ...
# Subtest: ledger relationship routing uses active ledger geometry instead of card DOM measurement
ok 95 - ledger relationship routing uses active ledger geometry instead of card DOM measurement
  ---
  duration_ms: 1.308929
  type: 'test'
  ...
# Subtest: selected ledger geometry commits from active ledger state instead of DOM snapshots
ok 96 - selected ledger geometry commits from active ledger state instead of DOM snapshots
  ---
  duration_ms: 0.34854
  type: 'test'
  ...
# Subtest: direct card clicks do not preserve expanded zone selection
ok 97 - direct card clicks do not preserve expanded zone selection
  ---
  duration_ms: 1.080758
  type: 'test'
  ...
# Subtest: direct clicks still preserve ordinary selected cards for dragging
ok 98 - direct clicks still preserve ordinary selected cards for dragging
  ---
  duration_ms: 0.210718
  type: 'test'
  ...
# Subtest: shift click is the additive selection modifier
ok 99 - shift click is the additive selection modifier
  ---
  duration_ms: 0.358582
  type: 'test'
  ...
# Subtest: target selection updates selection chrome without full canvas rerender
ok 100 - target selection updates selection chrome without full canvas rerender
  ---
  duration_ms: 0.211389
  type: 'test'
  ...
# Subtest: card focus click does not enter the geometry commit or full canvas render path
not ok 101 - card focus click does not enter the geometry commit or full canvas render path
  ---
  duration_ms: 2.708227
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/selection-direct-card-click.integration.test.ts:1:1547'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /await commitSelectedLedgerGeometry\(\)/. Input:
    
    '/**\n' +
      ' * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.\n' +
      ' * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.\n' +
      ' */\n' +
      "import { state } from '../../state.js';\n" +
      "import { canvasPoint } from '../../canvas/helper/canvas-point.js';\n" +
      "import { createCardController } from '../../card/controller/create-card-controller.js';\n" +
      "import { createZoneController } from '../../zone/controller/create-zone-controller.js';\n" +
      "import { createGroupController } from '../../group/controller/create-group-controller.js';\n" +
      "import { commitSelectedLedgerGeometry } from '../../ledger/effect/commit-selected-ledger-geometry.js';\n" +
      "import { finishPointer } from '../effect/finish-pointer.js';\n" +
      "import { persistState } from '../../persistence/effect/persist-state.js';\n" +
      "import { point } from '../helper/point.js';\n" +
      "import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';\n" +
      "import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';\n" +
      "import { selectIntersecting } from '../../selection/effect/select-intersecting.js';\n" +
      "import { selectTarget } from '../../selection/controller/select-target.js';\n" +
      "import { moveSelected } from '../../selection/effect/move-selected.js';\n" +
      "import { resizeSelectedCard } from '../../card/effect/resize-selected-card.js';\n" +
      "import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';\n" +
      "import { isClickMovement, pointerDistancePx } from '../helper/click-movement.js';\n" +
      "import { telemetry } from '../../telemetry/effect/telemetry.js';\n" +
      '\n' +
      'export async function handlePointerUp(event: PointerEvent): Promise<void> {\n' +
      '  if (!state.pointer) return;\n' +
      '  event.preventDefault();\n' +
      '  const pointerSession = state.pointer;\n' +
      '  const pointerIntent = pointerSession.intent;\n' +
      '  let releaseRendered = false;\n' +
      "  telemetry('canvas-pointer-up', { intent: pointerIntent });\n" +
      '  const releasePoint = point(event);\n' +
      '  const releaseCanvas = canvasPoint(releasePoint);\n' +
      '  const moved = pointerDistancePx(pointerSession.start, releasePoint);\n' +
      '  const isForcedPan = Boolean(pointerSession.forcedPan || pointerSession.ctrlPan);\n' +
      "  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'zone' && isClickMovement(moved)) {\n" +
      "    selectTarget('zone', pointerSession.targetId, false);\n" +
      "    telemetry('resolve-selection-target', { kind: 'zone', id: pointerSession.targetId, clickSelect: true });\n" +
      '  }\n' +
      "  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'group' && isClickMovement(moved)) {\n" +
      "    selectTarget('group', pointerSession.targetId, false);\n" +
      "    telemetry('resolve-selection-target', { kind: 'group', id: pointerSession.targetId, clickSelect: true });\n" +
      '  }\n' +
      "  if (pointerIntent === 'marquee') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      '    selectIntersecting(rect);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      "    telemetry('resolve-selection-target', { selection: state.selection });\n" +
      '  }\n' +
      "  if (pointerIntent === 'draw-card') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      '    finishPointer(event);\n' +
      '    await createCardController(rect);\n' +
      '  }\n' +
      "  if (pointerIntent === 'draw-zone') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      '    finishPointer(event);\n' +
      '    await createZoneController(rect);\n' +
      '  }\n' +
      "  if (pointerIntent === 'draw-group') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      '    finishPointer(event);\n' +
      '    await createGroupController(rect);\n' +
      '  }\n' +
      "  if ((pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') && isClickMovement(moved)) {\n" +
      '    finishPointer(event);\n' +
      '    persistState();\n' +
      '    return;\n' +
      '  }\n' +
      "  if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {\n" +
      '    const gestureSelection = pointerSession.selectionSnapshot ?? state.selection;\n' +
      '    const canvasDx = releaseCanvas.x - pointerSession.currentCanvas.x;\n' +
      '    const canvasDy = releaseCanvas.y - pointerSession.currentCanvas.y;\n' +
      '    if (canvasDx || canvasDy) {\n' +
      "      if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);\n" +
      "      if (pointerIntent === 'resize') {\n" +
      "        if (pointerSession.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);\n" +
      '        else resizeSelectedZone(canvasDx, canvasDy);\n' +
      '      }\n' +
      '    }\n' +
      '    finishPointer(event);\n' +
      '    releaseRendered = await commitSelectedLedgerGeometry(gestureSelection);\n' +
      '  }\n' +
      "  if (pointerIntent === 'pan' || pointerIntent === 'marquee') finishPointer(event);\n" +
      '  persistState();\n' +
      "  if (pointerIntent !== 'pan' && !releaseRendered) renderCanvasSurface();\n" +
      '}\n'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    /**
     * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.
     * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.
     */
    import { state } from '../../state.js';
    import { canvasPoint } from '../../canvas/helper/canvas-point.js';
    import { createCardController } from '../../card/controller/create-card-controller.js';
    import { createZoneController } from '../../zone/controller/create-zone-controller.js';
    import { createGroupController } from '../../group/controller/create-group-controller.js';
    import { commitSelectedLedgerGeometry } from '../../ledger/effect/commit-selected-ledger-geometry.js';
    import { finishPointer } from '../effect/finish-pointer.js';
    import { persistState } from '../../persistence/effect/persist-state.js';
    import { point } from '../helper/point.js';
    import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';
    import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
    import { selectIntersecting } from '../../selection/effect/select-intersecting.js';
    import { selectTarget } from '../../selection/controller/select-target.js';
    import { moveSelected } from '../../selection/effect/move-selected.js';
    import { resizeSelectedCard } from '../../card/effect/resize-selected-card.js';
    import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';
    import { isClickMovement, pointerDistancePx } from '../helper/click-movement.js';
    import { telemetry } from '../../telemetry/effect/telemetry.js';
    
    export async function handlePointerUp(event: PointerEvent): Promise<void> {
      if (!state.pointer) return;
      event.preventDefault();
      const pointerSession = state.pointer;
      const pointerIntent = pointerSession.intent;
      let releaseRendered = false;
      telemetry('canvas-pointer-up', { intent: pointerIntent });
      const releasePoint = point(event);
      const releaseCanvas = canvasPoint(releasePoint);
      const moved = pointerDistancePx(pointerSession.start, releasePoint);
      const isForcedPan = Boolean(pointerSession.forcedPan || pointerSession.ctrlPan);
      if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'zone' && isClickMovement(moved)) {
        selectTarget('zone', pointerSession.targetId, false);
        telemetry('resolve-selection-target', { kind: 'zone', id: pointerSession.targetId, clickSelect: true });
      }
      if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'group' && isClickMovement(moved)) {
        selectTarget('group', pointerSession.targetId, false);
        telemetry('resolve-selection-target', { kind: 'group', id: pointerSession.targetId, clickSelect: true });
      }
      if (pointerIntent === 'marquee') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        selectIntersecting(rect);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        telemetry('resolve-selection-target', { selection: state.selection });
      }
      if (pointerIntent === 'draw-card') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        finishPointer(event);
        await createCardController(rect);
      }
      if (pointerIntent === 'draw-zone') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        finishPointer(event);
        await createZoneController(rect);
      }
      if (pointerIntent === 'draw-group') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        finishPointer(event);
        await createGroupController(rect);
      }
      if ((pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') && isClickMovement(moved)) {
        finishPointer(event);
        persistState();
        return;
      }
      if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {
        const gestureSelection = pointerSession.selectionSnapshot ?? state.selection;
        const canvasDx = releaseCanvas.x - pointerSession.currentCanvas.x;
        const canvasDy = releaseCanvas.y - pointerSession.currentCanvas.y;
        if (canvasDx || canvasDy) {
          if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);
          if (pointerIntent === 'resize') {
            if (pointerSession.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);
            else resizeSelectedZone(canvasDx, canvasDy);
          }
        }
        finishPointer(event);
        releaseRendered = await commitSelectedLedgerGeometry(gestureSelection);
      }
      if (pointerIntent === 'pan' || pointerIntent === 'marquee') finishPointer(event);
      persistState();
      if (pointerIntent !== 'pan' && !releaseRendered) renderCanvasSurface();
    }
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/selection-direct-card-click.integration.test.ts:44:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: skillCategories exposes the compact modal taxonomy
ok 102 - skillCategories exposes the compact modal taxonomy
  ---
  duration_ms: 1.809762
  type: 'test'
  ...
# Subtest: categoryForSkill maps known skills and leaves custom skills explicit
ok 103 - categoryForSkill maps known skills and leaves custom skills explicit
  ---
  duration_ms: 0.295911
  type: 'test'
  ...
# Subtest: colorForSkillCategory returns stable color tokens for modal tags
ok 104 - colorForSkillCategory returns stable color tokens for modal tags
  ---
  duration_ms: 0.205703
  type: 'test'
  ...
# Subtest: thread accent resolves card zone color before selected border color
ok 105 - thread accent resolves card zone color before selected border color
  ---
  duration_ms: 1.192245
  type: 'test'
  ...
# Subtest: thread accent colors feed the voice widget graph and frame
ok 106 - thread accent colors feed the voice widget graph and frame
  ---
  duration_ms: 4.104037
  type: 'test'
  ...
# Subtest: thread note image resize survives stale server ledger merges
ok 107 - thread note image resize survives stale server ledger merges
  ---
  duration_ms: 1.325135
  type: 'test'
  ...
# Subtest: thread-id-for-target maps selected canvas objects to canonical thread ids
ok 108 - thread-id-for-target maps selected canvas objects to canonical thread ids
  ---
  duration_ms: 1.348861
  type: 'test'
  ...
# Subtest: select-thread clears stale idle voice status when card context changes
ok 109 - select-thread clears stale idle voice status when card context changes
  ---
  duration_ms: 4.061948
  type: 'test'
  ...
# Subtest: select-thread restores saved thread scroll instead of pinning when returning to a thread
ok 110 - select-thread restores saved thread scroll instead of pinning when returning to a thread
  ---
  duration_ms: 0.389125
  type: 'test'
  ...
# Subtest: select-thread ignores thread changes while voice recording is active
ok 111 - select-thread ignores thread changes while voice recording is active
  ---
  duration_ms: 0.291036
  type: 'test'
  ...
# Subtest: close-thread-panel ignores close requests while voice recording is active
ok 112 - close-thread-panel ignores close requests while voice recording is active
  ---
  duration_ms: 0.316284
  type: 'test'
  ...
# Subtest: thread drafts persist per thread through localStorage
ok 113 - thread drafts persist per thread through localStorage
  ---
  duration_ms: 0.333758
  type: 'test'
  ...
# Subtest: thread scroll position persists per thread and restores after layout settles
ok 114 - thread scroll position persists per thread and restores after layout settles
  ---
  duration_ms: 0.306065
  type: 'test'
  ...
# Subtest: pin-thread-feed-to-last-message scrolls the thread viewport to the newest note
ok 115 - pin-thread-feed-to-last-message scrolls the thread viewport to the newest note
  ---
  duration_ms: 1.082551
  type: 'test'
  ...
# Subtest: render-thread-jump-button shows only when the thread viewport is away from the bottom
ok 116 - render-thread-jump-button shows only when the thread viewport is away from the bottom
  ---
  duration_ms: 0.814759
  type: 'test'
  ...
# Subtest: render-thread-notes shows active thread conversation entries
ok 117 - render-thread-notes shows active thread conversation entries
  ---
  duration_ms: 10.357278
  type: 'test'
  ...
# Subtest: render-thread-notes keeps failed voice audio retryable
ok 118 - render-thread-notes keeps failed voice audio retryable
  ---
  duration_ms: 0.77975
  type: 'test'
  ...
# Subtest: render-thread-notes keeps active voice transcription progress concise
ok 119 - render-thread-notes keeps active voice transcription progress concise
  ---
  duration_ms: 0.585809
  type: 'test'
  ...
# Subtest: render-thread-notes fails stale voice transcription and exposes retry
ok 120 - render-thread-notes fails stale voice transcription and exposes retry
  ---
  duration_ms: 2.360146
  type: 'test'
  ...
# Subtest: render-thread-notes separates operator and agent speaker ownership
ok 121 - render-thread-notes separates operator and agent speaker ownership
  ---
  duration_ms: 0.833178
  type: 'test'
  ...
# Subtest: render-thread-notes summarizes codex tool calls without showing output by default
ok 122 - render-thread-notes summarizes codex tool calls without showing output by default
  ---
  duration_ms: 1.516839
  type: 'test'
  ...
# Subtest: render-thread-notes renders escaped newline agent answers as markdown blocks
ok 123 - render-thread-notes renders escaped newline agent answers as markdown blocks
  ---
  duration_ms: 0.345956
  type: 'test'
  ...
# Subtest: resolve-thread-target-title prefers the visible card title over the thread id
ok 124 - resolve-thread-target-title prefers the visible card title over the thread id
  ---
  duration_ms: 1.305655
  type: 'test'
  ...
# Subtest: resolve-thread-target-title falls back to ledger card titles
ok 125 - resolve-thread-target-title falls back to ledger card titles
  ---
  duration_ms: 0.296074
  type: 'test'
  ...
# Subtest: card-has-agent-last-answer only marks assistant or agent latest notes
ok 126 - card-has-agent-last-answer only marks assistant or agent latest notes
  ---
  duration_ms: 0.225366
  type: 'test'
  ...
# Subtest: resolve-card-work-status derives processing from latest operator notes and lets done win
ok 127 - resolve-card-work-status derives processing from latest operator notes and lets done win
  ---
  duration_ms: 0.260844
  type: 'test'
  ...
# Subtest: visible card quality refresh computes viewport card candidates from ledger geometry
ok 128 - visible card quality refresh computes viewport card candidates from ledger geometry
  ---
  duration_ms: 1.596294
  type: 'test'
  ...
# Subtest: zoomed card media promotes the native carousel into an untransformed overlay
ok 129 - zoomed card media promotes the native carousel into an untransformed overlay
  ---
  duration_ms: 1.290788
  type: 'test'
  ...
# Subtest: transcribing voice status hides recorder and keeps text composer visible
ok 130 - transcribing voice status hides recorder and keeps text composer visible
  ---
  duration_ms: 5.226391
  type: 'test'
  ...
# Subtest: stale transcribing voice notes fail after 30 seconds or missing start time
ok 131 - stale transcribing voice notes fail after 30 seconds or missing start time
  ---
  duration_ms: 1.617483
  type: 'test'
  ...
# Subtest: fill-thread-draft appends transcribed text to the active draft
ok 132 - fill-thread-draft appends transcribed text to the active draft
  ---
  duration_ms: 0.737155
  type: 'test'
  ...
# Subtest: upload-voice-audio posts captured audio to backend upload route
ok 133 - upload-voice-audio posts captured audio to backend upload route
  ---
  duration_ms: 21.848385
  type: 'test'
  ...
# Subtest: upload-voice-audio preserves wav content type for provider-safe transcription
ok 134 - upload-voice-audio preserves wav content type for provider-safe transcription
  ---
  duration_ms: 0.704858
  type: 'test'
  ...
# Subtest: upload-voice-audio falls back to the current route ledger and thread card id
ok 135 - upload-voice-audio falls back to the current route ledger and thread card id
  ---
  duration_ms: 0.747589
  type: 'test'
  ...
# Subtest: upload-voice-audio reports accepted upload before transcription provider runs
ok 136 - upload-voice-audio reports accepted upload before transcription provider runs
  ---
  duration_ms: 0.523749
  type: 'test'
  ...
# Subtest: request-transcription keeps preserved upload retryable when metadata commit fails
ok 137 - request-transcription keeps preserved upload retryable when metadata commit fails
  ---
  duration_ms: 8.819622
  type: 'test'
  ...
# Subtest: request-transcription keeps optimistic upload status separate from provider config
ok 138 - request-transcription keeps optimistic upload status separate from provider config
  ---
  duration_ms: 3.93972
  type: 'test'
  ...
# Subtest: request-transcription updates the captured thread after selection changes
ok 139 - request-transcription updates the captured thread after selection changes
  ---
  duration_ms: 1.604067
  type: 'test'
  ...
# Subtest: append-voice-note persists voice metadata to the active thread ledger
ok 140 - append-voice-note persists voice metadata to the active thread ledger
  ---
  duration_ms: 1.267124
  type: 'test'
  ...
# Subtest: create-note-controller renders a text note before backend reconciliation
ok 141 - create-note-controller renders a text note before backend reconciliation
  ---
  duration_ms: 2.109033
  type: 'test'
  ...
# Subtest: active ledger reload keeps optimistic thread notes missing from stale server state
ok 142 - active ledger reload keeps optimistic thread notes missing from stale server state
  ---
  duration_ms: 1.4303
  type: 'test'
  ...
# Subtest: append-voice-note converts legacy notes array into durable thread map
ok 143 - append-voice-note converts legacy notes array into durable thread map
  ---
  duration_ms: 0.696099
  type: 'test'
  ...
# Subtest: voice waveform preserves full recording peaks when compressed
ok 144 - voice waveform preserves full recording peaks when compressed
  ---
  duration_ms: 1.634015
  type: 'test'
  ...
# Subtest: voice waveform painter does not use a rolling shifted buffer
ok 145 - voice waveform painter does not use a rolling shifted buffer
  ---
  duration_ms: 0.498981
  type: 'test'
  ...
# Subtest: voice values tick at 30 fps while render remains requestAnimationFrame driven
ok 146 - voice values tick at 30 fps while render remains requestAnimationFrame driven
  ---
  duration_ms: 0.333072
  type: 'test'
  ...
# Subtest: recording voice dock hides the idle thread input status row
ok 147 - recording voice dock hides the idle thread input status row
  ---
  duration_ms: 0.267865
  type: 'test'
  ...
# Subtest: voice level calculation preserves quiet input without a threshold gate
ok 148 - voice level calculation preserves quiet input without a threshold gate
  ---
  duration_ms: 0.315362
  type: 'test'
  ...
# Subtest: voice capture path disables browser noise gates and visual smoothing
ok 149 - voice capture path disables browser noise gates and visual smoothing
  ---
  duration_ms: 0.442352
  type: 'test'
  ...
# Subtest: voice visualization rescales the observed recording peak to 1.0
ok 150 - voice visualization rescales the observed recording peak to 1.0
  ---
  duration_ms: 1.148865
  type: 'test'
  ...
# Subtest: voice waveform peak fills 95 percent of the graph height
ok 151 - voice waveform peak fills 95 percent of the graph height
  ---
  duration_ms: 0.31599
  type: 'test'
  ...
# Subtest: voice gauge interpolates between committed 30 fps value changes
ok 152 - voice gauge interpolates between committed 30 fps value changes
  ---
  duration_ms: 0.493405
  type: 'test'
  ...
# Subtest: zone color input previews during drag and commits only on final change
ok 153 - zone color input previews during drag and commits only on final change
  ---
  duration_ms: 1.551214
  type: 'test'
  ...
# Subtest: interactive color controls are excluded from canvas pointer and drag capture
ok 154 - interactive color controls are excluded from canvas pointer and drag capture
  ---
  duration_ms: 0.357019
  type: 'test'
  ...
# Subtest: zone card intersection uses ledger geometry without DOM reads
ok 155 - zone card intersection uses ledger geometry without DOM reads
  ---
  duration_ms: 2.10776
  type: 'test'
  ...
# Subtest: zone card intersection DOM fallback uses canvas geometry without viewport layout reads
ok 156 - zone card intersection DOM fallback uses canvas geometry without viewport layout reads
  ---
  duration_ms: 0.592009
  type: 'test'
  ...
# Subtest: zone labels render through an overlay above cards instead of the zone stacking context
ok 157 - zone labels render through an overlay above cards instead of the zone stacking context
  ---
  duration_ms: 1.510853
  type: 'test'
  ...
# Subtest: regular zones keep only their inner line shadow
ok 158 - regular zones keep only their inner line shadow
  ---
  duration_ms: 0.425294
  type: 'test'
  ...
# Subtest: low-detail zoom hides card detail while keeping counter-scaled card titles
ok 159 - low-detail zoom hides card detail while keeping counter-scaled card titles
  ---
  duration_ms: 2.408212
  type: 'test'
  ...
# Subtest: zone edit and color controls render in the viewport overlay instead of zone DOM
ok 160 - zone edit and color controls render in the viewport overlay instead of zone DOM
  ---
  duration_ms: 0.886109
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/selection/selection-tool-safety.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488861:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488861:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488861:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488861:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/selection/selection-tool-safety.integration.test.ts
not ok 44 - test/selection/selection-tool-safety.integration.test.ts
  ---
  duration_ms: 396.194408
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/selection/selection-tool-safety.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/thread/thread-and-selection-actions.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488884:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488884:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488884:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488884:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/thread/thread-and-selection-actions.integration.test.ts
not ok 45 - test/thread/thread-and-selection-actions.integration.test.ts
  ---
  duration_ms: 391.966542
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/thread/thread-and-selection-actions.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/toolbox/toolbox-navigation-zone.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488845:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488845:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488845:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488845:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/toolbox/toolbox-navigation-zone.integration.test.ts
not ok 46 - test/toolbox/toolbox-navigation-zone.integration.test.ts
  ---
  duration_ms: 343.042729
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/toolbox/toolbox-navigation-zone.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/boot/controller/boot-surface-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488934:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488934:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488934:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488934:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/boot/controller/boot-surface-controller.test.ts
not ok 47 - test/unit/boot/controller/boot-surface-controller.test.ts
  ---
  duration_ms: 394.109312
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/boot/controller/boot-surface-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/boot/helper/load-ledger-state.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488833:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488833:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488833:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488833:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/boot/helper/load-ledger-state.test.ts
not ok 48 - test/unit/boot/helper/load-ledger-state.test.ts
  ---
  duration_ms: 307.252515
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/boot/helper/load-ledger-state.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/canvas/effect/render-canvas-surface.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488872:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488872:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488872:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488872:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/canvas/effect/render-canvas-surface.test.ts
not ok 49 - test/unit/canvas/effect/render-canvas-surface.test.ts
  ---
  duration_ms: 352.59687
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/canvas/effect/render-canvas-surface.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/canvas/helper/calculate-viewport-transform.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488911:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488911:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488911:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488911:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/canvas/helper/calculate-viewport-transform.test.ts
not ok 50 - test/unit/canvas/helper/calculate-viewport-transform.test.ts
  ---
  duration_ms: 340.729309
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/canvas/helper/calculate-viewport-transform.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/card/controller/edit-card-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488915:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488915:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488915:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658488915:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/card/controller/edit-card-controller.test.ts
not ok 51 - test/unit/card/controller/edit-card-controller.test.ts
  ---
  duration_ms: 300.510481
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/card/controller/edit-card-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/card/effect/render-card-layer.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489034:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489034:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489034:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489034:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/card/effect/render-card-layer.test.ts
not ok 52 - test/unit/card/effect/render-card-layer.test.ts
  ---
  duration_ms: 375.465944
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/card/effect/render-card-layer.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: resize-selected-card mutates selected card geometry from the active handle
ok 170 - resize-selected-card mutates selected card geometry from the active handle
  ---
  duration_ms: 42.19305
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/card/helper/parse-card-markdown.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489031:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489031:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489031:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489031:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/card/helper/parse-card-markdown.test.ts
not ok 54 - test/unit/card/helper/parse-card-markdown.test.ts
  ---
  duration_ms: 315.198386
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/card/helper/parse-card-markdown.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: resolve-card-y-overlap compacts selected cards inside each visual column
ok 172 - resolve-card-y-overlap compacts selected cards inside each visual column
  ---
  duration_ms: 13.928996
  type: 'test'
  ...
# Subtest: resolve-card-y-overlap keeps adjacent non-overlapping columns aligned
ok 173 - resolve-card-y-overlap keeps adjacent non-overlapping columns aligned
  ---
  duration_ms: 0.402984
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/gesture/controller/handle-canvas-gesture-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489026:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489026:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489026:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489026:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/gesture/controller/handle-canvas-gesture-controller.test.ts
not ok 56 - test/unit/gesture/controller/handle-canvas-gesture-controller.test.ts
  ---
  duration_ms: 311.165606
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/gesture/controller/handle-canvas-gesture-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/gesture/helper/calculate-drag-delta.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489085:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489085:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489085:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489085:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/gesture/helper/calculate-drag-delta.test.ts
not ok 57 - test/unit/gesture/helper/calculate-drag-delta.test.ts
  ---
  duration_ms: 358.98164
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/gesture/helper/calculate-drag-delta.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/gesture/helper/derive-gesture-intent.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489083:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489083:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489083:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489083:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/gesture/helper/derive-gesture-intent.test.ts
not ok 58 - test/unit/gesture/helper/derive-gesture-intent.test.ts
  ---
  duration_ms: 353.341703
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/gesture/helper/derive-gesture-intent.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/controller/edit-group-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489077:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489077:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489077:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489077:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/group/controller/edit-group-controller.test.ts
not ok 59 - test/unit/group/controller/edit-group-controller.test.ts
  ---
  duration_ms: 347.543772
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/controller/edit-group-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/effect/render-group-layer.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489133:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489133:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489133:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489133:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/group/effect/render-group-layer.test.ts
not ok 60 - test/unit/group/effect/render-group-layer.test.ts
  ---
  duration_ms: 350.585319
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/effect/render-group-layer.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/helper/resolve-click-precedence.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489152:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489152:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489152:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489152:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/group/helper/resolve-click-precedence.test.ts
not ok 61 - test/unit/group/helper/resolve-click-precedence.test.ts
  ---
  duration_ms: 307.43399
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/helper/resolve-click-precedence.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/helper/resolve-group-membership.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489250:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489250:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489250:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489250:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/group/helper/resolve-group-membership.test.ts
not ok 62 - test/unit/group/helper/resolve-group-membership.test.ts
  ---
  duration_ms: 411.722997
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/group/helper/resolve-group-membership.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: parse-ledger-card-markdown parses common card description markdown
ok 181 - parse-ledger-card-markdown parses common card description markdown
  ---
  duration_ms: 3.424263
  type: 'test'
  ...
# Subtest: parse-ledger-card-markdown treats escaped newlines as markdown line breaks
ok 182 - parse-ledger-card-markdown treats escaped newlines as markdown line breaks
  ---
  duration_ms: 2.417829
  type: 'test'
  ...
# Subtest: parse-ledger-card-markdown parses markdown links and bare urls
ok 183 - parse-ledger-card-markdown parses markdown links and bare urls
  ---
  duration_ms: 0.705136
  type: 'test'
  ...
# Subtest: parse-ledger-card-markdown promotes adjacent standalone images into one image block
ok 184 - parse-ledger-card-markdown promotes adjacent standalone images into one image block
  ---
  duration_ms: 0.332303
  type: 'test'
  ...
# Subtest: parse-ledger-card-markdown promotes adjacent standalone html directives into one embed block
ok 185 - parse-ledger-card-markdown promotes adjacent standalone html directives into one embed block
  ---
  duration_ms: 0.320198
  type: 'test'
  ...
# Subtest: parse-ledger-card-markdown ignores html directives inside code fences
ok 186 - parse-ledger-card-markdown ignores html directives inside code fences
  ---
  duration_ms: 0.164289
  type: 'test'
  ...
# Subtest: zone attribution cache resolves largest regular-zone overlap and ignores groups
ok 187 - zone attribution cache resolves largest regular-zone overlap and ignores groups
  ---
  duration_ms: 3.210948
  type: 'test'
  ...
# Subtest: cached zone attribution applies and clears card DOM color state
ok 188 - cached zone attribution applies and clears card DOM color state
  ---
  duration_ms: 0.306697
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/navigation/controller/navigate-tab-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489214:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489214:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489214:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489214:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/navigation/controller/navigate-tab-controller.test.ts
not ok 65 - test/unit/navigation/controller/navigate-tab-controller.test.ts
  ---
  duration_ms: 345.308868
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/navigation/controller/navigate-tab-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/navigation/effect/render-tab-registry.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489301:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489301:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489301:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489301:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/navigation/effect/render-tab-registry.test.ts
not ok 66 - test/unit/navigation/effect/render-tab-registry.test.ts
  ---
  duration_ms: 401.940026
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/navigation/effect/render-tab-registry.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/navigation/helper/derive-route-state.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489264:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489264:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489264:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489264:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/navigation/helper/derive-route-state.test.ts
not ok 67 - test/unit/navigation/helper/derive-route-state.test.ts
  ---
  duration_ms: 362.783622
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/navigation/helper/derive-route-state.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: apply-persisted-geometry-to-ledger overlays local ledger node geometry before render
ok 192 - apply-persisted-geometry-to-ledger overlays local ledger node geometry before render
  ---
  duration_ms: 1.598393
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/persistence/effect/commit-ledger-edit.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489291:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489291:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489291:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489291:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/persistence/effect/commit-ledger-edit.test.ts
not ok 69 - test/unit/persistence/effect/commit-ledger-edit.test.ts
  ---
  duration_ms: 422.866606
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/persistence/effect/commit-ledger-edit.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/refresh/controller/handle-client-refresh-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489319:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489319:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489319:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489319:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/refresh/controller/handle-client-refresh-controller.test.ts
not ok 70 - test/unit/refresh/controller/handle-client-refresh-controller.test.ts
  ---
  duration_ms: 317.403931
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/refresh/controller/handle-client-refresh-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/refresh/effect/subscribe-server-refresh.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489356:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489356:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489356:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489356:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/refresh/effect/subscribe-server-refresh.test.ts
not ok 71 - test/unit/refresh/effect/subscribe-server-refresh.test.ts
  ---
  duration_ms: 464.111454
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/refresh/effect/subscribe-server-refresh.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/refresh/helper/merge-refresh-state.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489331:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489331:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489331:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489331:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/refresh/helper/merge-refresh-state.test.ts
not ok 72 - test/unit/refresh/helper/merge-refresh-state.test.ts
  ---
  duration_ms: 341.528546
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/refresh/helper/merge-refresh-state.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/controller/render-relationship-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489401:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489401:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489401:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489401:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/relationship/controller/render-relationship-controller.test.ts
not ok 73 - test/unit/relationship/controller/render-relationship-controller.test.ts
  ---
  duration_ms: 365.07593
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/controller/render-relationship-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/effect/render-relationship-overlay.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489403:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489403:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489403:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489403:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/relationship/effect/render-relationship-overlay.test.ts
not ok 74 - test/unit/relationship/effect/render-relationship-overlay.test.ts
  ---
  duration_ms: 320.425804
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/effect/render-relationship-overlay.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/helper/calculate-relationship-ports.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489466:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489466:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489466:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489466:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/relationship/helper/calculate-relationship-ports.test.ts
not ok 75 - test/unit/relationship/helper/calculate-relationship-ports.test.ts
  ---
  duration_ms: 399.130873
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/helper/calculate-relationship-ports.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/helper/route-relationship-path.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489506:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489506:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489506:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489506:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/relationship/helper/route-relationship-path.test.ts
not ok 76 - test/unit/relationship/helper/route-relationship-path.test.ts
  ---
  duration_ms: 432.221461
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/relationship/helper/route-relationship-path.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: is-gesture-control-target treats rendered links as controls
ok 201 - is-gesture-control-target treats rendered links as controls
  ---
  duration_ms: 0.992505
  type: 'test'
  ...
# Subtest: is-card-editing-keyboard-target matches card editing and contenteditable targets
ok 202 - is-card-editing-keyboard-target matches card editing and contenteditable targets
  ---
  duration_ms: 4.153398
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/calculate-relationship-ports.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489494:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489494:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489494:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489494:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/runtime/relationship/helper/calculate-relationship-ports.test.ts
not ok 79 - test/unit/runtime/relationship/helper/calculate-relationship-ports.test.ts
  ---
  duration_ms: 382.83483
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/calculate-relationship-ports.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/choose-relationship-port-sides.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489458:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489458:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489458:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489458:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/runtime/relationship/helper/choose-relationship-port-sides.test.ts
not ok 80 - test/unit/runtime/relationship/helper/choose-relationship-port-sides.test.ts
  ---
  duration_ms: 305.812803
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/choose-relationship-port-sides.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/choose-relationship-route-candidate.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489649:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489649:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489649:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489649:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/runtime/relationship/helper/choose-relationship-route-candidate.test.ts
not ok 81 - test/unit/runtime/relationship/helper/choose-relationship-route-candidate.test.ts
  ---
  duration_ms: 468.569146
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/choose-relationship-route-candidate.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/relationship-port-normal-for-side.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489571:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489571:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489571:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489571:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/runtime/relationship/helper/relationship-port-normal-for-side.test.ts
not ok 82 - test/unit/runtime/relationship/helper/relationship-port-normal-for-side.test.ts
  ---
  duration_ms: 357.031277
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/relationship-port-normal-for-side.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/relationship-port-side-options.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489621:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489621:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489621:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489621:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/runtime/relationship/helper/relationship-port-side-options.test.ts
not ok 83 - test/unit/runtime/relationship/helper/relationship-port-side-options.test.ts
  ---
  duration_ms: 407.103187
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/relationship-port-side-options.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: route-relationship-path uses Core-style cubic port-normal curves and endpoint labels
not ok 208 - route-relationship-path uses Core-style cubic port-normal curves and endpoint labels
  ---
  duration_ms: 4.090473
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/route-relationship-path.test.ts:1:68'
  failureType: 'testCodeFailure'
  error: "Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/route-relationship-path.test.ts"
  code: 'ERR_MODULE_NOT_FOUND'
  stack: |-
    Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
    packageResolve (node:internal/modules/esm/resolve:768:81)
    moduleResolve (node:internal/modules/esm/resolve:855:18)
    defaultResolve (node:internal/modules/esm/resolve:985:11)
    nextResolve (node:internal/modules/esm/hooks:748:28)
    resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:3744)
    resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:4243)
    resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:4984)
    resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:5361)
    nextResolve (node:internal/modules/esm/hooks:748:28)
  ...
# Subtest: route-relationship-path respects explicit sides and keeps tight direct handles inside the corridor
not ok 209 - route-relationship-path respects explicit sides and keeps tight direct handles inside the corridor
  ---
  duration_ms: 8.296189
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/route-relationship-path.test.ts:1:929'
  failureType: 'testCodeFailure'
  error: "Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/route-relationship-path.test.ts"
  code: 'ERR_MODULE_NOT_FOUND'
  stack: |-
    Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
    packageResolve (node:internal/modules/esm/resolve:768:81)
    moduleResolve (node:internal/modules/esm/resolve:855:18)
    defaultResolve (node:internal/modules/esm/resolve:985:11)
    nextResolve (node:internal/modules/esm/hooks:748:28)
    resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:3744)
    resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:4243)
    resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:4984)
    resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489596:2:5361)
    nextResolve (node:internal/modules/esm/hooks:748:28)
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/runtime' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/score-relationship-port-sides.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489622:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489622:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489622:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489622:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/runtime/relationship/helper/score-relationship-port-sides.test.ts
not ok 85 - test/unit/runtime/relationship/helper/score-relationship-port-sides.test.ts
  ---
  duration_ms: 365.669641
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/runtime/relationship/helper/score-relationship-port-sides.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: encode-wav-blob writes a mono PCM WAV header and samples
ok 211 - encode-wav-blob writes a mono PCM WAV header and samples
  ---
  duration_ms: 1.484633
  type: 'test'
  ...
# Subtest: format-voice-duration rolls total seconds into minutes
ok 212 - format-voice-duration rolls total seconds into minutes
  ---
  duration_ms: 1.039842
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/calculate-marquee-selection.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489651:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489651:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489651:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489651:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/selection/helper/calculate-marquee-selection.test.ts
not ok 88 - test/unit/selection/helper/calculate-marquee-selection.test.ts
  ---
  duration_ms: 292.947679
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/calculate-marquee-selection.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/clear-transient-selection.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489672:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489672:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489672:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489672:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/selection/helper/clear-transient-selection.test.ts
not ok 89 - test/unit/selection/helper/clear-transient-selection.test.ts
  ---
  duration_ms: 354.971109
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/clear-transient-selection.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/copy-selection-payload.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489742:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489742:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489742:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489742:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/selection/helper/copy-selection-payload.test.ts
not ok 90 - test/unit/selection/helper/copy-selection-payload.test.ts
  ---
  duration_ms: 385.890806
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/copy-selection-payload.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: elements-intersecting-canvas-rect returns only nodes intersecting the canvas rect
ok 216 - elements-intersecting-canvas-rect returns only nodes intersecting the canvas rect
  ---
  duration_ms: 1.928889
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/resolve-selection-target.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489713:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489713:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489713:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489713:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/selection/helper/resolve-selection-target.test.ts
not ok 92 - test/unit/selection/helper/resolve-selection-target.test.ts
  ---
  duration_ms: 327.85268
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/selection/helper/resolve-selection-target.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: selection-includes-target returns whether a target is already selected
ok 218 - selection-includes-target returns whether a target is already selected
  ---
  duration_ms: 3.181583
  type: 'test'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/thread/controller/edit-thread-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489800:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489800:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489800:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489800:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/thread/controller/edit-thread-controller.test.ts
not ok 94 - test/unit/thread/controller/edit-thread-controller.test.ts
  ---
  duration_ms: 389.963597
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/thread/controller/edit-thread-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/thread/effect/render-thread-panel.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489786:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489786:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489786:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489786:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/thread/effect/render-thread-panel.test.ts
not ok 95 - test/unit/thread/effect/render-thread-panel.test.ts
  ---
  duration_ms: 287.844754
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/thread/effect/render-thread-panel.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/thread/helper/resolve-thread-target.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489783:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489783:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489783:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489783:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/thread/helper/resolve-thread-target.test.ts
not ok 96 - test/unit/thread/helper/resolve-thread-target.test.ts
  ---
  duration_ms: 339.642929
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/thread/helper/resolve-thread-target.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/toolbox/controller/operate-toolbox-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489892:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489892:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489892:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489892:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/toolbox/controller/operate-toolbox-controller.test.ts
not ok 97 - test/unit/toolbox/controller/operate-toolbox-controller.test.ts
  ---
  duration_ms: 423.505867
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/toolbox/controller/operate-toolbox-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/toolbox/effect/render-toolbox.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489882:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489882:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489882:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489882:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/toolbox/effect/render-toolbox.test.ts
not ok 98 - test/unit/toolbox/effect/render-toolbox.test.ts
  ---
  duration_ms: 437.02911
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/toolbox/effect/render-toolbox.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/toolbox/helper/resolve-tool-mode.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489913:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489913:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489913:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489913:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/toolbox/helper/resolve-tool-mode.test.ts
not ok 99 - test/unit/toolbox/helper/resolve-tool-mode.test.ts
  ---
  duration_ms: 391.850431
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/toolbox/helper/resolve-tool-mode.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/controller/record-voice-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490049:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490049:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490049:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490049:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/voice/controller/record-voice-controller.test.ts
not ok 100 - test/unit/voice/controller/record-voice-controller.test.ts
  ---
  duration_ms: 474.869944
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/controller/record-voice-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/fill-thread-draft.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489931:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489931:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489931:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489931:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/voice/effect/fill-thread-draft.test.ts
not ok 101 - test/unit/voice/effect/fill-thread-draft.test.ts
  ---
  duration_ms: 422.034013
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/fill-thread-draft.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/render-voice-status.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490013:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490013:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490013:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490013:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/voice/effect/render-voice-status.test.ts
not ok 102 - test/unit/voice/effect/render-voice-status.test.ts
  ---
  duration_ms: 435.127299
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/render-voice-status.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/request-transcription.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490000:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490000:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490000:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490000:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/voice/effect/request-transcription.test.ts
not ok 103 - test/unit/voice/effect/request-transcription.test.ts
  ---
  duration_ms: 409.522985
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/request-transcription.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/upload-voice-audio.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489975:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489975:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489975:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658489975:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/voice/effect/upload-voice-audio.test.ts
not ok 104 - test/unit/voice/effect/upload-voice-audio.test.ts
  ---
  duration_ms: 336.013238
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/effect/upload-voice-audio.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/helper/capture-voice-audio.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490041:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490041:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490041:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490041:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/voice/helper/capture-voice-audio.test.ts
not ok 105 - test/unit/voice/helper/capture-voice-audio.test.ts
  ---
  duration_ms: 354.041894
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/helper/capture-voice-audio.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/helper/resolve-voice-session.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490035:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490035:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490035:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490035:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/voice/helper/resolve-voice-session.test.ts
not ok 106 - test/unit/voice/helper/resolve-voice-session.test.ts
  ---
  duration_ms: 333.593906
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/voice/helper/resolve-voice-session.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/controller/edit-zone-controller.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490141:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490141:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490141:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490141:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/zone/controller/edit-zone-controller.test.ts
not ok 107 - test/unit/zone/controller/edit-zone-controller.test.ts
  ---
  duration_ms: 396.028495
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/controller/edit-zone-controller.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/effect/render-zone-layer.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490042:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490042:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490042:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490042:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/zone/effect/render-zone-layer.test.ts
not ok 108 - test/unit/zone/effect/render-zone-layer.test.ts
  ---
  duration_ms: 414.672499
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/effect/render-zone-layer.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/calculate-zone-geometry.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490209:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490209:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490209:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490209:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/zone/helper/calculate-zone-geometry.test.ts
not ok 109 - test/unit/zone/helper/calculate-zone-geometry.test.ts
  ---
  duration_ms: 408.521701
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/calculate-zone-geometry.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/confirm-zone-deletion.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490199:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490199:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490199:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490199:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/zone/helper/confirm-zone-deletion.test.ts
not ok 110 - test/unit/zone/helper/confirm-zone-deletion.test.ts
  ---
  duration_ms: 392.453029
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/confirm-zone-deletion.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/resolve-zone-selection-membership.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490091:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490091:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490091:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490091:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/zone/helper/resolve-zone-selection-membership.test.ts
not ok 111 - test/unit/zone/helper/resolve-zone-selection-membership.test.ts
  ---
  duration_ms: 291.686017
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/resolve-zone-selection-membership.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/validate-zone-draft.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490270:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490270:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490270:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490270:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/unit/zone/helper/validate-zone-draft.test.ts
not ok 112 - test/unit/zone/helper/validate-zone-draft.test.ts
  ---
  duration_ms: 374.110939
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/unit/zone/helper/validate-zone-draft.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/voice/voice-thread.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490248:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490248:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490248:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490248:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/voice/voice-thread.integration.test.ts
not ok 113 - test/voice/voice-thread.integration.test.ts
  ---
  duration_ms: 333.491651
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/voice/voice-thread.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/zone/zone-lifecycle.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490186:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490186:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490186:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490186:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/zone/zone-lifecycle.integration.test.ts
not ok 114 - test/zone/zone-lifecycle.integration.test.ts
  ---
  duration_ms: 290.030929
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/zone/zone-lifecycle.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# node:internal/modules/run_main:123
#     triggerUncaughtException(
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontend/telemetry' imported from /home/jbb/dev/EditorBP/decision-os/frontend/test/zone/zone-model.integration.test.ts
#     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
#     at packageResolve (node:internal/modules/esm/resolve:768:81)
#     at moduleResolve (node:internal/modules/esm/resolve:855:18)
#     at defaultResolve (node:internal/modules/esm/resolve:985:11)
#     at nextResolve (node:internal/modules/esm/hooks:748:28)
#     at resolveBase (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490256:2:3744)
#     at resolveDirectory (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490256:2:4243)
#     at resolveTsPaths (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490256:2:4984)
#     at resolve (file:///home/jbb/dev/EditorBP/decision-os/frontend/node_modules/tsx/dist/esm/index.mjs?1783658490256:2:5361)
#     at nextResolve (node:internal/modules/esm/hooks:748:28) {
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v22.22.2
# Subtest: test/zone/zone-model.integration.test.ts
not ok 115 - test/zone/zone-model.integration.test.ts
  ---
  duration_ms: 323.01997
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/zone/zone-model.integration.test.ts:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..240
# tests 240
# suites 0
# pass 167
# fail 73
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2708.574964
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-51","timestamp":"2026-07-10T04:41:37.015Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"51","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_27"} -->

The focused behavior remains green (`28/28`). A broader frontend run is blocked by a pre-existing test-runner alias failure (`@frontend/telemetry` cannot resolve in 73 files); the run still executed 167 tests. I’m isolating every source-inspection test touched by the refactor so genuine regressions are separated from that repository-level runner issue.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-52","timestamp":"2026-07-10T04:41:37.015Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"52","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_28","codexTool":"/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-53","timestamp":"2026-07-10T04:41:39.016Z","status":"failed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"53","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_28","codexTool":"/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'","codexExitCode":"1"} -->

**Tool call** `/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'`
Status: failed
Exit code: 1

````text
# Subtest: browser inputs route ledger commands through runtime controllers before server effects
not ok 1 - browser inputs route ledger commands through runtime controllers before server effects
  ---
  duration_ms: 9.942648
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/input-controller-routing.integration.test.ts:1:357'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /export function renderCanvasControlOverlay\(\): void \{\s*if \(controlsDisabled\(\)\) \{[\s\S]*clearCanvasControlOverlay\(\);[\s\S]*return;/. Input:
    
    '/**\n' +
      ' * WHAT: Renders contextual card, zone, and group controls for hovered and selected canvas targets.\n' +
      ' * WHY: Control placement must follow current geometry and may use an explicit gesture selection.\n' +
      ' */\n' +
      "import { canvas, content, controlOverlay as initialControlOverlay } from '../../dom.js';\n" +
      "import { renderLedgerCardDeleteButton } from '../../ledger/component/render-ledger-card-delete-button.js';\n" +
      "import { renderLedgerCardStatusButton } from '../../ledger/component/render-ledger-card-status-button.js';\n" +
      "import { state, type SelectionState } from '../../state.js';\n" +
      '\n' +
      'type ControlTarget = {\n' +
      "  kind: 'card' | 'zone' | 'group';\n" +
      '  id: string;\n' +
      '};\n' +
      '\n' +
      'let hoveredTarget: ControlTarget | null = null;\n' +
      'let hoverBindingInitialized = false;\n' +
      'const removalTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();\n' +
      'const controlFadeDurationMs = 160;\n' +
      '\n' +
      'function targetKey(target: ControlTarget | null): string {\n' +
      "  return target ? `${target.kind}:${target.id}` : '';\n" +
      '}\n' +
      '\n' +
      'function sameTarget(a: ControlTarget | null, b: ControlTarget | null): boolean {\n' +
      '  return targetKey(a) === targetKey(b);\n' +
      '}\n' +
      '\n' +
      'function resolveControlOverlay(): HTMLElement | null {\n' +
      '  if (initialControlOverlay?.isConnected) return initialControlOverlay;\n' +
      "  if (!canvas || typeof canvas.querySelector !== 'function') return null;\n" +
      "  const existing = canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;\n" +
      '  if (existing) return existing;\n' +
      "  const overlay = document.createElement('div');\n" +
      "  overlay.className = 'canvas-control-overlay';\n" +
      '  canvas.append(overlay);\n' +
      '  return overlay;\n' +
      '}\n' +
      '\n' +
      'function existingControlOverlay(): HTMLElement | null {\n' +
      '  if (initialControlOverlay?.isConnected) return initialControlOverlay;\n' +
      "  if (!canvas || typeof canvas.querySelector !== 'function') return null;\n" +
      "  return canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;\n" +
      '}\n' +
      '\n' +
      'function clearCanvasControlOverlay(): void {\n' +
      '  hoveredTarget = null;\n' +
      '  existingControlOverlay()?.replaceChildren();\n' +
      '}\n' +
      '\n' +
      'export function hideCanvasControlOverlay(): void {\n' +
      '  existingControlOverlay()?.replaceChildren();\n' +
      '}\n' +
      '\n' +
      'function controlsDisabled(): boolean {\n' +
      "  return Boolean(canvas?.classList?.contains('low-detail'));\n" +
      '}\n' +
      '\n' +
      'function targetFromElement(element: EventTarget | null): ControlTarget | null {\n' +
      '  const node = element as HTMLElement | null;\n' +
      "  const control = node?.closest?.('.canvas-control') as HTMLElement | null;\n" +
      "  if (control?.dataset.cardId) return { kind: 'card', id: control.dataset.cardId };\n" +
      "  if (control?.dataset.zoneId) return { kind: 'zone', id: control.dataset.zoneId };\n" +
      "  if (control?.dataset.groupId) return { kind: 'group', id: control.dataset.groupId };\n" +
      '\n' +
      "  const canvasNode = node?.closest?.('.canvas-content > .card[data-card-id], .canvas-content > .zone[data-zone-id], .canvas-content > .zone[data-group-id]') as HTMLElement | null;\n" +
      "  if (canvasNode?.dataset.cardId) return { kind: 'card', id: canvasNode.dataset.cardId };\n" +
      "  if (canvasNode?.dataset.zoneId) return { kind: 'zone', id: canvasNode.dataset.zoneId };\n" +
      "  if (canvasNode?.dataset.groupId) return { kind: 'group', id: canvasNode.dataset.groupId };\n" +
      '  return null;\n' +
      '}\n' +
      '\n' +
      'function sourceElement(target: ControlTarget): HTMLElement | null {\n' +
      '  if (!content) return null;\n' +
      '  if (target.kind === \'card\') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;\n' +
      '  if (target.kind === \'zone\') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;\n' +
      '  return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;\n' +
      '}\n' +
      '\n' +
      'function selectedTargets(selection: Partial<SelectionState>): ControlTarget[] {\n' +
      '  const targets: ControlTarget[] = [];\n' +
      "  for (const id of new Set(selection.zoneIds ?? [])) targets.push({ kind: 'zone', id });\n" +
      "  for (const id of new Set(selection.groupIds ?? [])) targets.push({ kind: 'group', id });\n" +
      '  return targets;\n' +
      '}\n' +
      '\n' +
      'function visibleTargets(selection: Partial<SelectionState>): ControlTarget[] {\n' +
      '  const byKey = new Map<string, ControlTarget>();\n' +
      '  for (const target of selectedTargets(selection)) byKey.set(targetKey(target), target);\n' +
      '  if (hoveredTarget) byKey.set(targetKey(hoveredTarget), hoveredTarget);\n' +
      '  return [...byKey.values()];\n' +
      '}\n' +
      '\n' +
      'function nextFrame(callback: () => void): void {\n' +
      "  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);\n" +
      '  else setTimeout(callback, 0);\n' +
      '}\n' +
      '\n' +
      'function cancelScheduledRemoval(control: HTMLElement): void {\n' +
      '  const timer = removalTimers.get(control);\n' +
      '  if (timer) clearTimeout(timer);\n' +
      '  removalTimers.delete(control);\n' +
      '}\n' +
      '\n' +
      'function scheduleRemoval(control: HTMLElement): void {\n' +
      '  if (removalTimers.has(control)) return;\n' +
      "  control.classList.remove('is-visible');\n" +
      '  const timer = setTimeout(() => {\n' +
      "    if (!control.classList.contains('is-visible')) control.remove();\n" +
      '    removalTimers.delete(control);\n' +
      '  }, controlFadeDurationMs);\n' +
      '  removalTimers.set(control, timer);\n' +
      '}\n' +
      '\n' +
      "function placeControlGroup(group: HTMLElement, source: HTMLElement, align: 'left' | 'right', yOffset = 6): boolean {\n" +
      '  const canvasRect = canvas.getBoundingClientRect();\n' +
      '  const rect = source.getBoundingClientRect();\n' +
      '  if (rect.right < canvasRect.left || rect.left > canvasRect.right || rect.bottom < canvasRect.top || rect.top > canvasRect.bottom) return false;\n' +
      "  const x = align === 'right' ? rect.right - canvasRect.left - 6 : rect.left - canvasRect.left + 6;\n" +
      '  const y = rect.top - canvasRect.top + yOffset;\n' +
      '  group.style.left = `${Math.round(x)}px`;\n' +
      '  group.style.top = `${Math.round(y)}px`;\n' +
      "  group.style.transform = align === 'right' ? 'translateX(-100%)' : 'none';\n" +
      '  return true;\n' +
      '}\n' +
      '\n' +
      'function syncCardControls(group: HTMLElement, card: HTMLElement): boolean {\n' +
      "  if (!card.classList.contains('ledger-node')) return false;\n" +
      "  const cardId = card.dataset.cardId ?? '';\n" +
      '  if (!cardId) return false;\n' +
      "  const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';\n" +
      "  const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;\n" +
      "  const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();\n" +
      "  group.className = 'canvas-control canvas-control--card';\n" +
      '  group.dataset.cardId = cardId;\n' +
      "  if (cardZoneColor) group.style.setProperty('--card-zone-color', cardZoneColor);\n" +
      "  else group.style.removeProperty('--card-zone-color');\n" +
      "  const edit = document.createElement('button');\n" +
      "  edit.className = 'icon-button terminal-button terminal-button--compact';\n" +
      "  edit.type = 'button';\n" +
      "  edit.dataset.action = 'edit-card-title';\n" +
      '  edit.dataset.cardId = cardId;\n' +
      "  edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';\n" +
      '  edit.ariaLabel = edit.title;\n' +
      "  edit.textContent = '✎';\n" +
      "  const editBody = document.createElement('button');\n" +
      "  editBody.className = 'ledger-card-edit-toggle terminal-button terminal-button--compact';\n" +
      "  editBody.type = 'button';\n" +
      "  editBody.dataset.action = 'edit-card-description';\n" +
      '  editBody.dataset.cardId = cardId;\n' +
      "  editBody.title = 'Edit card content';\n" +
      "  editBody.setAttribute('aria-label', editBody.title);\n" +
      "  editBody.textContent = 'edit';\n" +
      "  const skill = document.createElement('button');\n" +
      "  skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';\n" +
      "  skill.type = 'button';\n" +
      "  skill.dataset.action = 'open-card-skill-modal';\n" +
      '  skill.dataset.cardId = cardId;\n' +
      "  skill.title = 'Run Codex skill';\n" +
      "  skill.setAttribute('aria-label', skill.title);\n" +
      "  skill.textContent = 'fx';\n" +
      '  const controls = card.dataset.targetLedgerId\n' +
      '    ? [edit, renderLedgerCardDeleteButton(cardId)]\n' +
      '    : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];\n' +
      '  group.replaceChildren(...controls);\n' +
      "  return placeControlGroup(group, card, 'right');\n" +
      '}\n' +
      '\n' +
      "function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' | 'group'): boolean {\n" +
      "  const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';\n" +
      '  if (!id) return false;\n' +
      '  group.className = `canvas-control canvas-control--${kind}`;\n' +
      "  if (kind === 'zone') group.dataset.zoneId = id;\n" +
      '  else group.dataset.groupId = id;\n' +
      '\n' +
      "  const edit = document.createElement('button');\n" +
      "  edit.className = 'icon-button terminal-button terminal-button--compact';\n" +
      "  edit.type = 'button';\n" +
      "  edit.dataset.action = 'edit-zone';\n" +
      "  if (kind === 'zone') edit.dataset.zoneId = id;\n" +
      '  else edit.dataset.groupId = id;\n' +
      "  edit.title = kind === 'zone' ? 'Edit zone name' : 'Edit group name';\n" +
      '  edit.ariaLabel = edit.title;\n' +
      "  edit.textContent = '✎';\n" +
      '  const controls: HTMLElement[] = [edit];\n' +
      '\n' +
      "  if (kind === 'zone') {\n" +
      "    const color = document.createElement('input');\n" +
      "    color.type = 'color';\n" +
      "    color.className = 'zone-color-edit';\n" +
      "    color.dataset.action = 'edit-zone-color';\n" +
      '    color.dataset.zoneId = id;\n' +
      "    color.ariaLabel = 'Edit zone color';\n" +
      "    color.value = zone.style.getPropertyValue('--zone-color').trim() || '#55b8ff';\n" +
      '    controls.push(color);\n' +
      "  } else if (zone.classList.contains('ledger-node')) {\n" +
      "    const deleteButton = document.createElement('button');\n" +
      "    deleteButton.className = 'ledger-group-delete terminal-button terminal-button--compact';\n" +
      "    deleteButton.type = 'button';\n" +
      "    deleteButton.dataset.action = 'confirm-delete-group';\n" +
      '    deleteButton.dataset.groupId = id;\n' +
      "    deleteButton.title = 'Delete group';\n" +
      "    deleteButton.setAttribute('aria-label', 'Delete group');\n" +
      "    deleteButton.textContent = 'X';\n" +
      '    controls.push(deleteButton);\n' +
      '  }\n' +
      '\n' +
      '  group.replaceChildren(...controls);\n' +
      "  return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);\n" +
      '}\n' +
      '\n' +
      'export function renderCanvasControlOverlay(selection: Partial<SelectionState> = state.selection): void {\n' +
      '  if (controlsDisabled()) {\n' +
      '    clearCanvasControlOverlay();\n' +
      '    return;\n' +
      '  }\n' +
      '  const overlay = resolveControlOverlay();\n' +
      '  if (!overlay || !canvas || !content) return;\n' +
      '  const activeKeys = new Set<string>();\n' +
      '  for (const target of visibleTargets(selection)) {\n' +
      '    const source = sourceEl'... 1885 more characters
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    /**
     * WHAT: Renders contextual card, zone, and group controls for hovered and selected canvas targets.
     * WHY: Control placement must follow current geometry and may use an explicit gesture selection.
     */
    import { canvas, content, controlOverlay as initialControlOverlay } from '../../dom.js';
    import { renderLedgerCardDeleteButton } from '../../ledger/component/render-ledger-card-delete-button.js';
    import { renderLedgerCardStatusButton } from '../../ledger/component/render-ledger-card-status-button.js';
    import { state, type SelectionState } from '../../state.js';
    
    type ControlTarget = {
      kind: 'card' | 'zone' | 'group';
      id: string;
    };
    
    let hoveredTarget: ControlTarget | null = null;
    let hoverBindingInitialized = false;
    const removalTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
    const controlFadeDurationMs = 160;
    
    function targetKey(target: ControlTarget | null): string {
      return target ? `${target.kind}:${target.id}` : '';
    }
    
    function sameTarget(a: ControlTarget | null, b: ControlTarget | null): boolean {
      return targetKey(a) === targetKey(b);
    }
    
    function resolveControlOverlay(): HTMLElement | null {
      if (initialControlOverlay?.isConnected) return initialControlOverlay;
      if (!canvas || typeof canvas.querySelector !== 'function') return null;
      const existing = canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
      if (existing) return existing;
      const overlay = document.createElement('div');
      overlay.className = 'canvas-control-overlay';
      canvas.append(overlay);
      return overlay;
    }
    
    function existingControlOverlay(): HTMLElement | null {
      if (initialControlOverlay?.isConnected) return initialControlOverlay;
      if (!canvas || typeof canvas.querySelector !== 'function') return null;
      return canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
    }
    
    function clearCanvasControlOverlay(): void {
      hoveredTarget = null;
      existingControlOverlay()?.replaceChildren();
    }
    
    export function hideCanvasControlOverlay(): void {
      existingControlOverlay()?.replaceChildren();
    }
    
    function controlsDisabled(): boolean {
      return Boolean(canvas?.classList?.contains('low-detail'));
    }
    
    function targetFromElement(element: EventTarget | null): ControlTarget | null {
      const node = element as HTMLElement | null;
      const control = node?.closest?.('.canvas-control') as HTMLElement | null;
      if (control?.dataset.cardId) return { kind: 'card', id: control.dataset.cardId };
      if (control?.dataset.zoneId) return { kind: 'zone', id: control.dataset.zoneId };
      if (control?.dataset.groupId) return { kind: 'group', id: control.dataset.groupId };
    
      const canvasNode = node?.closest?.('.canvas-content > .card[data-card-id], .canvas-content > .zone[data-zone-id], .canvas-content > .zone[data-group-id]') as HTMLElement | null;
      if (canvasNode?.dataset.cardId) return { kind: 'card', id: canvasNode.dataset.cardId };
      if (canvasNode?.dataset.zoneId) return { kind: 'zone', id: canvasNode.dataset.zoneId };
      if (canvasNode?.dataset.groupId) return { kind: 'group', id: canvasNode.dataset.groupId };
      return null;
    }
    
    function sourceElement(target: ControlTarget): HTMLElement | null {
      if (!content) return null;
      if (target.kind === 'card') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
      if (target.kind === 'zone') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
      return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
    }
    
    function selectedTargets(selection: Partial<SelectionState>): ControlTarget[] {
      const targets: ControlTarget[] = [];
      for (const id of new Set(selection.zoneIds ?? [])) targets.push({ kind: 'zone', id });
      for (const id of new Set(selection.groupIds ?? [])) targets.push({ kind: 'group', id });
      return targets;
    }
    
    function visibleTargets(selection: Partial<SelectionState>): ControlTarget[] {
      const byKey = new Map<string, ControlTarget>();
      for (const target of selectedTargets(selection)) byKey.set(targetKey(target), target);
      if (hoveredTarget) byKey.set(targetKey(hoveredTarget), hoveredTarget);
      return [...byKey.values()];
    }
    
    function nextFrame(callback: () => void): void {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
      else setTimeout(callback, 0);
    }
    
    function cancelScheduledRemoval(control: HTMLElement): void {
      const timer = removalTimers.get(control);
      if (timer) clearTimeout(timer);
      removalTimers.delete(control);
    }
    
    function scheduleRemoval(control: HTMLElement): void {
      if (removalTimers.has(control)) return;
      control.classList.remove('is-visible');
      const timer = setTimeout(() => {
        if (!control.classList.contains('is-visible')) control.remove();
        removalTimers.delete(control);
      }, controlFadeDurationMs);
      removalTimers.set(control, timer);
    }
    
    function placeControlGroup(group: HTMLElement, source: HTMLElement, align: 'left' | 'right', yOffset = 6): boolean {
      const canvasRect = canvas.getBoundingClientRect();
      const rect = source.getBoundingClientRect();
      if (rect.right < canvasRect.left || rect.left > canvasRect.right || rect.bottom < canvasRect.top || rect.top > canvasRect.bottom) return false;
      const x = align === 'right' ? rect.right - canvasRect.left - 6 : rect.left - canvasRect.left + 6;
      const y = rect.top - canvasRect.top + yOffset;
      group.style.left = `${Math.round(x)}px`;
      group.style.top = `${Math.round(y)}px`;
      group.style.transform = align === 'right' ? 'translateX(-100%)' : 'none';
      return true;
    }
    
    function syncCardControls(group: HTMLElement, card: HTMLElement): boolean {
      if (!card.classList.contains('ledger-node')) return false;
      const cardId = card.dataset.cardId ?? '';
      if (!cardId) return false;
      const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';
      const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;
      const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();
      group.className = 'canvas-control canvas-control--card';
      group.dataset.cardId = cardId;
      if (cardZoneColor) group.style.setProperty('--card-zone-color', cardZoneColor);
      else group.style.removeProperty('--card-zone-color');
      const edit = document.createElement('button');
      edit.className = 'icon-button terminal-button terminal-button--compact';
      edit.type = 'button';
      edit.dataset.action = 'edit-card-title';
      edit.dataset.cardId = cardId;
      edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';
      edit.ariaLabel = edit.title;
      edit.textContent = '✎';
      const editBody = document.createElement('button');
      editBody.className = 'ledger-card-edit-toggle terminal-button terminal-button--compact';
      editBody.type = 'button';
      editBody.dataset.action = 'edit-card-description';
      editBody.dataset.cardId = cardId;
      editBody.title = 'Edit card content';
      editBody.setAttribute('aria-label', editBody.title);
      editBody.textContent = 'edit';
      const skill = document.createElement('button');
      skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';
      skill.type = 'button';
      skill.dataset.action = 'open-card-skill-modal';
      skill.dataset.cardId = cardId;
      skill.title = 'Run Codex skill';
      skill.setAttribute('aria-label', skill.title);
      skill.textContent = 'fx';
      const controls = card.dataset.targetLedgerId
        ? [edit, renderLedgerCardDeleteButton(cardId)]
        : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];
      group.replaceChildren(...controls);
      return placeControlGroup(group, card, 'right');
    }
    
    function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' | 'group'): boolean {
      const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';
      if (!id) return false;
      group.className = `canvas-control canvas-control--${kind}`;
      if (kind === 'zone') group.dataset.zoneId = id;
      else group.dataset.groupId = id;
    
      const edit = document.createElement('button');
      edit.className = 'icon-button terminal-button terminal-button--compact';
      edit.type = 'button';
      edit.dataset.action = 'edit-zone';
      if (kind === 'zone') edit.dataset.zoneId = id;
      else edit.dataset.groupId = id;
      edit.title = kind === 'zone' ? 'Edit zone name' : 'Edit group name';
      edit.ariaLabel = edit.title;
      edit.textContent = '✎';
      const controls: HTMLElement[] = [edit];
    
      if (kind === 'zone') {
        const color = document.createElement('input');
        color.type = 'color';
        color.className = 'zone-color-edit';
        color.dataset.action = 'edit-zone-color';
        color.dataset.zoneId = id;
        color.ariaLabel = 'Edit zone color';
        color.value = zone.style.getPropertyValue('--zone-color').trim() || '#55b8ff';
        controls.push(color);
      } else if (zone.classList.contains('ledger-node')) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'ledger-group-delete terminal-button terminal-button--compact';
        deleteButton.type = 'button';
        deleteButton.dataset.action = 'confirm-delete-group';
        deleteButton.dataset.groupId = id;
        deleteButton.title = 'Delete group';
        deleteButton.setAttribute('aria-label', 'Delete group');
        deleteButton.textContent = 'X';
        controls.push(deleteButton);
      }
    
      group.replaceChildren(...controls);
      return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);
    }
    
    export function renderCanvasControlOverlay(selection: Partial<SelectionState> = state.selection): void {
      if (controlsDisabled()) {
        clearCanvasControlOverlay();
        return;
      }
      const overlay = resolveControlOverlay();
      if (!overlay || !canvas || !content) return;
      const activeKeys = new Set<string>();
      for (const target of visibleTargets(selection)) {
        const source = sourceElement(target);
        if (!source || source.hidden || source.style.display === 'none') continue;
        const key = targetKey(target);
        let control = overlay.querySelector(`[data-control-key="${CSS.escape(key)}"]`) as HTMLElement | null;
        const isNew = !control;
        if (!control) {
          control = document.createElement('div');
          control.dataset.controlKey = key;
        }
        const visible = target.kind === 'card'
          ? syncCardControls(control, source)
          : syncZoneControls(control, source, target.kind);
        if (!visible) continue;
        activeKeys.add(key);
        cancelScheduledRemoval(control);
        if (isNew) {
          overlay.append(control);
          nextFrame(() => nextFrame(() => control?.classList.add('is-visible')));
        } else {
          control.classList.add('is-visible');
        }
      }
      for (const control of Array.from(overlay.querySelectorAll('.canvas-control')) as HTMLElement[]) {
        if (!activeKeys.has(control.dataset.controlKey ?? '')) scheduleRemoval(control);
      }
    }
    
    export function bindCanvasControlOverlayHover(): void {
      if (hoverBindingInitialized || !canvas) return;
      hoverBindingInitialized = true;
      canvas.addEventListener('mouseover', (event) => {
        if (controlsDisabled()) {
          clearCanvasControlOverlay();
          return;
        }
        const next = targetFromElement(event.target);
        if (!next || sameTarget(hoveredTarget, next)) return;
        hoveredTarget = next;
        renderCanvasControlOverlay();
      });
      canvas.addEventListener('mouseout', (event) => {
        if (controlsDisabled()) {
          clearCanvasControlOverlay();
          return;
        }
        const previous = targetFromElement(event.target);
        if (!previous) return;
        const next = targetFromElement(event.relatedTarget);
        if (sameTarget(previous, next)) return;
        if (sameTarget(previous, hoveredTarget)) {
          hoveredTarget = next;
          renderCanvasControlOverlay();
        }
      });
    }
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/input-controller-routing.integration.test.ts:289:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: ledger relationship routing uses active ledger geometry instead of card DOM measurement
ok 2 - ledger relationship routing uses active ledger geometry instead of card DOM measurement
  ---
  duration_ms: 0.843455
  type: 'test'
  ...
# Subtest: selected ledger geometry commits from active ledger state instead of DOM snapshots
ok 3 - selected ledger geometry commits from active ledger state instead of DOM snapshots
  ---
  duration_ms: 0.169152
  type: 'test'
  ...
# Subtest: direct card clicks do not preserve expanded zone selection
ok 4 - direct card clicks do not preserve expanded zone selection
  ---
  duration_ms: 0.879203
  type: 'test'
  ...
# Subtest: direct clicks still preserve ordinary selected cards for dragging
ok 5 - direct clicks still preserve ordinary selected cards for dragging
  ---
  duration_ms: 0.216433
  type: 'test'
  ...
# Subtest: shift click is the additive selection modifier
ok 6 - shift click is the additive selection modifier
  ---
  duration_ms: 0.260705
  type: 'test'
  ...
# Subtest: target selection updates selection chrome without full canvas rerender
ok 7 - target selection updates selection chrome without full canvas rerender
  ---
  duration_ms: 0.139071
  type: 'test'
  ...
# Subtest: card focus click does not enter the geometry commit or full canvas render path
not ok 8 - card focus click does not enter the geometry commit or full canvas render path
  ---
  duration_ms: 1.622518
  type: 'test'
  location: '/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/selection-direct-card-click.integration.test.ts:1:1547'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /await commitSelectedLedgerGeometry\(\)/. Input:
    
    '/**\n' +
      ' * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.\n' +
      ' * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.\n' +
      ' */\n' +
      "import { state } from '../../state.js';\n" +
      "import { canvasPoint } from '../../canvas/helper/canvas-point.js';\n" +
      "import { createCardController } from '../../card/controller/create-card-controller.js';\n" +
      "import { createZoneController } from '../../zone/controller/create-zone-controller.js';\n" +
      "import { createGroupController } from '../../group/controller/create-group-controller.js';\n" +
      "import { commitSelectedLedgerGeometry } from '../../ledger/effect/commit-selected-ledger-geometry.js';\n" +
      "import { finishPointer } from '../effect/finish-pointer.js';\n" +
      "import { persistState } from '../../persistence/effect/persist-state.js';\n" +
      "import { point } from '../helper/point.js';\n" +
      "import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';\n" +
      "import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';\n" +
      "import { selectIntersecting } from '../../selection/effect/select-intersecting.js';\n" +
      "import { selectTarget } from '../../selection/controller/select-target.js';\n" +
      "import { moveSelected } from '../../selection/effect/move-selected.js';\n" +
      "import { resizeSelectedCard } from '../../card/effect/resize-selected-card.js';\n" +
      "import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';\n" +
      "import { isClickMovement, pointerDistancePx } from '../helper/click-movement.js';\n" +
      "import { telemetry } from '../../telemetry/effect/telemetry.js';\n" +
      '\n' +
      'export async function handlePointerUp(event: PointerEvent): Promise<void> {\n' +
      '  if (!state.pointer) return;\n' +
      '  event.preventDefault();\n' +
      '  const pointerSession = state.pointer;\n' +
      '  const pointerIntent = pointerSession.intent;\n' +
      '  let releaseRendered = false;\n' +
      "  telemetry('canvas-pointer-up', { intent: pointerIntent });\n" +
      '  const releasePoint = point(event);\n' +
      '  const releaseCanvas = canvasPoint(releasePoint);\n' +
      '  const moved = pointerDistancePx(pointerSession.start, releasePoint);\n' +
      '  const isForcedPan = Boolean(pointerSession.forcedPan || pointerSession.ctrlPan);\n' +
      "  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'zone' && isClickMovement(moved)) {\n" +
      "    selectTarget('zone', pointerSession.targetId, false);\n" +
      "    telemetry('resolve-selection-target', { kind: 'zone', id: pointerSession.targetId, clickSelect: true });\n" +
      '  }\n' +
      "  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'group' && isClickMovement(moved)) {\n" +
      "    selectTarget('group', pointerSession.targetId, false);\n" +
      "    telemetry('resolve-selection-target', { kind: 'group', id: pointerSession.targetId, clickSelect: true });\n" +
      '  }\n' +
      "  if (pointerIntent === 'marquee') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      '    selectIntersecting(rect);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      "    telemetry('resolve-selection-target', { selection: state.selection });\n" +
      '  }\n' +
      "  if (pointerIntent === 'draw-card') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      '    finishPointer(event);\n' +
      '    await createCardController(rect);\n' +
      '  }\n' +
      "  if (pointerIntent === 'draw-zone') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      '    finishPointer(event);\n' +
      '    await createZoneController(rect);\n' +
      '  }\n' +
      "  if (pointerIntent === 'draw-group') {\n" +
      '    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);\n' +
      "    (document.querySelector('.marquee') as HTMLElement).hidden = true;\n" +
      '    finishPointer(event);\n' +
      '    await createGroupController(rect);\n' +
      '  }\n' +
      "  if ((pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') && isClickMovement(moved)) {\n" +
      '    finishPointer(event);\n' +
      '    persistState();\n' +
      '    return;\n' +
      '  }\n' +
      "  if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {\n" +
      '    const gestureSelection = pointerSession.selectionSnapshot ?? state.selection;\n' +
      '    const canvasDx = releaseCanvas.x - pointerSession.currentCanvas.x;\n' +
      '    const canvasDy = releaseCanvas.y - pointerSession.currentCanvas.y;\n' +
      '    if (canvasDx || canvasDy) {\n' +
      "      if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);\n" +
      "      if (pointerIntent === 'resize') {\n" +
      "        if (pointerSession.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);\n" +
      '        else resizeSelectedZone(canvasDx, canvasDy);\n' +
      '      }\n' +
      '    }\n' +
      '    finishPointer(event);\n' +
      '    releaseRendered = await commitSelectedLedgerGeometry(gestureSelection);\n' +
      '  }\n' +
      "  if (pointerIntent === 'pan' || pointerIntent === 'marquee') finishPointer(event);\n" +
      '  persistState();\n' +
      "  if (pointerIntent !== 'pan' && !releaseRendered) renderCanvasSurface();\n" +
      '}\n'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    /**
     * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.
     * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.
     */
    import { state } from '../../state.js';
    import { canvasPoint } from '../../canvas/helper/canvas-point.js';
    import { createCardController } from '../../card/controller/create-card-controller.js';
    import { createZoneController } from '../../zone/controller/create-zone-controller.js';
    import { createGroupController } from '../../group/controller/create-group-controller.js';
    import { commitSelectedLedgerGeometry } from '../../ledger/effect/commit-selected-ledger-geometry.js';
    import { finishPointer } from '../effect/finish-pointer.js';
    import { persistState } from '../../persistence/effect/persist-state.js';
    import { point } from '../helper/point.js';
    import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';
    import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
    import { selectIntersecting } from '../../selection/effect/select-intersecting.js';
    import { selectTarget } from '../../selection/controller/select-target.js';
    import { moveSelected } from '../../selection/effect/move-selected.js';
    import { resizeSelectedCard } from '../../card/effect/resize-selected-card.js';
    import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';
    import { isClickMovement, pointerDistancePx } from '../helper/click-movement.js';
    import { telemetry } from '../../telemetry/effect/telemetry.js';
    
    export async function handlePointerUp(event: PointerEvent): Promise<void> {
      if (!state.pointer) return;
      event.preventDefault();
      const pointerSession = state.pointer;
      const pointerIntent = pointerSession.intent;
      let releaseRendered = false;
      telemetry('canvas-pointer-up', { intent: pointerIntent });
      const releasePoint = point(event);
      const releaseCanvas = canvasPoint(releasePoint);
      const moved = pointerDistancePx(pointerSession.start, releasePoint);
      const isForcedPan = Boolean(pointerSession.forcedPan || pointerSession.ctrlPan);
      if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'zone' && isClickMovement(moved)) {
        selectTarget('zone', pointerSession.targetId, false);
        telemetry('resolve-selection-target', { kind: 'zone', id: pointerSession.targetId, clickSelect: true });
      }
      if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'group' && isClickMovement(moved)) {
        selectTarget('group', pointerSession.targetId, false);
        telemetry('resolve-selection-target', { kind: 'group', id: pointerSession.targetId, clickSelect: true });
      }
      if (pointerIntent === 'marquee') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        selectIntersecting(rect);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        telemetry('resolve-selection-target', { selection: state.selection });
      }
      if (pointerIntent === 'draw-card') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        finishPointer(event);
        await createCardController(rect);
      }
      if (pointerIntent === 'draw-zone') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        finishPointer(event);
        await createZoneController(rect);
      }
      if (pointerIntent === 'draw-group') {
        const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
        (document.querySelector('.marquee') as HTMLElement).hidden = true;
        finishPointer(event);
        await createGroupController(rect);
      }
      if ((pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') && isClickMovement(moved)) {
        finishPointer(event);
        persistState();
        return;
      }
      if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {
        const gestureSelection = pointerSession.selectionSnapshot ?? state.selection;
        const canvasDx = releaseCanvas.x - pointerSession.currentCanvas.x;
        const canvasDy = releaseCanvas.y - pointerSession.currentCanvas.y;
        if (canvasDx || canvasDy) {
          if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);
          if (pointerIntent === 'resize') {
            if (pointerSession.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);
            else resizeSelectedZone(canvasDx, canvasDy);
          }
        }
        finishPointer(event);
        releaseRendered = await commitSelectedLedgerGeometry(gestureSelection);
      }
      if (pointerIntent === 'pan' || pointerIntent === 'marquee') finishPointer(event);
      persistState();
      if (pointerIntent !== 'pan' && !releaseRendered) renderCanvasSurface();
    }
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/selection-direct-card-click.integration.test.ts:44:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: zone labels render through an overlay above cards instead of the zone stacking context
ok 9 - zone labels render through an overlay above cards instead of the zone stacking context
  ---
  duration_ms: 1.311402
  type: 'test'
  ...
# Subtest: regular zones keep only their inner line shadow
ok 10 - regular zones keep only their inner line shadow
  ---
  duration_ms: 0.264302
  type: 'test'
  ...
# Subtest: resize-selected-card mutates selected card geometry from the active handle
ok 11 - resize-selected-card mutates selected card geometry from the active handle
  ---
  duration_ms: 18.123633
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 9
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 183.10533
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-54","timestamp":"2026-07-10T04:41:41.014Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"54","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_29","codexTool":"/usr/bin/zsh -lc \"sed -n '260,305p' frontend/test/runtime/input-controller-routing.integration.test.ts\nsed -n '30,52p' frontend/test/runtime/selection-direct-card-click.integration.test.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '260,305p' frontend/test/runtime/input-controller-routing.integration.test.ts
sed -n '30,52p' frontend/test/runtime/selection-direct-card-click.integration.test.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-55","timestamp":"2026-07-10T04:41:41.014Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"55","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_29","codexTool":"/usr/bin/zsh -lc \"sed -n '260,305p' frontend/test/runtime/input-controller-routing.integration.test.ts\nsed -n '30,52p' frontend/test/runtime/selection-direct-card-click.integration.test.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '260,305p' frontend/test/runtime/input-controller-routing.integration.test.ts
sed -n '30,52p' frontend/test/runtime/selection-direct-card-click.integration.test.ts"`
Status: completed
Exit code: 0

````text
  assert.match(cardDetailSkillRunPoller, /requestCardSkillRunContinue\(\{ ledgerId: poller\.ledgerId, cardId: poller\.cardId, runId: poller\.runId, traceId, codexModel, codexEffort, newSession \}\)/);
  assert.match(cardDetailSkillRunPoller, /function bindNewSessionButton\(poller: Poller\): void \{[\s\S]*void continueRun\(poller, true\);[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /function bindCancelButton\(poller: Poller\): void \{[\s\S]*void cancelRun\(poller\);[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /requestCardSkillRunCancel\(\{ ledgerId: poller\.ledgerId, cardId: poller\.cardId, runId: poller\.runId \}\)/);
  assert.match(cardDetailSkillRunPoller, /setCancelButtonVisible\(element: HTMLElement, visible: boolean\)/);
  assert.match(cardDetailSkillRunPoller, /requestAnimationFrame/);
  assert.match(cardDetailSkillRunPoller, /now - poller\.lastClockPaintMs >= 33/);
  assert.match(cardDetailSkillRunPoller, /terminalSummaries\.set\(key, summary\)/);
  assert.match(cardDetailSkillRunPoller, /export function resumeExternallyStartedCardSkillRun/);
  assert.match(cardDetailSkillRunPoller, /terminalSummaries\.delete\(key\)/);
  assert.match(cardDetailSkillRunPoller, /String\(minutes\)\.padStart\(2, '0'\)/);
  assert.match(cardDetailSkillRunPoller, /Turn Completed in \$\{durationLabel\(summary\.elapsedMs\)\}/);
  assert.match(cardDetailSkillRunPoller, /startedAtMs: number/);
  assert.match(cardDetailSkillRunPoller, /function removeTimer\(element: HTMLElement\): void \{[\s\S]*timer\.hidden = true;[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /if \(!summary\.ok\) \{[\s\S]*removeTimer\(poller\.element\);[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /if \(summary\.status === 'running'\) \{[\s\S]*showTimer\(element\);[\s\S]*setCancelButtonVisible\(element, true\);[\s\S]*setContinueButtonVisible\(element, false\);[\s\S]*\}/);
  assert.doesNotMatch(cardDetailSkillRunPoller, /setInterval/);
  assert.match(cardDetailSkillRunPoller, /schedulePoll\(poller, 0\)/);
  assert.match(cardDetailSkillRunPoller, /summary\.status === 'running'/);
  assert.match(cardDetailSkillRunPoller, /async function continueRun\(poller: Poller, newSession: boolean\): Promise<void> \{[\s\S]*paintExternallyStartedRun\(poller,[\s\S]*requestCardSkillRunContinue/);
  assert.match(cardDetailSkillRunPoller, /function paintExternallyStartedRun\(poller: Poller, latestLabel = 'Continuing session'\): void \{[\s\S]*poller\.startedAtMs = Date\.now\(\);[\s\S]*poller\.element\.dataset\.runStatus = 'running';/);
  assert.match(ledgerContentEvents, /resumeExternallyStartedCardSkillRun/);
  assert.match(ledgerContentEvents, /reason\.startsWith\('codex-'\)/);
  assert.match(ledgerContentEvents, /reason\.endsWith\('-started'\)/);
  assert.match(threadNotes, /codexNoteClass\(note\)/);
  assert.match(threadNotes, /is-codex-run-event/);
  assert.doesNotMatch(controlOverlay, /selection\.cardIds/);
  assert.match(controlOverlay, /export function hideCanvasControlOverlay\(\): void \{[\s\S]*existingControlOverlay\(\)\?\.replaceChildren\(\);[\s\S]*\}/);
  assert.match(controlOverlay, /function controlsDisabled\(\): boolean \{[\s\S]*classList\?\.contains\('low-detail'\)/);
  assert.match(controlOverlay, /export function renderCanvasControlOverlay\(\): void \{\s*if \(controlsDisabled\(\)\) \{[\s\S]*clearCanvasControlOverlay\(\);[\s\S]*return;/);
  assert.match(controlOverlay, /canvas\.addEventListener\('mouseover', \(event\) => \{\s*if \(controlsDisabled\(\)\) \{[\s\S]*clearCanvasControlOverlay\(\);[\s\S]*return;/);
  assert.match(controlOverlay, /if \(hoveredTarget\) byKey\.set\(targetKey\(hoveredTarget\), hoveredTarget\)/);
  assert.match(controlOverlay, /deleteButton\.dataset\.action = 'confirm-delete-group'/);
  assert.match(controlOverlay, /edit\.dataset\.zoneId = id/);
  assert.match(controlOverlay, /color\.dataset\.zoneId = id/);
  assert.match(canvasLayerCss, /\.canvas-control-overlay\s*{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/s);
  assert.match(canvasLayerCss, /\.canvas-control\s*{[^}]*position:\s*absolute;[^}]*opacity:\s*0;[^}]*transition:\s*opacity 140ms ease;/s);
  assert.match(canvasLayerCss, /\.canvas-control\.is-visible\s*{[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;/s);
  assert.match(canvasLayerCss, /\.canvas-control \.terminal-button,[\s\S]*transition:\s*none;/);
  assert.match(canvasLayerCss, /\.canvas-control \.ledger-card-edit-toggle\s*{[^}]*min-width:\s*38px;[^}]*text-transform:\s*uppercase;/s);
  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-overview-title\s*{[^}]*padding:\s*4px 6px 0;/s);
  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-detail-layer\s*{[^}]*content-visibility:\s*hidden;/s);
  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/s);
  assert.doesNotMatch(canvasLayerCss, /\.canvas\.low-detail \.ledger-card-status-toggle/);
  assert.match(objectsCss, /\.codex-run-widget\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(108px, max-content\);[^}]*height:\s*112px;[^}]*overflow:\s*hidden;/s);
  assert.match(objectsCss, /\.codex-run-metadata\s*{[^}]*flex-wrap:\s*nowrap;[^}]*overflow:\s*hidden;/s);
  const selectTarget = readFileSync(new URL('frontend/src/runtime/selection/controller/select-target.ts', root), 'utf8');
  assert.match(selectTarget, /renderSelectionState\(\)/);
  assert.doesNotMatch(selectTarget, /renderCanvasSurface/);
  assert.doesNotMatch(selectTarget, /renderLedgerSurface/);
});

test('card focus click does not enter the geometry commit or full canvas render path', () => {
  const pointerUp = readFileSync(new URL('frontend/src/runtime/gesture/controller/handle-pointer-up.ts', root), 'utf8');
  const pointerMove = readFileSync(new URL('frontend/src/runtime/gesture/controller/handle-pointer-move.ts', root), 'utf8');
  const clickReturnIndex = pointerUp.indexOf('isClickMovement(moved)');
  const geometryCommitIndex = pointerUp.indexOf('await commitSelectedLedgerGeometry()');
  assert.match(pointerUp, /pointerIntent === 'drag' \|\| pointerIntent === 'group' \|\| pointerIntent === 'resize'/);
  assert.match(pointerUp, /isClickMovement\(moved\)/);
  assert.match(pointerUp, /finishPointer\(event\);[\s\S]*persistState\(\);[\s\S]*return;/);
  assert.match(pointerUp, /await commitSelectedLedgerGeometry\(\)/);
  assert.ok(clickReturnIndex > -1);
  assert.ok(geometryCommitIndex > clickReturnIndex);
  assert.match(pointerMove, /isGeometryGesture && isClickMovement\(pointerDistancePx\(state\.pointer\.start, pointer\)\)/);
});
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-56","timestamp":"2026-07-10T04:41:47.015Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"56","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_30","codexTool":"/usr/bin/zsh -lc \"sed -n '1,8p' frontend/test/runtime/input-controller-routing.integration.test.ts\nsed -n '1,8p' frontend/test/runtime/selection-direct-card-click.integration.test.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,8p' frontend/test/runtime/input-controller-routing.integration.test.ts
sed -n '1,8p' frontend/test/runtime/selection-direct-card-click.integration.test.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-57","timestamp":"2026-07-10T04:41:47.015Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"57","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_30","codexTool":"/usr/bin/zsh -lc \"sed -n '1,8p' frontend/test/runtime/input-controller-routing.integration.test.ts\nsed -n '1,8p' frontend/test/runtime/selection-direct-card-click.integration.test.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,8p' frontend/test/runtime/input-controller-routing.integration.test.ts
sed -n '1,8p' frontend/test/runtime/selection-direct-card-click.integration.test.ts"`
Status: completed
Exit code: 0

````text
/**
 * WHAT: Static integration checks for browser command routing and canvas-control CSS.
 * WHY: Input and rendering affordances must keep using runtime controllers instead of ad hoc effects.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * WHAT: Runtime tests for direct card clicks after zone-expanded selection.
 * WHY: Card targeting must not stay stuck behind the previous zone selection.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldPreservePointerSelection } from '../../src/runtime/selection/helper/should-preserve-pointer-selection.js';
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-58","timestamp":"2026-07-10T04:41:53.015Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"58","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_31"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/input-controller-routing.integration.test.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/selection-direct-card-click.integration.test.ts: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-59","timestamp":"2026-07-10T04:41:53.015Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"59","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_31"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/input-controller-routing.integration.test.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/test/runtime/selection-direct-card-click.integration.test.ts: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-60","timestamp":"2026-07-10T04:41:57.015Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"60","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_32","codexTool":"/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-61","timestamp":"2026-07-10T04:41:57.015Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"61","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_32","codexTool":"/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'cd frontend && node --test --import tsx test/runtime/input-controller-routing.integration.test.ts test/runtime/relationship-ledger-geometry-performance.integration.test.ts test/runtime/zone-label-overlay.integration.test.ts test/runtime/selection-direct-card-click.integration.test.ts test/unit/card/effect/resize-selected-card.test.ts'`
Status: completed
Exit code: 0

````text
# Subtest: browser inputs route ledger commands through runtime controllers before server effects
ok 1 - browser inputs route ledger commands through runtime controllers before server effects
  ---
  duration_ms: 4.506017
  type: 'test'
  ...
# Subtest: ledger relationship routing uses active ledger geometry instead of card DOM measurement
ok 2 - ledger relationship routing uses active ledger geometry instead of card DOM measurement
  ---
  duration_ms: 0.831225
  type: 'test'
  ...
# Subtest: selected ledger geometry commits from active ledger state instead of DOM snapshots
ok 3 - selected ledger geometry commits from active ledger state instead of DOM snapshots
  ---
  duration_ms: 0.190924
  type: 'test'
  ...
# Subtest: direct card clicks do not preserve expanded zone selection
ok 4 - direct card clicks do not preserve expanded zone selection
  ---
  duration_ms: 0.679313
  type: 'test'
  ...
# Subtest: direct clicks still preserve ordinary selected cards for dragging
ok 5 - direct clicks still preserve ordinary selected cards for dragging
  ---
  duration_ms: 0.167495
  type: 'test'
  ...
# Subtest: shift click is the additive selection modifier
ok 6 - shift click is the additive selection modifier
  ---
  duration_ms: 0.227758
  type: 'test'
  ...
# Subtest: target selection updates selection chrome without full canvas rerender
ok 7 - target selection updates selection chrome without full canvas rerender
  ---
  duration_ms: 0.133535
  type: 'test'
  ...
# Subtest: card focus click does not enter the geometry commit or full canvas render path
ok 8 - card focus click does not enter the geometry commit or full canvas render path
  ---
  duration_ms: 0.340717
  type: 'test'
  ...
# Subtest: zone labels render through an overlay above cards instead of the zone stacking context
ok 9 - zone labels render through an overlay above cards instead of the zone stacking context
  ---
  duration_ms: 0.892194
  type: 'test'
  ...
# Subtest: regular zones keep only their inner line shadow
ok 10 - regular zones keep only their inner line shadow
  ---
  duration_ms: 0.231079
  type: 'test'
  ...
# Subtest: resize-selected-card mutates selected card geometry from the active handle
ok 11 - resize-selected-card mutates selected card geometry from the active handle
  ---
  duration_ms: 18.308296
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 179.520158
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-62","timestamp":"2026-07-10T04:42:05.015Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"62","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_33","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"renderCanvasControlOverlay\\\\\\\\\\\\(\\\\\\\\\\\\):|commitSelectedLedgerGeometry\\\\\\\\\\\\(\\\\\\\\\\\\)|cloneSelectionState.*state|pruneSelectionToActiveLedger.*active-ledger-geometry|createPointerSelectionSnapshot.*state\\\" frontend/test tests || true\ngit diff --name-only -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sort\ngit status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"renderCanvasControlOverlay\\\\\\(\\\\\\):|commitSelectedLedgerGeometry\\\\\\(\\\\\\)|cloneSelectionState.*state|pruneSelectionToActiveLedger.*active-ledger-geometry|createPointerSelectionSnapshot.*state\" frontend/test tests || true
git diff --name-only -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sort
git status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-63","timestamp":"2026-07-10T04:42:05.015Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"63","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_33","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"renderCanvasControlOverlay\\\\\\\\\\\\(\\\\\\\\\\\\):|commitSelectedLedgerGeometry\\\\\\\\\\\\(\\\\\\\\\\\\)|cloneSelectionState.*state|pruneSelectionToActiveLedger.*active-ledger-geometry|createPointerSelectionSnapshot.*state\\\" frontend/test tests || true\ngit diff --name-only -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sort\ngit status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"renderCanvasControlOverlay\\\\\\(\\\\\\):|commitSelectedLedgerGeometry\\\\\\(\\\\\\)|cloneSelectionState.*state|pruneSelectionToActiveLedger.*active-ledger-geometry|createPointerSelectionSnapshot.*state\" frontend/test tests || true
git diff --name-only -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts | sort
git status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: completed
Exit code: 0

````text
frontend/test/runtime/ledger-content-refresh.integration.test.ts:285:  assert.match(refresh, /const selectionAtRefreshStart = cloneSelectionState\(state\.selection\)/);
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
frontend/src/runtime/card/effect/resize-selected-card.ts
frontend/src/runtime/gesture/controller/handle-pointer-down.ts
frontend/src/runtime/gesture/controller/handle-pointer-move.ts
frontend/src/runtime/gesture/controller/handle-pointer-up.ts
frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
frontend/src/runtime/selection/effect/move-selected.ts
frontend/src/runtime/state.ts
frontend/src/runtime/zone/effect/resize-selected-zone.ts
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
frontend/test/runtime/canvas-pan-performance.integration.test.ts
frontend/test/runtime/drag-release-freeze.integration.test.ts
frontend/test/runtime/input-controller-routing.integration.test.ts
frontend/test/runtime/ledger-content-refresh.integration.test.ts
frontend/test/runtime/selection-direct-card-click.integration.test.ts
package.json
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
 M frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
 M frontend/src/runtime/card/effect/resize-selected-card.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-down.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-move.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-up.ts
 M frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
 M frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
 M frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
 M frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
 M frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
 M frontend/src/runtime/selection/effect/move-selected.ts
 M frontend/src/runtime/state.ts
 M frontend/src/runtime/zone/effect/resize-selected-zone.ts
 M frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
 M frontend/test/runtime/canvas-pan-performance.integration.test.ts
 M frontend/test/runtime/drag-release-freeze.integration.test.ts
 M frontend/test/runtime/input-controller-routing.integration.test.ts
 M frontend/test/runtime/ledger-content-refresh.integration.test.ts
 M frontend/test/runtime/selection-direct-card-click.integration.test.ts
 M package.json
 M tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
?? frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
?? frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts
?? frontend/src/runtime/selection/helper/clone-selection-state.ts
?? frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
?? frontend/src/runtime/selection/helper/selection-states-equal.ts
?? package-lock.json
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-64","timestamp":"2026-07-10T04:42:15.016Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"64","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_34","codexTool":"/usr/bin/zsh -lc 'git diff -- frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'git diff -- frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-65","timestamp":"2026-07-10T04:42:15.016Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"65","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_34","codexTool":"/usr/bin/zsh -lc 'git diff -- frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git diff -- frontend/src/runtime/state.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts'`
Status: completed
Exit code: 0

````text
diff --git a/frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts b/frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
index 3c69c76..947db66 100644
--- a/frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
+++ b/frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
@@ -1,7 +1,11 @@
+/**
+ * WHAT: Renders contextual card, zone, and group controls for hovered and selected canvas targets.
+ * WHY: Control placement must follow current geometry and may use an explicit gesture selection.
+ */
 import { canvas, content, controlOverlay as initialControlOverlay } from '../../dom.js';
 import { renderLedgerCardDeleteButton } from '../../ledger/component/render-ledger-card-delete-button.js';
 import { renderLedgerCardStatusButton } from '../../ledger/component/render-ledger-card-status-button.js';
-import { state } from '../../state.js';
+import { state, type SelectionState } from '../../state.js';
 
 type ControlTarget = {
   kind: 'card' | 'zone' | 'group';
@@ -72,16 +76,16 @@ function sourceElement(target: ControlTarget): HTMLElement | null {
   return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
 }
 
-function selectedTargets(): ControlTarget[] {
+function selectedTargets(selection: Partial<SelectionState>): ControlTarget[] {
   const targets: ControlTarget[] = [];
-  for (const id of new Set(state.selection.zoneIds as string[])) targets.push({ kind: 'zone', id });
-  for (const id of new Set(state.selection.groupIds as string[])) targets.push({ kind: 'group', id });
+  for (const id of new Set(selection.zoneIds ?? [])) targets.push({ kind: 'zone', id });
+  for (const id of new Set(selection.groupIds ?? [])) targets.push({ kind: 'group', id });
   return targets;
 }
 
-function visibleTargets(): ControlTarget[] {
+function visibleTargets(selection: Partial<SelectionState>): ControlTarget[] {
   const byKey = new Map<string, ControlTarget>();
-  for (const target of selectedTargets()) byKey.set(targetKey(target), target);
+  for (const target of selectedTargets(selection)) byKey.set(targetKey(target), target);
   if (hoveredTarget) byKey.set(targetKey(hoveredTarget), hoveredTarget);
   return [...byKey.values()];
 }
@@ -204,7 +208,7 @@ function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' |
   return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);
 }
 
-export function renderCanvasControlOverlay(): void {
+export function renderCanvasControlOverlay(selection: Partial<SelectionState> = state.selection): void {
   if (controlsDisabled()) {
     clearCanvasControlOverlay();
     return;
@@ -212,7 +216,7 @@ export function renderCanvasControlOverlay(): void {
   const overlay = resolveControlOverlay();
   if (!overlay || !canvas || !content) return;
   const activeKeys = new Set<string>();
-  for (const target of visibleTargets()) {
+  for (const target of visibleTargets(selection)) {
     const source = sourceElement(target);
     if (!source || source.hidden || source.style.display === 'none') continue;
     const key = targetKey(target);
diff --git a/frontend/src/runtime/card/effect/resize-selected-card.ts b/frontend/src/runtime/card/effect/resize-selected-card.ts
index cbed1af..bfd59a5 100644
--- a/frontend/src/runtime/card/effect/resize-selected-card.ts
+++ b/frontend/src/runtime/card/effect/resize-selected-card.ts
@@ -1,17 +1,28 @@
+/**
+ * WHAT: Applies pointer resize deltas to the selected card and its active-ledger geometry.
+ * WHY: Resizing must survive canvas remounts by resolving the live node from pointer identity.
+ */
 import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
 import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
 import { state } from '../../state.js';
 import { telemetry } from '../../telemetry/effect/telemetry.js';
 import { activeLedgerCardMap, ledgerCardGeometry, patchLedgerCardGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
 import { renderGeometry } from '../../canvas/helper/render-density.js';
+import { resolveCurrentPointerTarget } from '../../gesture/helper/resolve-current-pointer-target.js';
 
 export function resizeSelectedCard(dx: number, dy: number): void {
-  const card = state.pointer?.target as HTMLElement | null;
-  if (!card) return;
-  const current = state.activeLedger && card.dataset.cardId
-    ? ledgerCardGeometry(activeLedgerCardMap().get(card.dataset.cardId) ?? {})
-    : { x: card.offsetLeft, y: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
-  const handle = state.pointer.resizeHandle as HTMLElement | null;
+  const pointer = state.pointer;
+  const savedCard = pointer?.target as HTMLElement | null;
+  const cardId = String(pointer?.targetId || savedCard?.dataset.cardId || '');
+  const card = resolveCurrentPointerTarget('card', cardId, savedCard);
+  const ledgerCard = state.activeLedger && cardId ? activeLedgerCardMap().get(cardId) : undefined;
+  // WHAT: Stop only when neither persisted geometry nor a live target remains.
+  // WHY: A remounted canvas can invalidate either representation independently.
+  if (!card && !ledgerCard) return;
+  const current = ledgerCard
+    ? ledgerCardGeometry(ledgerCard)
+    : { x: card?.offsetLeft ?? 0, y: card?.offsetTop ?? 0, width: card?.offsetWidth ?? 0, height: card?.offsetHeight ?? 0 };
+  const handle = pointer?.resizeHandle as HTMLElement | null;
   const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
   const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
   const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
@@ -22,6 +33,8 @@ export function resizeSelectedCard(dx: number, dy: number): void {
   let nextTop = current.y;
   let nextWidth = current.width;
   let nextHeight = current.height;
+  // WHAT: Clamp west and north movement while preserving the opposite edge.
+  // WHY: Resizing must honor the card minimum without shifting the anchored edge.
   if (west) {
     const clampedDx = Math.min(dx, current.width - minWidth);
     nextLeft = current.x + clampedDx;
@@ -35,14 +48,11 @@ export function resizeSelectedCard(dx: number, dy: number): void {
   }
   if (south) nextHeight = Math.max(minHeight, current.height + dy);
   const geometry = { x: nextLeft, y: nextTop, width: nextWidth, height: nextHeight };
-  if (state.activeLedger && card.dataset.cardId) {
-    const ledgerCard = activeLedgerCardMap().get(card.dataset.cardId);
-    if (ledgerCard) patchLedgerCardGeometry(ledgerCard, geometry);
-  }
-  patchCardBox(card, geometry);
+  if (ledgerCard) patchLedgerCardGeometry(ledgerCard, geometry);
+  if (card) patchCardBox(card, geometry);
   renderRelationshipOverlay();
   renderCanvasControlOverlay();
-  telemetry('render-card-layer', { spec: '60000006', resized: card.dataset.cardId, geometry });
+  telemetry('render-card-layer', { spec: '60000006', resized: cardId, geometry });
 }
 
 function patchCardBox(card: HTMLElement, geometry: LedgerGeometry): void {
diff --git a/frontend/src/runtime/gesture/controller/handle-pointer-down.ts b/frontend/src/runtime/gesture/controller/handle-pointer-down.ts
index ec154aa..c342ada 100644
--- a/frontend/src/runtime/gesture/controller/handle-pointer-down.ts
+++ b/frontend/src/runtime/gesture/controller/handle-pointer-down.ts
@@ -15,6 +15,7 @@ import { renderSelectionState } from '../../selection/effect/render-selection-st
 import { selectThread } from '../../thread/effect/select-thread.js';
 import { closeThreadPanel } from '../../thread/effect/close-thread-panel.js';
 import { telemetry } from '../../telemetry/effect/telemetry.js';
+import { createPointerSelectionSnapshot } from '../helper/create-pointer-selection-snapshot.js';
 
 export function handlePointerDown(event: PointerEvent): void {
   const rawTarget = event.target as HTMLElement;
@@ -43,6 +44,16 @@ export function handlePointerDown(event: PointerEvent): void {
   const preserveSelection = shouldPreservePointerSelection(state.selection, targetKind, targetId, event.shiftKey);
   if ((intent === 'drag' || intent === 'group') && !preserveSelection) selectTarget(targetKind, targetId, event.shiftKey);
   if (intent === 'resize') selectTarget(targetKind, targetId, false);
+  if (state.pointer && (intent === 'drag' || intent === 'group' || intent === 'resize')) {
+    // WHAT: Freeze gesture identity after pointer-down selection has settled.
+    // WHY: Async refresh and later selection changes must not redirect movement or commit payloads.
+    state.pointer.selectionSnapshot = createPointerSelectionSnapshot({
+      selection: state.selection,
+      targetKind,
+      targetId,
+      ledgerStateId: currentLedgerStateId()
+    });
+  }
   if (intent === 'marquee' || intent === 'draw-card' || intent === 'draw-zone' || intent === 'draw-group') {
     const marquee = document.querySelector('.marquee') as HTMLElement;
     marquee.hidden = false;
@@ -50,3 +61,7 @@ export function handlePointerDown(event: PointerEvent): void {
   }
   canvas.setPointerCapture?.(event.pointerId);
 }
+
+function currentLedgerStateId(): string {
+  return String(state.activeLedgerId || (state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab || ''));
+}
diff --git a/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts b/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
index 3dee821..db95105 100644
--- a/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
+++ b/frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
@@ -1,11 +1,19 @@
-import { state } from '../../state.js';
+/**
+ * WHAT: Commits active-ledger geometry for one explicit selection.
+ * WHY: Pointer release must persist the same target ids used throughout the gesture.
+ */
+import { state, type SelectionState } from '../../state.js';
 import { commitActiveLedgerMutation } from './commit-active-ledger-mutation.js';
 import { selectedLedgerGeometryPayload } from '../helper/active-ledger-geometry.js';
 
-export async function commitSelectedLedgerGeometry(): Promise<boolean> {
+export async function commitSelectedLedgerGeometry(selection: Partial<SelectionState> = state.selection): Promise<boolean> {
+  // WHAT: Skip static canvases that have no active ledger mutation endpoint.
+  // WHY: Their geometry is persisted through the local runtime state path.
   if (!state.activeLedger) return false;
-  const geometry = selectedLedgerGeometryPayload();
+  const geometry = selectedLedgerGeometryPayload(selection);
   const hasGeometry = Object.values(geometry).some((records) => Object.keys(records).length > 0);
+  // WHAT: Avoid an empty mutation when every selected id disappeared from the ledger.
+  // WHY: A no-op request would trigger unnecessary refresh and rendering work.
   if (!hasGeometry) return false;
   return commitActiveLedgerMutation({ action: 'patch-geometry', geometry }, { render: true });
 }
diff --git a/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts b/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
index 6915db1..9484490 100644
--- a/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
+++ b/frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
@@ -3,6 +3,8 @@
  * WHY: Server ledgers are authoritative, while optimistic thread notes must survive stale refreshes.
  */
 import { state } from '../../state.js';
+import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
+import { pruneSelectionToActiveLedger } from '../../selection/helper/prune-selection-to-active-ledger.js';
 import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
 import { mergeLocalCanvasStateIntoLedger } from '../helper/merge-local-canvas-state.js';
 import { mergeLocalThreadNotes } from '../helper/merge-local-thread-notes.js';
@@ -15,16 +17,22 @@ export async function loadActiveLedgerState(): Promise<void> {
   const canMergeLocalCanvas = Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
   const localLedger = canMergeLocalCanvas ? state.activeLedger : null;
   if (!endpoint) {
+    // WHAT: Clear state that cannot belong to an unresolved route ledger.
+    // WHY: Retaining either ledger data or selection would expose stale targets.
     state.activeLedger = null;
     state.activeLedgerId = '';
+    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
     refreshZoneAttributionCache('missing-ledger-tab');
     telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false, source: 'missing-ledger-tab' });
     return;
   }
   const response = await fetch(endpoint).catch(() => undefined);
   if (!response?.ok) {
+    // WHAT: Clear state when the authoritative ledger cannot be loaded.
+    // WHY: Selection cannot remain valid without its owning ledger.
     state.activeLedger = null;
     state.activeLedgerId = '';
+    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
     refreshZoneAttributionCache('load-failed');
     telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false });
     return;
@@ -40,6 +48,18 @@ export async function loadActiveLedgerState(): Promise<void> {
     if (state.canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...localViewport } };
   } else if (state.canvasMode === 'ledgers') Object.assign(state.viewport, ledger?.viewport ?? state.viewport);
   else Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? ledger?.viewport ?? state.viewport);
-  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  if (canMergeLocalCanvas) {
+    const prunedSelection = pruneSelectionToActiveLedger(state.selection);
+    const pointerSnapshot = state.pointer?.selectionSnapshot;
+    // WHAT: Prefer the active pointer operand for the same ledger; otherwise keep only refreshed ids.
+    // WHY: A live gesture must remain stable while an idle selection must drop deleted records.
+    state.selection = pointerSnapshot?.ledgerStateId === ledgerStateId
+      ? cloneSelectionState(pointerSnapshot)
+      : prunedSelection;
+  } else {
+    // WHAT: Reset selection across ledger identity changes.
+    // WHY: Selection ids are scoped to their owning ledger.
+    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
+  }
   telemetry('load-ledger-state', { activeTab: state.activeTab, canvasMode: state.canvasMode, ok: Boolean(ledger), cards: ledger?.cards?.length ?? 0, relationships: ledger?.relationships?.length ?? 0 });
 }
diff --git a/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts b/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
index 6fa8216..8ad16e9 100644
--- a/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
+++ b/frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
@@ -1,4 +1,9 @@
-import { state } from '../../state.js';
+/**
+ * WHAT: Reads, normalizes, and patches active-ledger canvas geometry.
+ * WHY: Canvas effects need one geometry contract across cards, zones, and groups.
+ */
+import { state, type SelectionState } from '../../state.js';
+import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
 
 export type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
 export type LedgerGeometry = { x: number; y: number; width: number; height: number };
@@ -106,11 +111,12 @@ export function patchLedgerAnnotationGeometry(annotation: LedgerRecord, geometry
   return ledgerAnnotationGeometry(annotation);
 }
 
-export function selectedLedgerGeometryPayload(selection = state.selection): {
+export function selectedLedgerGeometryPayload(selection: Partial<SelectionState> = state.selection): {
   cards: Record<string, LedgerGeometry>;
   zones: Record<string, LedgerGeometry>;
   groups: Record<string, LedgerGeometry>;
 } {
+  const current = cloneSelectionState(selection);
   const cards = activeLedgerCardMap();
   const annotations = activeLedgerAnnotationMap();
   const payload = { cards: {}, zones: {}, groups: {} } as {
@@ -118,15 +124,15 @@ export function selectedLedgerGeometryPayload(selection = state.selection): {
     zones: Record<string, LedgerGeometry>;
     groups: Record<string, LedgerGeometry>;
   };
-  for (const id of selection.cardIds as string[]) {
+  for (const id of current.cardIds) {
     const card = cards.get(id);
     if (card) payload.cards[id] = ledgerCardGeometry(card);
   }
-  for (const id of selection.zoneIds as string[]) {
+  for (const id of current.zoneIds) {
     const annotation = annotations.get(id);
     if (annotation) payload.zones[id] = ledgerAnnotationGeometry(annotation);
   }
-  for (const id of selection.groupIds as string[]) {
+  for (const id of current.groupIds) {
     const annotation = annotations.get(id);
     if (annotation) payload.groups[id] = ledgerAnnotationGeometry(annotation);
   }
diff --git a/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts b/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
index dcf293d..58a826f 100644
--- a/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
+++ b/frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
@@ -9,6 +9,8 @@ import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-le
 import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
 import { persistState } from '../../persistence/effect/persist-state.js';
 import { state } from '../../state.js';
+import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
+import { selectionStatesEqual } from '../../selection/helper/selection-states-equal.js';
 import { telemetry } from '../../telemetry/effect/telemetry.js';
 import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
 
@@ -116,10 +118,14 @@ async function reloadThreadContent(reason: string): Promise<void> {
     return;
   }
   threadRefreshInFlight = true;
-  const selection = state.selection;
+  const selectionAtRefreshStart = cloneSelectionState(state.selection);
   try {
     await loadActiveLedgerState();
-    state.selection = selection;
+    // WHAT: Restore a detached clone only when the awaited load did not observe newer operator state.
+    // WHY: A stale thread refresh must never overwrite a selection made while its request was in flight.
+    if (!state.pointer && selectionStatesEqual(state.selection, selectionAtRefreshStart)) {
+      state.selection = cloneSelectionState(selectionAtRefreshStart);
+    }
     renderThreadPanel();
     telemetry('thread-content-refresh', { reason });
   } finally {
diff --git a/frontend/src/runtime/selection/effect/move-selected.ts b/frontend/src/runtime/selection/effect/move-selected.ts
index 4546946..53bc4b8 100644
--- a/frontend/src/runtime/selection/effect/move-selected.ts
+++ b/frontend/src/runtime/selection/effect/move-selected.ts
@@ -1,4 +1,9 @@
-import { state } from '../../state.js';
+/**
+ * WHAT: Moves one explicit selection through ledger geometry or static DOM geometry.
+ * WHY: Active gestures must keep using their pointer-down selection across refresh and live selection changes.
+ */
+import { state, type SelectionState } from '../../state.js';
+import { cloneSelectionState } from '../helper/clone-selection-state.js';
 import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
 import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
 import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
@@ -6,38 +11,41 @@ import { telemetry } from '../../telemetry/effect/telemetry.js';
 import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, patchLedgerAnnotationGeometry, patchLedgerCardGeometry } from '../../ledger/helper/active-ledger-geometry.js';
 import { renderGeometry } from '../../canvas/helper/render-density.js';
 
-export function moveSelected(dx: number, dy: number): void {
+export function moveSelected(dx: number, dy: number, selection: Partial<SelectionState> = state.selection): void {
+  const movingSelection = cloneSelectionState(selection);
+  // WHAT: Patch the authoritative ledger when present; otherwise update static canvas nodes.
+  // WHY: Both canvas modes share gesture control flow but own geometry in different stores.
   if (state.activeLedger) {
-    moveSelectedLedgerGeometry(dx, dy);
+    moveSelectedLedgerGeometry(dx, dy, movingSelection);
   } else {
-    moveSelectedDomGeometry(dx, dy);
+    moveSelectedDomGeometry(dx, dy, movingSelection);
   }
-  telemetry('render-card-layer', { moved: state.selection.cardIds });
-  telemetry('render-zone-layer', { moved: state.selection.zoneIds });
-  telemetry('render-group-layer', { moved: state.selection.groupIds });
+  telemetry('render-card-layer', { moved: movingSelection.cardIds });
+  telemetry('render-zone-layer', { moved: movingSelection.zoneIds });
+  telemetry('render-group-layer', { moved: movingSelection.groupIds });
   renderZoneLabelOverlay();
   renderRelationshipOverlay();
-  renderCanvasControlOverlay();
+  renderCanvasControlOverlay(movingSelection);
 }
 
-function moveSelectedLedgerGeometry(dx: number, dy: number): void {
+function moveSelectedLedgerGeometry(dx: number, dy: number, selection: SelectionState): void {
   const cards = activeLedgerCardMap();
   const annotations = activeLedgerAnnotationMap();
-  for (const id of state.selection.cardIds as string[]) {
+  for (const id of selection.cardIds) {
     const card = cards.get(id);
     if (!card) continue;
     const geometry = ledgerCardGeometry(card);
     patchLedgerCardGeometry(card, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
     patchNodePosition(document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
   }
-  for (const id of state.selection.zoneIds as string[]) {
+  for (const id of selection.zoneIds) {
     const annotation = annotations.get(id);
     if (!annotation) continue;
     const geometry = ledgerAnnotationGeometry(annotation);
     patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
     patchNodePosition(document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
   }
-  for (const id of state.selection.groupIds as string[]) {
+  for (const id of selection.groupIds) {
     const annotation = annotations.get(id);
     if (!annotation) continue;
     const geometry = ledgerAnnotationGeometry(annotation);
@@ -46,11 +54,11 @@ function moveSelectedLedgerGeometry(dx: number, dy: number): void {
   }
 }
 
-function moveSelectedDomGeometry(dx: number, dy: number): void {
+function moveSelectedDomGeometry(dx: number, dy: number, selection: SelectionState): void {
   const selected = [
-    ...state.selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
-    ...state.selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
-    ...state.selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
+    ...selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
+    ...selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
+    ...selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
   ].filter(Boolean) as HTMLElement[];
   selected.forEach((node) => {
     node.style.left = `${node.offsetLeft + dx}px`;
diff --git a/frontend/src/runtime/state.ts b/frontend/src/runtime/state.ts
index 88513df..0332155 100644
--- a/frontend/src/runtime/state.ts
+++ b/frontend/src/runtime/state.ts
@@ -1,3 +1,15 @@
+/**
+ * WHAT: Defines and initializes mutable client runtime state.
+ * WHY: Controllers and effects need one canonical store for the active workspace session.
+ */
+export type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };
+
+export type PointerSelectionSnapshot = SelectionState & {
+  targetKind: string;
+  targetId: string;
+  ledgerStateId: string;
+};
+
 export const state: any = {
   routePath: globalThis.window?.location?.pathname ?? '/',
   projectName: 'Project',
diff --git a/frontend/src/runtime/zone/effect/resize-selected-zone.ts b/frontend/src/runtime/zone/effect/resize-selected-zone.ts
index c2f2a42..cbba542 100644
--- a/frontend/src/runtime/zone/effect/resize-selected-zone.ts
+++ b/frontend/src/runtime/zone/effect/resize-selected-zone.ts
@@ -1,29 +1,42 @@
+/**
+ * WHAT: Applies pointer resize deltas to a selected zone or group and its ledger annotation.
+ * WHY: Region resizing must survive canvas remounts without losing target identity or variant limits.
+ */
 import { state } from '../../state.js';
 import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
 import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
 import { telemetry } from '../../telemetry/effect/telemetry.js';
 import { activeLedgerAnnotationMap, ledgerAnnotationGeometry, patchLedgerAnnotationGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
 import { renderGeometry } from '../../canvas/helper/render-density.js';
+import { resolveCurrentPointerTarget } from '../../gesture/helper/resolve-current-pointer-target.js';
 
 export function resizeSelectedZone(dx: number, dy: number): void {
-  const zone = state.pointer?.target as HTMLElement | null;
-  if (!zone) return;
-  const id = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
+  const pointer = state.pointer;
+  const savedZone = pointer?.target as HTMLElement | null;
+  const targetKind = pointer?.targetKind === 'group' ? 'group' : 'zone';
+  const id = String(pointer?.targetId || savedZone?.dataset.zoneId || savedZone?.dataset.groupId || '');
+  const zone = resolveCurrentPointerTarget(targetKind, id, savedZone);
   const ledgerAnnotation = state.activeLedger && id ? activeLedgerAnnotationMap().get(id) : undefined;
+  // WHAT: Stop only when neither persisted annotation geometry nor a live target remains.
+  // WHY: A remounted canvas can invalidate either representation independently.
+  if (!zone && !ledgerAnnotation) return;
+  const isGroup = targetKind === 'group' || zone?.dataset.groupId === id || ledgerAnnotation?.variant === 'group';
   const current = ledgerAnnotation
     ? ledgerAnnotationGeometry(ledgerAnnotation)
-    : { x: zone.offsetLeft, y: zone.offsetTop, width: zone.offsetWidth, height: zone.offsetHeight };
-  const handle = state.pointer.resizeHandle as HTMLElement | null;
+    : { x: zone?.offsetLeft ?? 0, y: zone?.offsetTop ?? 0, width: zone?.offsetWidth ?? 0, height: zone?.offsetHeight ?? 0 };
+  const handle = pointer?.resizeHandle as HTMLElement | null;
   const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
   const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
   const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
   const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
-  const minWidth = zone.dataset.groupId ? 220 : 180;
-  const minHeight = zone.dataset.groupId ? 160 : 140;
+  const minWidth = isGroup ? 220 : 180;
+  const minHeight = isGroup ? 160 : 140;
   let nextLeft = current.x;
   let nextTop = current.y;
   let nextWidth = current.width;
   let nextHeight = current.height;
+  // WHAT: Clamp west and north movement while preserving the opposite edge.
+  // WHY: Region resizing must honor variant minimums without shifting the anchored edge.
   if (west) {
     const clampedDx = Math.min(dx, current.width - minWidth);
     nextLeft = current.x + clampedDx;
@@ -38,10 +51,10 @@ export function resizeSelectedZone(dx: number, dy: number): void {
   if (south) nextHeight = Math.max(minHeight, current.height + dy);
   const geometry = { x: nextLeft, y: nextTop, width: nextWidth, height: nextHeight };
   if (ledgerAnnotation) patchLedgerAnnotationGeometry(ledgerAnnotation, geometry);
-  patchZoneBox(zone, geometry);
+  if (zone) patchZoneBox(zone, geometry);
   renderZoneLabelOverlay();
   renderCanvasControlOverlay();
-  telemetry(zone.dataset.groupId ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
+  telemetry(isGroup ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
 }
 
 function patchZoneBox(zone: HTMLElement, geometry: LedgerGeometry): void {
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-66","timestamp":"2026-07-10T04:42:31.015Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"66","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_35"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/controller/handle-pointer-down.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/helper/current-ledger-state-id.ts: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-67","timestamp":"2026-07-10T04:42:31.015Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"67","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_35"} -->

- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/gesture/controller/handle-pointer-down.ts: update
- /home/jbb/dev/EditorBP/decision-os/frontend/src/runtime/ledger/helper/current-ledger-state-id.ts: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-68","timestamp":"2026-07-10T04:42:43.014Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"68","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_36","codexTool":"/usr/bin/zsh -lc \"sed -n '1,180p' tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts\nsed -n '1,270p' tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,180p' tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts
sed -n '1,270p' tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-69","timestamp":"2026-07-10T04:42:43.014Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"69","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_36","codexTool":"/usr/bin/zsh -lc \"sed -n '1,180p' tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts\nsed -n '1,270p' tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,180p' tests/browser/thread/the-thread-launcher-exposes-codex-run-controls.spec.ts
sed -n '1,270p' tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts"`
Status: completed
Exit code: 0

````text
/**
 * WHAT: Browser proof that the thread launcher exposes the Codex model and effort controls.
 * WHY: Operators must be able to configure a thread-started Codex run before launching it.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';

test('The thread launcher exposes Codex model and effort controls.', async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(`${server.url}/tasks-system`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__coreState?.activeLedger?.cards?.length));

    await page.evaluate(async () => {
      const state = window.__coreState;
      const cardId = String(state.activeLedger.cards[0].id);
      state.threadId = `thread-${cardId}`;
      state.threadPanelOpen = true;
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      renderThreadPanel();
    });

    const selectors = page.locator('.thread-codex-select');
    await assert.doesNotReject(() => selectors.nth(1).waitFor({ state: 'visible' }));
    assert.equal(await selectors.count(), 2);
    assert.equal(await selectors.nth(0).getAttribute('aria-label'), 'Model for thread Codex');
    assert.equal(await selectors.nth(1).getAttribute('aria-label'), 'Effort for thread Codex');
    assert.equal(await selectors.nth(0).inputValue(), 'gpt-5.5');
    assert.equal(await selectors.nth(1).inputValue(), 'xhigh');

    await selectors.nth(0).selectOption('gpt-5.4');
    await selectors.nth(1).selectOption('high');
    const button = page.locator('[data-action="process-thread-codex"]');
    assert.equal(await button.getAttribute('data-codex-model'), 'gpt-5.4');
    assert.equal(await button.getAttribute('data-codex-effort'), 'high');

    const launcherFitsPanel = await page.evaluate(() => {
      const panel = document.querySelector('.thread-panel')?.getBoundingClientRect();
      const controls = [...document.querySelectorAll('.thread-actions > *')].map((element) => element.getBoundingClientRect());
      return Boolean(panel) && controls.every((control) => control.left >= panel.left && control.right <= panel.right);
    });
    assert.equal(launcherFitsPanel, true);
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: repoRoot,
    detached: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  await waitFor(async () => {
    assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
    const response = await fetch(`${url}/tasks-system`, { method: 'HEAD' }).catch(() => undefined);
    return Boolean(response?.ok);
  }, `Timed out waiting for decision-os server at ${url}/tasks-system`);
  return { process: child, url };
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid) process.kill(-child.pid, 'SIGTERM');
  await Promise.race([new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())), delay(2000)]);
  if (child.exitCode === null && child.signalCode === null && child.pid) process.kill(-child.pid, 'SIGKILL');
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return address.port;
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

declare global {
  interface Window {
    __coreState: any;
  }
}
/**
 * WHAT: Browser interaction proof for spec 9d1b7c36: The refresh system preserves canvas continuity during operator work.
 * WHY: Refresh during an active drag must not change the card id committed on release.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

type LedgerCard = {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
};

type LedgerDocument = {
  cards?: LedgerCard[];
  annotations?: Array<Record<string, unknown>>;
};

type LedgerGeometryPatch = {
  cards?: Record<string, { x: number; y: number; width: number; height: number }>;
  zones?: Record<string, { x: number; y: number; width: number; height: number }>;
  groups?: Record<string, { x: number; y: number; width: number; height: number }>;
};

type PatchGeometryMutation = {
  action?: string;
  geometry?: LedgerGeometryPatch;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const targetCardId = '9d1b7c36';
const chromiumExecutablePath = '/snap/bin/chromium';

test('The refresh system preserves canvas continuity during operator work.', async () => {
  const originalLedger = readSpecsLedger();
  const targetCard = originalLedger.cards?.find((card) => String(card.id ?? '') === targetCardId);
  assert.ok(targetCard, `Expected specs ledger to contain card ${targetCardId}`);

  const viewport = viewportForCard(targetCard);
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const committedMutations: PatchGeometryMutation[] = [];

    await seedCanvasViewport(page, viewport);
    await page.route(`${server.url}/decision-os/specs`, async (route) => {
      const request = route.request();
      if (request.method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const mutation = request.postDataJSON() as PatchGeometryMutation;
      if (mutation.action === 'patch-geometry') committedMutations.push(mutation);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(applyGeometryPatch(originalLedger, mutation.geometry ?? {}))
      });
    });

    await page.goto(`${server.url}/specs`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((cardId) => {
      const state = (window as Window & { __coreState?: { activeLedger?: { cards?: Array<{ id?: string }> } } }).__coreState;
      return Boolean(state?.activeLedger?.cards?.some((card) => String(card.id ?? '') === cardId));
    }, targetCardId);

    const card = page.locator(`[data-card-id="${targetCardId}"].ledger-node`);
    await card.waitFor({ state: 'visible' });
    const cardBox = await card.boundingBox();
    assert.ok(cardBox, `Expected card ${targetCardId} to have browser geometry`);

    const start = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + 10);

    const refreshCountBefore = await refreshCompletionCount(page);
    await page.locator('[data-action="refresh"]').evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction((previousCount) => {
      const telemetry = ((window as Window & { __coreTelemetry?: Array<{ name?: string; args?: { source?: string } }> }).__coreTelemetry ?? []);
      return telemetry.filter((entry) => entry.name === 'merge-refresh-state' && entry.args?.source === 'refresh-button').length > previousCount;
    }, refreshCountBefore);

    await page.mouse.move(start.x + 110, start.y + 30);
    await page.mouse.up();

    await waitFor(() => committedMutations.length > 0, 'Timed out waiting for patch-geometry commit');
    const finalMutation = committedMutations.at(-1);
    assert.ok(finalMutation?.geometry, 'Expected release to commit geometry');
    assert.deepEqual(Object.keys(finalMutation.geometry.cards ?? {}), [targetCardId]);
    assert.deepEqual(Object.keys(finalMutation.geometry.zones ?? {}), []);
    assert.deepEqual(Object.keys(finalMutation.geometry.groups ?? {}), []);
    assert.equal(finalMutation.geometry.cards?.[targetCardId]?.x, Number(targetCard.x ?? 0) + 110);
    assert.equal(finalMutation.geometry.cards?.[targetCardId]?.y, Number(targetCard.y ?? 0) + 30);
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

async function seedCanvasViewport(page: Page, viewport: { x: number; y: number; scale: number }): Promise<void> {
  await page.addInitScript((input) => {
    localStorage.setItem('decision-os.canvas.state', JSON.stringify({
      activeTab: 'specs',
      railCollapsed: false,
      selection: { cardIds: [], zoneIds: [], groupIds: [] },
      viewport: input,
      viewports: { specs: input }
    }));
  }, viewport);
}

async function refreshCompletionCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const telemetry = ((window as Window & { __coreTelemetry?: Array<{ name?: string; args?: { source?: string } }> }).__coreTelemetry ?? []);
    return telemetry.filter((entry) => entry.name === 'merge-refresh-state' && entry.args?.source === 'refresh-button').length;
  });
}

function readSpecsLedger(): LedgerDocument {
  return JSON.parse(readFileSync(resolve(repoRoot, '.decision-os/specs.json'), 'utf8')) as LedgerDocument;
}

function viewportForCard(card: LedgerCard): { x: number; y: number; scale: number } {
  return {
    x: 420 - Number(card.x ?? 0),
    y: 240 - Number(card.y ?? 0),
    scale: 1
  };
}

function applyGeometryPatch(ledger: LedgerDocument, geometry: LedgerGeometryPatch): LedgerDocument {
  const next = JSON.parse(JSON.stringify(ledger)) as LedgerDocument;
  const cardPatches = geometry.cards ?? {};
  next.cards = (next.cards ?? []).map((card) => {
    const patch = cardPatches[String(card.id ?? '')];
    return patch ? { ...card, x: patch.x, y: patch.y, w: patch.width, h: patch.height } : card;
  });
  return next;
}

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
}

async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: repoRoot,
    detached: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  await waitFor(async () => {
    assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
    const response = await fetch(`${url}/specs`, { method: 'HEAD' }).catch(() => undefined);
    return Boolean(response?.ok);
  }, `Timed out waiting for decision-os server at ${url}/specs`);
  return { process: child, url };
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  } else {
    child.kill('SIGTERM');
  }
  const exited = await Promise.race([waitForExit(child).then(() => true), delay(2000).then(() => false)]);
  if (!exited && child.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Expected an ephemeral TCP port');
  const port = address.port;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail(message);
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveExit) => child.once('exit', () => resolveExit()));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-70","timestamp":"2026-07-10T04:42:49.023Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"70","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_37","codexTool":"/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-71","timestamp":"2026-07-10T04:42:53.016Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"71","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_37","codexTool":"/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: completed
Exit code: 0

````text
# Subtest: The refresh system preserves canvas continuity during operator work.
ok 1 - The refresh system preserves canvas continuity during operator work.
  ---
  duration_ms: 2432.217299
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4877.082375
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-72","timestamp":"2026-07-10T04:42:59.018Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"72","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_38","codexTool":"/usr/bin/zsh -lc 'npm run typecheck:frontend && npm ci --dry-run --ignore-scripts && git diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'npm run typecheck:frontend && npm ci --dry-run --ignore-scripts && git diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-73","timestamp":"2026-07-10T04:43:01.016Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"73","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_38","codexTool":"/usr/bin/zsh -lc 'npm run typecheck:frontend && npm ci --dry-run --ignore-scripts && git diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'npm run typecheck:frontend && npm ci --dry-run --ignore-scripts && git diff --check -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: completed
Exit code: 0

````text
add fsevents 2.3.2

added 1 package in 171ms
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-74","timestamp":"2026-07-10T04:43:13.020Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"74","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_39"} -->

All scoped verification is now green: focused runtime `28/28`, affected source-contract tests `11/11`, browser interaction `1/1`, frontend typecheck, package dry-run, and whitespace checks. I’m preparing a focused implementation commit; the unrelated full-suite alias failure will be recorded as a verified repository-level blocker, not misreported as an iteration regression.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-76","timestamp":"2026-07-10T04:43:19.017Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"76","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_40","codexTool":"/usr/bin/zsh -lc \"git diff --stat -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\ngit status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\nsed -n '1,120p' frontend/src/runtime/gesture/helper/current-ledger-state-id.ts\nsed -n '1,160p' frontend/src/runtime/selection/helper/clone-selection-state.ts\nsed -n '1,160p' frontend/src/runtime/selection/helper/selection-states-equal.ts\nsed -n '1,180p' frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts\nsed -n '1,160p' frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts\nsed -n '1,180p' frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "git diff --stat -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
git status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
sed -n '1,120p' frontend/src/runtime/gesture/helper/current-ledger-state-id.ts
sed -n '1,160p' frontend/src/runtime/selection/helper/clone-selection-state.ts
sed -n '1,160p' frontend/src/runtime/selection/helper/selection-states-equal.ts
sed -n '1,180p' frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
sed -n '1,160p' frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
sed -n '1,180p' frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-77","timestamp":"2026-07-10T04:43:19.017Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"77","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_40","codexTool":"/usr/bin/zsh -lc \"git diff --stat -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\ngit status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\nsed -n '1,120p' frontend/src/runtime/gesture/helper/current-ledger-state-id.ts\nsed -n '1,160p' frontend/src/runtime/selection/helper/clone-selection-state.ts\nsed -n '1,160p' frontend/src/runtime/selection/helper/selection-states-equal.ts\nsed -n '1,180p' frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts\nsed -n '1,160p' frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts\nsed -n '1,180p' frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "git diff --stat -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
git status --short frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
sed -n '1,120p' frontend/src/runtime/gesture/helper/current-ledger-state-id.ts
sed -n '1,160p' frontend/src/runtime/selection/helper/clone-selection-state.ts
sed -n '1,160p' frontend/src/runtime/selection/helper/selection-states-equal.ts
sed -n '1,180p' frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
sed -n '1,160p' frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
sed -n '1,180p' frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts"`
Status: completed
Exit code: 0

````text
 .../canvas/effect/render-canvas-control-overlay.ts |  20 +-
 .../runtime/card/effect/resize-selected-card.ts    |  34 +-
 .../gesture/controller/handle-pointer-down.ts      |  12 +
 .../gesture/controller/handle-pointer-move.ts      |   2 +-
 .../gesture/controller/handle-pointer-up.ts        |   5 +-
 .../effect/commit-selected-ledger-geometry.ts      |  14 +-
 .../ledger/effect/load-active-ledger-state.ts      |  22 +-
 .../ledger/helper/active-ledger-geometry.ts        |  16 +-
 .../refresh/controller/refresh-runtime-state.ts    |   5 +-
 .../effect/subscribe-ledger-content-events.ts      |  10 +-
 .../src/runtime/selection/effect/move-selected.ts  |  40 +-
 frontend/src/runtime/state.ts                      |  12 +
 .../runtime/zone/effect/resize-selected-zone.ts    |  31 +-
 ...ctive-ledger-zone-lifecycle.integration.test.ts |  69 ++
 .../canvas-pan-performance.integration.test.ts     | 613 ++++++++++++++++-
 .../drag-release-freeze.integration.test.ts        | 726 +++++++++++++++++++--
 .../input-controller-routing.integration.test.ts   |   2 +-
 .../ledger-content-refresh.integration.test.ts     | 224 ++++++-
 ...selection-direct-card-click.integration.test.ts |   4 +-
 package.json                                       |   4 +-
 ...-canvas-continuity-during-operator-work.spec.ts | 230 ++++++-
 21 files changed, 1963 insertions(+), 132 deletions(-)
 M frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
 M frontend/src/runtime/card/effect/resize-selected-card.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-down.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-move.ts
 M frontend/src/runtime/gesture/controller/handle-pointer-up.ts
 M frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
 M frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
 M frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
 M frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
 M frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
 M frontend/src/runtime/selection/effect/move-selected.ts
 M frontend/src/runtime/state.ts
 M frontend/src/runtime/zone/effect/resize-selected-zone.ts
 M frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
 M frontend/test/runtime/canvas-pan-performance.integration.test.ts
 M frontend/test/runtime/drag-release-freeze.integration.test.ts
 M frontend/test/runtime/input-controller-routing.integration.test.ts
 M frontend/test/runtime/ledger-content-refresh.integration.test.ts
 M frontend/test/runtime/selection-direct-card-click.integration.test.ts
 M package.json
 M tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
?? frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
?? frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts
?? frontend/src/runtime/ledger/helper/current-ledger-state-id.ts
?? frontend/src/runtime/selection/helper/clone-selection-state.ts
?? frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
?? frontend/src/runtime/selection/helper/selection-states-equal.ts
?? package-lock.json
sed: can't read frontend/src/runtime/gesture/helper/current-ledger-state-id.ts: No such file or directory
/**
 * WHAT: Normalizes and clones the three runtime selection id lists.
 * WHY: Gesture snapshots and async refresh guards must never share mutable selection arrays.
 */
import type { SelectionState } from '../../state.js';

export function cloneSelectionState(selection?: Partial<SelectionState> | null): SelectionState {
  const cloneIds = (values: unknown): string[] => Array.isArray(values)
    ? values.map((value) => String(value)).filter(Boolean)
    : [];
  return {
    cardIds: cloneIds(selection?.cardIds),
    zoneIds: cloneIds(selection?.zoneIds),
    groupIds: cloneIds(selection?.groupIds)
  };
}
/**
 * WHAT: Compares two runtime selections by ordered ids.
 * WHY: An async refresh may restore its captured selection only when the operator has not changed it.
 */
import type { SelectionState } from '../../state.js';
import { cloneSelectionState } from './clone-selection-state.js';

export function selectionStatesEqual(
  left: Partial<SelectionState> | null | undefined,
  right: Partial<SelectionState> | null | undefined
): boolean {
  const current = cloneSelectionState(left);
  const expected = cloneSelectionState(right);
  return current.cardIds.length === expected.cardIds.length
    && current.cardIds.every((value, index) => value === expected.cardIds[index])
    && current.zoneIds.length === expected.zoneIds.length
    && current.zoneIds.every((value, index) => value === expected.zoneIds[index])
    && current.groupIds.length === expected.groupIds.length
    && current.groupIds.every((value, index) => value === expected.groupIds[index]);
}
/**
 * WHAT: Removes selected ids that no longer exist in the active ledger or changed annotation kind.
 * WHY: Same-ledger refreshes preserve valid operator context without retaining stale targets.
 */
import { activeLedgerAnnotationMap, activeLedgerCardMap } from '../../ledger/helper/active-ledger-geometry.js';
import { state, type SelectionState } from '../../state.js';
import { cloneSelectionState } from './clone-selection-state.js';

export function pruneSelectionToActiveLedger(selection: Partial<SelectionState> = state.selection): SelectionState {
  const current = cloneSelectionState(selection);
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  return {
    cardIds: current.cardIds.filter((id) => cards.has(id)),
    zoneIds: current.zoneIds.filter((id) => {
      const annotation = annotations.get(id);
      return Boolean(annotation && annotation.variant !== 'group');
    }),
    groupIds: current.groupIds.filter((id) => {
      const annotation = annotations.get(id);
      return Boolean(annotation && annotation.variant === 'group');
    })
  };
}
/**
 * WHAT: Captures immutable selection and target identity for one pointer session.
 * WHY: Refresh and live selection changes must not change the operands of an active gesture.
 */
import type { PointerSelectionSnapshot, SelectionState } from '../../state.js';
import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';

export function createPointerSelectionSnapshot(input: {
  selection: Partial<SelectionState>;
  targetKind: string;
  targetId: string;
  ledgerStateId: string;
}): PointerSelectionSnapshot {
  return {
    ...cloneSelectionState(input.selection),
    targetKind: input.targetKind,
    targetId: input.targetId,
    ledgerStateId: input.ledgerStateId
  };
}
/**
 * WHAT: Resolves the live DOM node for a pointer target after a canvas remount.
 * WHY: Gesture state retains target identity, while refresh may detach the element captured on pointer down.
 */
export type PointerTargetKind = 'card' | 'zone' | 'group';

export function resolveCurrentPointerTarget(
  kind: PointerTargetKind,
  id: string,
  savedTarget: HTMLElement | null
): HTMLElement | null {
  // WHAT: Preserve the saved node for non-ledger targets that have no stable id.
  // WHY: Static canvas resize behavior still relies on the pointer-down element.
  if (!id) return savedTarget;

  const datasetKey = kind === 'card' ? 'cardId' : kind === 'group' ? 'groupId' : 'zoneId';
  // WHAT: Reuse the original node only while it still represents the active target in the document.
  // WHY: A refresh can leave the saved object detached or replace it with a node for the same id.
  if (savedTarget?.dataset[datasetKey] === id && savedTarget.isConnected !== false) return savedTarget;

  const attribute = kind === 'card' ? 'data-card-id' : kind === 'group' ? 'data-group-id' : 'data-zone-id';
  const escapedId = globalThis.CSS?.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
  return document.querySelector(`[${attribute}="${escapedId}"]`) as HTMLElement | null;
}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-78","timestamp":"2026-07-10T04:43:33.017Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"78","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_41","codexTool":"/usr/bin/zsh -lc \"git add -- frontend/src/runtime/state.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/ledger/helper/current-ledger-state-id.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/input-controller-routing.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/selection-direct-card-click.integration.test.ts package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\ngit diff --cached --check\ngit diff --cached --stat\ngit status --short | sed -n '1,120p'\""} -->

**Tool call** `/usr/bin/zsh -lc "git add -- frontend/src/runtime/state.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/ledger/helper/current-ledger-state-id.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/input-controller-routing.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/selection-direct-card-click.integration.test.ts package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
git diff --cached --check
git diff --cached --stat
git status --short | sed -n '1,120p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-79","timestamp":"2026-07-10T04:43:33.017Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"79","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_41","codexTool":"/usr/bin/zsh -lc \"git add -- frontend/src/runtime/state.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/ledger/helper/current-ledger-state-id.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/input-controller-routing.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/selection-direct-card-click.integration.test.ts package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts\ngit diff --cached --check\ngit diff --cached --stat\ngit status --short | sed -n '1,120p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "git add -- frontend/src/runtime/state.ts frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts frontend/src/runtime/card/effect/resize-selected-card.ts frontend/src/runtime/gesture/controller/handle-pointer-down.ts frontend/src/runtime/gesture/controller/handle-pointer-move.ts frontend/src/runtime/gesture/controller/handle-pointer-up.ts frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts frontend/src/runtime/ledger/effect/load-active-ledger-state.ts frontend/src/runtime/ledger/helper/active-ledger-geometry.ts frontend/src/runtime/ledger/helper/current-ledger-state-id.ts frontend/src/runtime/refresh/controller/refresh-runtime-state.ts frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts frontend/src/runtime/selection/effect/move-selected.ts frontend/src/runtime/selection/helper/clone-selection-state.ts frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts frontend/src/runtime/selection/helper/selection-states-equal.ts frontend/src/runtime/zone/effect/resize-selected-zone.ts frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/input-controller-routing.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/selection-direct-card-click.integration.test.ts package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
git diff --cached --check
git diff --cached --stat
git status --short | sed -n '1,120p'"`
Status: completed
Exit code: 0

````text
 .../canvas/effect/render-canvas-control-overlay.ts |  20 +-
 .../runtime/card/effect/resize-selected-card.ts    |  34 +-
 .../gesture/controller/handle-pointer-down.ts      |  12 +
 .../gesture/controller/handle-pointer-move.ts      |   2 +-
 .../gesture/controller/handle-pointer-up.ts        |   5 +-
 .../helper/create-pointer-selection-snapshot.ts    |  20 +
 .../helper/resolve-current-pointer-target.ts       |  24 +
 .../effect/commit-selected-ledger-geometry.ts      |  14 +-
 .../ledger/effect/load-active-ledger-state.ts      |  22 +-
 .../ledger/helper/active-ledger-geometry.ts        |  16 +-
 .../ledger/helper/current-ledger-state-id.ts       |   9 +
 .../refresh/controller/refresh-runtime-state.ts    |   5 +-
 .../effect/subscribe-ledger-content-events.ts      |  10 +-
 .../src/runtime/selection/effect/move-selected.ts  |  40 +-
 .../selection/helper/clone-selection-state.ts      |  16 +
 .../helper/prune-selection-to-active-ledger.ts     |  24 +
 .../selection/helper/selection-states-equal.ts     |  20 +
 frontend/src/runtime/state.ts                      |  12 +
 .../runtime/zone/effect/resize-selected-zone.ts    |  31 +-
 ...ctive-ledger-zone-lifecycle.integration.test.ts |  69 ++
 .../canvas-pan-performance.integration.test.ts     | 613 ++++++++++++++++-
 .../drag-release-freeze.integration.test.ts        | 726 +++++++++++++++++++--
 .../input-controller-routing.integration.test.ts   |   2 +-
 .../ledger-content-refresh.integration.test.ts     | 224 ++++++-
 ...selection-direct-card-click.integration.test.ts |   4 +-
 package-lock.json                                  |  84 +++
 package.json                                       |   4 +-
 ...-canvas-continuity-during-operator-work.spec.ts | 230 ++++++-
 28 files changed, 2160 insertions(+), 132 deletions(-)
 M .decision-os/cards/skills/card-skill-executor-implement.md
 M .decision-os/cards/skills/card-skill-executor-spec.md
 M .decision-os/cards/skills/card-skill-feature-analyzer.md
 M .decision-os/ledgers-canvas.json
 M .decision-os/runs/codex-skills/skills/codex-skill-1783500587763-e734fec7.jsonl
 M .decision-os/runs/codex-skills/skills/codex-skill-1783500587763-e734fec7.log
 M .decision-os/runs/codex-skills/skills/codex-skill-1783500587763-e734fec7.md
 M .decision-os/runs/codex-skills/skills/codex-skill-1783503301885-0800fad0.jsonl
 M .decision-os/runs/codex-skills/skills/codex-skill-1783503301885-0800fad0.md
 M .decision-os/runs/codex-skills/skills/codex-skill-1783596089570-85eceea5.md
 M .decision-os/skills.json
 M .decision-os/state.json
 M .decision-os/tasks-system.json
 M .decision-os/threads/skills/thread-card-c48369dc-1d97-4c6c-ab36-fd01d819d03a.md
 M .decision-os/threads/skills/thread-card-skill-executor-implement.md
 M .decision-os/threads/skills/thread-card-skill-executor-spec.md
 M .decision-os/threads/skills/thread-card-skill-feature-analyzer.md
 M .decision-os/threads/skills/thread-card-skill-feature-planner.md
 M .decision-os/threads/skills/thread-card-skill-implementation-orchestrator.md
 M .decision-os/threads/skills/thread-card-skill-ticket-solver.md
 M .decision-os/threads/tasks-system/thread-card-codex-skill-1783429520950-bad8c87c.md
M  frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts
M  frontend/src/runtime/card/effect/resize-selected-card.ts
M  frontend/src/runtime/gesture/controller/handle-pointer-down.ts
M  frontend/src/runtime/gesture/controller/handle-pointer-move.ts
M  frontend/src/runtime/gesture/controller/handle-pointer-up.ts
A  frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
A  frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts
M  frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts
M  frontend/src/runtime/ledger/effect/load-active-ledger-state.ts
M  frontend/src/runtime/ledger/helper/active-ledger-geometry.ts
A  frontend/src/runtime/ledger/helper/current-ledger-state-id.ts
M  frontend/src/runtime/refresh/controller/refresh-runtime-state.ts
M  frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts
M  frontend/src/runtime/selection/effect/move-selected.ts
A  frontend/src/runtime/selection/helper/clone-selection-state.ts
A  frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
A  frontend/src/runtime/selection/helper/selection-states-equal.ts
M  frontend/src/runtime/state.ts
M  frontend/src/runtime/zone/effect/resize-selected-zone.ts
M  frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
M  frontend/test/runtime/canvas-pan-performance.integration.test.ts
M  frontend/test/runtime/drag-release-freeze.integration.test.ts
M  frontend/test/runtime/input-controller-routing.integration.test.ts
M  frontend/test/runtime/ledger-content-refresh.integration.test.ts
M  frontend/test/runtime/selection-direct-card-click.integration.test.ts
A  package-lock.json
M  package.json
M  tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
?? .decision-os/bugs.json
?? .decision-os/cards/bugs/
?? .decision-os/cards/skills/card-5f44b483-86f4-4144-a497-b5e88bea52b8.md
?? .decision-os/cards/skills/card-98070d2c-e147-47b4-b2dd-616a38aaa28d.md
?? .decision-os/cards/skills/card-b1ccfc6f-dbda-409c-949d-b6f5a1caf4c9.md
?? .decision-os/cards/skills/card-bc15e93f-febb-4ca2-be92-9927f628c5ed.md
?? .decision-os/cards/skills/card-skill-code-quality-report.md
?? .decision-os/cards/skills/card-skill-implementation-worker.md
?? .decision-os/cards/skills/card-skill-quality-improvement-orchestrator.md
?? .decision-os/cards/skills/card-skill-quality-improvement-worker.md
?? .decision-os/cards/skills/card-skill-root-cause-analysis.md
?? .decision-os/cards/skills/card-skill-task-dependency.md
?? .decision-os/cards/skills/card-skill-task-group-completeness.md
?? .decision-os/cards/skills/card-skill-task-list.md
?? .decision-os/cards/skills/card-skill-test-failure-attribution.md
?? .decision-os/cards/tasks-system/card-5483453a-172e-44cb-9f25-3d9ad69c36cf.md
?? .decision-os/cards/tasks-system/card-83a2bf48-f8b7-4d7a-b566-b6133b1520c8.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443352880-df6faf0b.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443977270-47f9133f.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783496502245-a5e66232.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783502837104-b19e9e59.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783530524112-61491e77.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783577864069-8ee729ab.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783577881108-c8db844f.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783588674300-560cc5db.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783590897494-9dd2d021.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783591708289-5fd90c7c.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783595913386-e48acfb6.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783611545211-2a80d2ff.md
?? .decision-os/cards/tasks-system/card-e2cfbc8b-5c26-4fd1-a68d-0f2bd10cb885.md
?? .decision-os/cards/ux/
?? .decision-os/runs/codex-skills/bugs/
?? .decision-os/runs/codex-skills/skills/codex-skill-1783502442976-6a35722a.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783502442976-6a35722a.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783502442976-6a35722a.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503287807-7f582d60.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503287807-7f582d60.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503287807-7f582d60.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503513198-b5b9a85e.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503513198-b5b9a85e.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783503513198-b5b9a85e.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504256943-c9bea42a.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504256943-c9bea42a.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504256943-c9bea42a.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504259043-dfa18c30.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504259043-dfa18c30.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783504259043-dfa18c30.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783518893695-4bd58a9d.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783518893695-4bd58a9d.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783518893695-4bd58a9d.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783575881639-ff6eb75e.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783575881639-ff6eb75e.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783575881639-ff6eb75e.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783583923095-6b27daee.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783583923095-6b27daee.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783583923095-6b27daee.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783589922957-864e7bb8.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783589922957-864e7bb8.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783589922957-864e7bb8.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783591962144-75235572.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783591962144-75235572.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783591962144-75235572.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783595986671-340f42bc.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783595986671-340f42bc.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783595986671-340f42bc.md
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596089570-85eceea5.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596089570-85eceea5.log
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596093573-a037eeea.jsonl
?? .decision-os/runs/codex-skills/skills/codex-skill-1783596093573-a037eeea.log
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-80","timestamp":"2026-07-10T04:43:35.015Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"80","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_42","codexTool":"/usr/bin/zsh -lc 'git commit -m \"Preserve canvas gesture identity across refresh\"'"} -->

**Tool call** `/usr/bin/zsh -lc 'git commit -m "Preserve canvas gesture identity across refresh"'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-81","timestamp":"2026-07-10T04:43:35.015Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"81","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_42","codexTool":"/usr/bin/zsh -lc 'git commit -m \"Preserve canvas gesture identity across refresh\"'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git commit -m "Preserve canvas gesture identity across refresh"'`
Status: completed
Exit code: 0

````text
[main 1d09580] Preserve canvas gesture identity across refresh
 28 files changed, 2160 insertions(+), 132 deletions(-)
 create mode 100644 frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
 create mode 100644 frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts
 create mode 100644 frontend/src/runtime/ledger/helper/current-ledger-state-id.ts
 create mode 100644 frontend/src/runtime/selection/helper/clone-selection-state.ts
 create mode 100644 frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
 create mode 100644 frontend/src/runtime/selection/helper/selection-states-equal.ts
 create mode 100644 package-lock.json
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-82","timestamp":"2026-07-10T04:43:51.017Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"82","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_43","codexTool":"/usr/bin/zsh -lc 'test ! -e .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md && echo target-absent\nsha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\ngit show --stat --oneline --summary 1d09580\ngit status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'test ! -e .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md && echo target-absent
sha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
git show --stat --oneline --summary 1d09580
git status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-83","timestamp":"2026-07-10T04:43:51.017Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"83","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_43","codexTool":"/usr/bin/zsh -lc 'test ! -e .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md && echo target-absent\nsha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\ngit show --stat --oneline --summary 1d09580\ngit status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'test ! -e .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md && echo target-absent
sha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
git show --stat --oneline --summary 1d09580
git status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts'`
Status: completed
Exit code: 0

````text
d4d45cc997f01679baf4d2065957343e104573a581c8dfaba004a9463fe9469c  .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
1d09580 Preserve canvas gesture identity across refresh
 .../canvas/effect/render-canvas-control-overlay.ts |  20 +-
 .../runtime/card/effect/resize-selected-card.ts    |  34 +-
 .../gesture/controller/handle-pointer-down.ts      |  12 +
 .../gesture/controller/handle-pointer-move.ts      |   2 +-
 .../gesture/controller/handle-pointer-up.ts        |   5 +-
 .../helper/create-pointer-selection-snapshot.ts    |  20 +
 .../helper/resolve-current-pointer-target.ts       |  24 +
 .../effect/commit-selected-ledger-geometry.ts      |  14 +-
 .../ledger/effect/load-active-ledger-state.ts      |  22 +-
 .../ledger/helper/active-ledger-geometry.ts        |  16 +-
 .../ledger/helper/current-ledger-state-id.ts       |   9 +
 .../refresh/controller/refresh-runtime-state.ts    |   5 +-
 .../effect/subscribe-ledger-content-events.ts      |  10 +-
 .../src/runtime/selection/effect/move-selected.ts  |  40 +-
 .../selection/helper/clone-selection-state.ts      |  16 +
 .../helper/prune-selection-to-active-ledger.ts     |  24 +
 .../selection/helper/selection-states-equal.ts     |  20 +
 frontend/src/runtime/state.ts                      |  12 +
 .../runtime/zone/effect/resize-selected-zone.ts    |  31 +-
 ...ctive-ledger-zone-lifecycle.integration.test.ts |  69 ++
 .../canvas-pan-performance.integration.test.ts     | 613 ++++++++++++++++-
 .../drag-release-freeze.integration.test.ts        | 726 +++++++++++++++++++--
 .../input-controller-routing.integration.test.ts   |   2 +-
 .../ledger-content-refresh.integration.test.ts     | 224 ++++++-
 ...selection-direct-card-click.integration.test.ts |   4 +-
 package-lock.json                                  |  84 +++
 package.json                                       |   4 +-
 ...-canvas-continuity-during-operator-work.spec.ts | 230 ++++++-
 28 files changed, 2160 insertions(+), 132 deletions(-)
 create mode 100644 frontend/src/runtime/gesture/helper/create-pointer-selection-snapshot.ts
 create mode 100644 frontend/src/runtime/gesture/helper/resolve-current-pointer-target.ts
 create mode 100644 frontend/src/runtime/ledger/helper/current-ledger-state-id.ts
 create mode 100644 frontend/src/runtime/selection/helper/clone-selection-state.ts
 create mode 100644 frontend/src/runtime/selection/helper/prune-selection-to-active-ledger.ts
 create mode 100644 frontend/src/runtime/selection/helper/selection-states-equal.ts
 create mode 100644 package-lock.json
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-84","timestamp":"2026-07-10T04:43:57.016Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"84","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_44","codexTool":"/usr/bin/zsh -lc \"ls -l .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true\nsed -n '1,240p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true\nstat -c '%y %s' .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\""} -->

**Tool call** `/usr/bin/zsh -lc "ls -l .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true
sed -n '1,240p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true
stat -c '%y %s' .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-85","timestamp":"2026-07-10T04:43:57.016Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"85","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_44","codexTool":"/usr/bin/zsh -lc \"ls -l .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true\nsed -n '1,240p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true\nstat -c '%y %s' .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "ls -l .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true
sed -n '1,240p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md 2>/dev/null || true
stat -c '%y %s' .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md"`
Status: completed
Exit code: 0

````text
-rw-rw-r-- 1 jbb jbb 1 Jul 10 11:35 .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md

2026-07-10 00:11:26.210998306 +0700 8409
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-86","timestamp":"2026-07-10T04:44:23.017Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"86","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_45"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-87","timestamp":"2026-07-10T04:44:23.017Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"87","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_45"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-88","timestamp":"2026-07-10T04:44:29.017Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"88","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_46","codexTool":"/usr/bin/zsh -lc \"sed -n '1,280p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md\nsha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\ngit add -- .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md\ngit diff --cached --check\ngit diff --cached --stat\ngit status --short .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md .decision-os/bugs.json\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,280p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
sha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
git add -- .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
git diff --cached --check
git diff --cached --stat
git status --short .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md .decision-os/bugs.json"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-89","timestamp":"2026-07-10T04:44:29.017Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"89","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_46","codexTool":"/usr/bin/zsh -lc \"sed -n '1,280p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md\nsha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\ngit add -- .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md\ngit diff --cached --check\ngit diff --cached --stat\ngit status --short .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md .decision-os/bugs.json\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,280p' .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
sha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
git add -- .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
git diff --cached --check
git diff --cached --stat
git status --short .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md .decision-os/bugs.json"`
Status: completed
Exit code: 0

````text
## A. Scope

1. **Source reviewed.** The complete implementation report in `card-codex-skill-1783614296635-41b41034` was used to identify the runtime, test, browser, and package files changed by this iteration.
2. **Action completed.** The modified implementation was inspected, corrected in place, verified, and committed without editing the source card or `.decision-os/bugs.json`.
3. **Result.** The refresh-safe gesture behavior remains intact, while selection ownership, remounted-target resolution, comments, and source-contract tests now follow the repository architecture more clearly.

---

## B. Findings

1. **State ownership defect.** `frontend/src/runtime/state.ts` contained selection normalization, cloning, equality, pointer-snapshot creation, and pointer restoration behavior in addition to runtime values.
2. **Domain placement defect.** Same-ledger selection pruning was implemented inside `frontend/src/runtime/ledger/helper/active-ledger-geometry.ts`, although it owns selection validity rather than geometry.
3. **Duplicate implementation.** Card and zone resize effects independently implemented live-node lookup and CSS selector escaping for remounted pointer targets.
4. **Hidden state mutation.** `moveSelected()` temporarily replaced `state.selection` while rendering movement overlays, creating an unnecessary global mutation inside an effect path.
5. **Documentation drift.** Several changed runtime and test files lacked the required `WHAT`/`WHY` file headers, and the new high-value branches did not explain their behavior and constraint.
6. **Test contract drift.** Existing source-inspection tests still expected the old zero-argument geometry commit and control-overlay signatures after the implementation introduced explicit gesture selection.

---

## C. Corrections

1. **Selection helpers.** Selection cloning, equality, and active-ledger pruning now live in focused files under `frontend/src/runtime/selection/helper/`.
2. **Gesture helpers.** Pointer selection snapshot creation and remounted target resolution now live under `frontend/src/runtime/gesture/helper/`; current ledger identity now lives in `frontend/src/runtime/ledger/helper/current-ledger-state-id.ts`.
3. **Shared target resolution.** `resizeSelectedCard()` and `resizeSelectedZone()` now call one `resolveCurrentPointerTarget()` contract for saved, detached, id-mismatched, and remounted nodes.
4. **Explicit overlay input.** `renderCanvasControlOverlay()` accepts an explicit selection, so `moveSelected()` renders gesture controls without assigning to global `state.selection`.
5. **State separation.** `frontend/src/runtime/state.ts` now defines runtime selection types and initializes state; selection algorithms and gesture behavior are no longer stored there.
6. **Comments.** All iteration-touched TypeScript files have `WHAT`/`WHY` headers, and the new selection, refresh, empty-commit, resize-clamp, and remount branches document their purpose and constraint.
7. **Test maintenance.** The affected source-contract assertions now verify `commitSelectedLedgerGeometry(gestureSelection)` and `renderCanvasControlOverlay(selection)`.
8. **Package reproducibility.** Root `package-lock.json` records the browser dependency declared in `package.json`.

---

## D. Verification

1. **Focused runtime suite.** `node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts frontend/test/runtime/drag-release-freeze.integration.test.ts frontend/test/runtime/ledger-content-refresh.integration.test.ts frontend/test/runtime/canvas-pan-performance.integration.test.ts` passed `28/28`.
2. **Affected contract suite.** The input routing, ledger geometry, zone overlay, direct-card-click, and card-resize tests passed `11/11`.
3. **Browser proof.** The focused refresh interaction spec passed `1/1` and retained the dragged card id in the final `patch-geometry` payload.
4. **Type safety.** `npm run typecheck:frontend` exited `0` after the quality corrections.
5. **Package metadata.** `npm ci --dry-run --ignore-scripts` exited `0`.
6. **Whitespace.** `git diff --cached --check` exited `0` before the implementation commit.

---

## E. Broader Suite Finding

1. **Repository-wide command.** `npm test --prefix frontend` executed `240` tests: `167` passed and `73` files failed during module loading with `ERR_MODULE_NOT_FOUND` for `@frontend/telemetry`.
2. **Attribution.** The failing files abort before their test bodies run; the iteration's required suites and every directly affected supplemental suite pass independently.
3. **Scope status.** The alias-resolution failure is a verified repository-level test-runner blocker and was not changed because it is outside this source card.

---

## F. Commit

1. **Implementation commit.** `1d09580` — `Preserve canvas gesture identity across refresh`.
2. **Commit scope.** The commit contains the implementation, quality corrections, regression coverage, browser proof, and browser dependency lockfile. Unrelated Decision OS workspace changes were excluded.

---

## G. Status

1. **Result.** `CODE_QUALITY_COMPLETE`.
2. **Scoped blockers.** None.
d4d45cc997f01679baf4d2065957343e104573a581c8dfaba004a9463fe9469c  .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
 .../card-codex-skill-1783658144311-18cf0e37.md     | 62 ++++++++++++++++++++++
 1 file changed, 62 insertions(+)
A  .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
?? .decision-os/bugs.json
?? .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-90","timestamp":"2026-07-10T04:44:33.017Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"90","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_47","codexTool":"/usr/bin/zsh -lc 'git commit -m \"Add canvas refresh code quality report\"'"} -->

**Tool call** `/usr/bin/zsh -lc 'git commit -m "Add canvas refresh code quality report"'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-91","timestamp":"2026-07-10T04:44:33.017Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"91","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_47","codexTool":"/usr/bin/zsh -lc 'git commit -m \"Add canvas refresh code quality report\"'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git commit -m "Add canvas refresh code quality report"'`
Status: completed
Exit code: 0

````text
[main 4af4b83] Add canvas refresh code quality report
 1 file changed, 62 insertions(+)
 create mode 100644 .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-93","timestamp":"2026-07-10T04:44:43.018Z","status":"in_progress","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"93","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_48","codexTool":"/usr/bin/zsh -lc 'git log -2 --oneline\ngit status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md\nsha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\ngit show HEAD:.decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md | tail -12'"} -->

**Tool call** `/usr/bin/zsh -lc 'git log -2 --oneline
git status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
sha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
git show HEAD:.decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md | tail -12'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-94","timestamp":"2026-07-10T04:44:43.018Z","status":"completed","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"94","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_48","codexTool":"/usr/bin/zsh -lc 'git log -2 --oneline\ngit status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md\nsha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md\ngit show HEAD:.decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md | tail -12'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git log -2 --oneline
git status --short -- frontend/src/runtime frontend/test/runtime package.json package-lock.json tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts .decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md
sha256sum .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md
git show HEAD:.decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md | tail -12'`
Status: completed
Exit code: 0

````text
4af4b83 Add canvas refresh code quality report
1d09580 Preserve canvas gesture identity across refresh
d4d45cc997f01679baf4d2065957343e104573a581c8dfaba004a9463fe9469c  .decision-os/cards/bugs/card-codex-skill-1783614296635-41b41034.md

## F. Commit

1. **Implementation commit.** `1d09580` — `Preserve canvas gesture identity across refresh`.
2. **Commit scope.** The commit contains the implementation, quality corrections, regression coverage, browser proof, and browser dependency lockfile. Unrelated Decision OS workspace changes were excluded.

---

## G. Status

1. **Result.** `CODE_QUALITY_COMPLETE`.
2. **Scoped blockers.** None.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-95","timestamp":"2026-07-10T04:44:50.476Z","status":"Codex message","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"95","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_49"} -->

Completed the code-quality pass and wrote the operator result to [the requested card](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/bugs/card-codex-skill-1783658144311-18cf0e37.md).

Key results:

- Extracted focused selection and gesture helpers.
- Removed hidden global selection mutation.
- Consolidated remounted resize-target resolution.
- Focused runtime tests passed `28/28`.
- Affected supplemental tests passed `11/11`.
- Browser proof passed `1/1`.
- Frontend typecheck passed.
- Commits: `1d09580` and `4af4b83`.

The source card and ledger JSON were not edited. The card documents the separate `@frontend/telemetry` full-suite alias blocker.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783658144311-18cf0e37-line-97","timestamp":"2026-07-10T04:44:50.476Z","status":"complete","codexRunId":"codex-skill-1783658144311-18cf0e37","codexLine":"97","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.
