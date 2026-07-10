---
name: implementation-orchestrator
description: Launch implementation subagents from the current task grouping card, write a Group Launch Registry before launching subagents, reference the linked task-list card, append each returned Worker Results report to the output card immediately, continue until 100% of task groups have returned completed worker results, and produce the implementation batch handoff.
---

# Implementation Orchestrator

## A. Scope

1. **Purpose:** Create `Group Launch Registry`, launch **implementation subagents** from the current task grouping output, append each returned `Worker Results` report as **markdown result sections**, continue until **100% of task groups** have returned completed `Worker Results`, and produce `Implementation Batch Handoff`.

---

## B. Required Inputs

1. **Task grouping card:** Read the injected `task-dependency` card as the **task grouping** source for `Independent Task Groups`, `Sequential Gates`, `Collision Risks`, `Ambiguities`, `Readiness`, and `dispatch_notes`.
2. **Task list card:** Locate the linked `task-list` card from the `task-dependency` card and read the full `Task Inventory`.
3. **Source references:** Preserve the source card paths, task ids, group ids, and file references already present in `task-dependency` and `task-list`.
4. **Subagent launcher:** Use available agent tooling that can launch one scoped implementation subagent per ready group.
5. **Completion target:** Treat the full `Independent Task Groups` set as mandatory scope; every `group_id` must finish with `Worker Results` that cover its assigned `task_ids`.

---

## C. Dispatch Workflow

1. **Read grouping:** Read `Independent Task Groups` and `Sequential Gates` from the `task-dependency` card. Do not regroup tasks.
2. **Resolve task list:** Follow the `task-list` reference from the `task-dependency` card and read the `Task Inventory`.
3. **Initialize output card:** Write `Group Launch Registry` before launching any subagent. Include every `group_id` from `Independent Task Groups`, assigned `task_ids`, planned subagent label, launch readiness from `Sequential Gates`, and initial `status`.
4. **Select groups:** Dispatch only groups that are ready under the current `Sequential Gates`.
5. **Create prompt:** Build one subagent prompt per ready group with `group_id`, `task_ids`, the `task-dependency` card path, the `task-list` card path, and the group `dispatch_notes`.
6. **Reference source cards:** Tell the subagent that it must read the referenced cards before editing and use those cards as the source of truth for `target_files`, `target_symbols`, `done_when`, `acceptance checks`, `source references`, and `forbidden scopes`.
7. **Launch subagents:** Launch **one implementation subagent per ready group**, keep each subagent scoped to its assigned group, and update that row in `Group Launch Registry` with the launched subagent label and current `status`.
8. **Collect return:** When a subagent returns, collect its `Worker Results` payload with `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
9. **Write return immediately:** Update that `group_id` row in `Group Launch Registry` and append the returned `Worker Results` as a normal **markdown section** in the output card before the next dispatch, gate advance, status message, and handoff step.
10. **Advance gates:** After returned results are written to the output card, mark completed `group_id` values, re-read `Sequential Gates`, and select the next ready groups.
11. **Continue dispatch:** Repeat `Select groups`, `Create prompt`, `Launch subagents`, `Collect return`, `Write return immediately`, and `Advance gates` until **100% of `Independent Task Groups`** have returned completed `Worker Results`.
12. **Produce handoff:** Produce `Implementation Batch Handoff` only after every `group_id` in `Independent Task Groups` has completed.

---

## D. Subagent Prompt Contract

1. **Context:** Include `group_id`, `task_ids`, `task-dependency` card path, `task-list` card path, and any upstream `dispatch_notes`.
2. **Reading instruction:** Tell the subagent that it must read both referenced card files before editing code.
3. **Scope instruction:** Tell the subagent to implement only the assigned group tasks from the `Task Inventory`.
4. **Return instruction:** Tell the subagent to return `Worker Results` with `completedTasks` covering every assigned `task_id`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
5. **Task field source:** Use the referenced task grouping and task list cards as the source of truth for `target_files`, `target_symbols`, `done_when`, `acceptance checks`, `source references`, and `forbidden scopes`.

---

## E. Output Contract

1. **`Group Launch Registry`:** List every `group_id` from `Independent Task Groups`, assigned `task_ids`, planned subagent label, launched subagent label, gate readiness, and current `status`.
2. **`Worker Results`:** Collect each subagent return with `group_id`, `task_ids`, `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
3. **`Group Completion Map`:** List every `group_id` from `Independent Task Groups` with assigned `task_ids`, returned `completedTasks`, and final `status`.
4. **`Implementation Batch Handoff`:** Provide the collected `Worker Results`, the final `Group Completion Map`, the referenced `task-dependency` card, and the referenced `task-list` card.
5. **`Operator Blockers`:** Report only blockers that prevent **100% group completion**, including a missing `task-list` reference, unreadable card file, unavailable subagent tooling, ambiguous group mapping, blocked `group_id` values, and blocked `task_ids`.

---

## F. Result Card Writing

1. **First card write:** Create `Group Launch Registry` in the output card before launching the first subagent.
2. **Registry content:** Write `Group Launch Registry` as normal markdown with every `group_id`, assigned `task_ids`, planned subagent label, launched subagent label, gate readiness, and current `status`.
3. **Launch update:** Update the matching `Group Launch Registry` row when a subagent is launched.
4. **Return update:** Update the matching `Group Launch Registry` row and append the returned `Worker Results` report as soon as that subagent finishes its assigned `group_id`.
5. **Markdown section:** Write each worker report as normal markdown under a new section for that `group_id`; do not wrap the report in a fenced code block.
6. **Result content:** Preserve the worker report content that matters for implementation handoff: `group_id`, `task_ids`, `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
7. **Gate ordering:** Write the completed group result section before dispatching any later group that becomes ready from that completion.

---

## G. Hard Rules

1. **No implementation:** Do not implement product code.
2. **No commits:** Do not create commits.
3. **Existing groups:** Use existing `Independent Task Groups`; do not infer new groups and do not move tasks between groups.
4. **Worker scope:** Keep each subagent scoped to its assigned `group_id` and `task_ids`.
5. **No global tests:** Do not run `global tests`.
6. **First visible output:** Write `Group Launch Registry` before launching the first subagent; include all `group_id` values and planned subagent labels.
7. **Immediate card mutation:** Each time a subagent returns, update `Group Launch Registry` and append that group's `Worker Results` section before the next dispatch, gate advance, progress message, and handoff step.
8. **No chat-only status:** A side-channel status message does not satisfy `Result Card Writing`; the output card itself must be modified.
9. **Completion target:** Continue dispatch until **100% of `Independent Task Groups`** have returned completed `Worker Results`.
10. **Stop point:** End with `Implementation Batch Handoff` only after **100% group completion**.
11. **Incomplete output:** When `Operator Blockers` prevent **100% group completion**, name each blocked `group_id`, blocked `task_ids`, and exact missing condition.
12. **Result-only output:** Keep the output card to `Group Launch Registry`, `Worker Results`, `Group Completion Map`, `Implementation Batch Handoff`, and `Operator Blockers`; exclude subagent prompt text and stored prompt references.
13. **No result code blocks:** Do not put worker result reports inside fenced code blocks.
