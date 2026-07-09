---
name: implementation-orchestrator
description: Launch implementation subagents from the current task grouping card, reference the linked task-list card, collect worker returns, and stop before implementation judgment. No code implementation. No commits. No regrouping. No tests. No repair stages.
---

# Implementation Orchestrator

## A. Scope

1. **Purpose:** Launch **implementation subagents** from the current task grouping output and collect their returned results.
2. **Coordination-only role:** The orchestrator is not an `implementation-worker`; it never implements product code and never receives an `implementation-worker` role.
3. **Current naming:** Treat `task-dependency` as the current card name for the **task grouping** output. The intended concept is `task grouping`.
4. **Stage boundary:** Stop after launched subagents return their `Worker Results`. The next stage owns `verification`, `repair`, `test attribution`, and `commit` decisions.

---

## B. Required Inputs

1. **Task grouping card:** Read the injected `task-dependency` card as the **task grouping** source for `Independent Task Groups`, `Sequential Gates`, `Collision Risks`, `Ambiguities`, `Readiness`, and `dispatch_notes`.
2. **Task list card:** Locate the linked `task-list` card from the `task-dependency` card and read the full `Task Inventory`.
3. **Source references:** Preserve the source card paths, task ids, group ids, and file references already present in `task-dependency` and `task-list`.
4. **Subagent launcher:** Use available agent tooling that can launch one scoped implementation subagent per ready group.
5. **Non-input:** Do not require `task-group-completeness`; it is a separate audit task and is not part of this orchestrator contract.

---

## C. Dispatch Workflow

1. **Read grouping:** Read `Independent Task Groups` and `Sequential Gates` from the `task-dependency` card. Do not regroup tasks.
2. **Resolve task list:** Follow the `task-list` reference from the `task-dependency` card and read the `Task Inventory`.
3. **Select groups:** Dispatch only groups that are ready under the current `Sequential Gates`.
4. **Create prompt:** Build one subagent prompt per ready group with `group_id`, `task_ids`, the `task-dependency` card path, the `task-list` card path, and the group `dispatch_notes`.
5. **Reference source cards:** Tell the subagent that it must read the referenced cards before editing. Do not duplicate and do not reinterpret `target_files`, `target_symbols`, `done_when`, `acceptance checks`, `source references`, and `forbidden scopes` in the orchestrator prompt.
6. **Launch subagents:** Launch **one implementation subagent per ready group** and keep each subagent scoped to its assigned group.
7. **Collect returns:** Collect each returned `Worker Results` payload with `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
8. **Stop cleanly:** When launched subagents have returned, produce the orchestrator handoff and stop. Do not decide whether the implementation is finished.

---

## D. Subagent Prompt Contract

1. **Context:** Include `group_id`, `task_ids`, `task-dependency` card path, `task-list` card path, and any upstream `dispatch_notes`.
2. **Reading instruction:** Tell the subagent that it must read both referenced card files before editing code.
3. **Scope instruction:** Tell the subagent to implement only the assigned group tasks from the `Task Inventory`.
4. **Return instruction:** Tell the subagent to return `Worker Results` with `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
5. **No field reconstruction:** Do not restate full `target_files`, `target_symbols`, `done_when`, `acceptance checks`, `source references`, and `forbidden scopes` when those fields already live in the referenced task grouping and task list cards.

---

## E. Output Contract

1. **`Dispatch Plan`:** List launched `group_id` values, assigned `task_ids`, referenced card paths, and subagent identifiers.
2. **`Subagent Prompts`:** Record the exact prompt sent to each subagent and any stored prompt reference.
3. **`Worker Results`:** Collect each subagent return with `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
4. **`Implementation Batch Handoff`:** Provide the collected `Worker Results`, the referenced `task-dependency` card, the referenced `task-list` card, and any gated groups not launched in this stage.
5. **`Operator Blockers`:** Report only blockers that prevent launch and collection, including a missing `task-list` reference, unreadable card file, unavailable subagent tooling, and ambiguous group mapping.

---

## F. Hard Rules

1. **No implementation:** Do not implement product code.
2. **No commits:** Do not create commits.
3. **No regrouping:** Do not alter task groups, infer new groups, and do not move tasks between groups.
4. **No task-field reconstruction:** Do not rebuild `target_files`, `target_symbols`, `done_when`, `acceptance checks`, `source references`, and `forbidden scopes` inside the orchestrator output.
5. **No repair loop:** Do not launch fix workers, run `root-cause-analysis`, run `test-failure-attribution`, and do not decide failure ownership.
6. **No global tests:** Do not run `global tests`.
7. **No completion judgment:** Do not decide whether the implementation is finished; collect returns and hand off to the next stage.
8. **No `task-group-completeness` dependency:** Do not require `task-group-completeness` as an input.
