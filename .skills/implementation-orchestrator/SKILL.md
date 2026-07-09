---
name: implementation-orchestrator
description: Launch implementation subagents from a current task grouping card, reference the linked task-list card, collect worker returns, and produce the implementation batch handoff. Use after task grouping is ready and Codex needs to dispatch scoped implementation work without directly editing product code.
---

# Implementation Orchestrator

## A. Scope

1. **Purpose:** Launch **implementation subagents** from the current task grouping output, collect returned `Worker Results`, and produce `Implementation Batch Handoff`.

---

## B. Required Inputs

1. **Task grouping card:** Read the injected `task-dependency` card as the **task grouping** source for `Independent Task Groups`, `Sequential Gates`, `Collision Risks`, `Ambiguities`, `Readiness`, and `dispatch_notes`.
2. **Task list card:** Locate the linked `task-list` card from the `task-dependency` card and read the full `Task Inventory`.
3. **Source references:** Preserve the source card paths, task ids, group ids, and file references already present in `task-dependency` and `task-list`.
4. **Subagent launcher:** Use available agent tooling that can launch one scoped implementation subagent per ready group.

---

## C. Dispatch Workflow

1. **Read grouping:** Read `Independent Task Groups` and `Sequential Gates` from the `task-dependency` card. Do not regroup tasks.
2. **Resolve task list:** Follow the `task-list` reference from the `task-dependency` card and read the `Task Inventory`.
3. **Select groups:** Dispatch only groups that are ready under the current `Sequential Gates`.
4. **Create prompt:** Build one subagent prompt per ready group with `group_id`, `task_ids`, the `task-dependency` card path, the `task-list` card path, and the group `dispatch_notes`.
5. **Reference source cards:** Tell the subagent that it must read the referenced cards before editing and use those cards as the source of truth for `target_files`, `target_symbols`, `done_when`, `acceptance checks`, `source references`, and `forbidden scopes`.
6. **Launch subagents:** Launch **one implementation subagent per ready group** and keep each subagent scoped to its assigned group.
7. **Collect returns:** Collect each returned `Worker Results` payload with `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
8. **Produce handoff:** When launched subagents have returned, produce `Implementation Batch Handoff`.

---

## D. Subagent Prompt Contract

1. **Context:** Include `group_id`, `task_ids`, `task-dependency` card path, `task-list` card path, and any upstream `dispatch_notes`.
2. **Reading instruction:** Tell the subagent that it must read both referenced card files before editing code.
3. **Scope instruction:** Tell the subagent to implement only the assigned group tasks from the `Task Inventory`.
4. **Return instruction:** Tell the subagent to return `Worker Results` with `completedTasks`, `changedFiles`, `blockers`, `assumptions`, and worker notes.
5. **Task field source:** Use the referenced task grouping and task list cards as the source of truth for `target_files`, `target_symbols`, `done_when`, `acceptance checks`, `source references`, and `forbidden scopes`.

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
3. **Existing groups:** Use existing `Independent Task Groups`; do not infer new groups and do not move tasks between groups.
4. **Worker scope:** Keep each subagent scoped to its assigned `group_id` and `task_ids`.
5. **No global tests:** Do not run `global tests`.
6. **Stop point:** End with `Implementation Batch Handoff` after `Worker Results` collection.
