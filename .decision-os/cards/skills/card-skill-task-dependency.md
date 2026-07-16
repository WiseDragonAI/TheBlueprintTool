---
name: task-dependency
description: Analyze a `task-list` inventory and create dependency edges, independent implementation groups, sequential gates, collision risks, and readiness for `task-group-completeness`. Use after `task-list` returns `READY_FOR_TASK_DEPENDENCY` and before implementation grouping is audited.
---

# Task Dependency

## A. Scope

1. **Purpose.** Convert the flat `task-list` inventory into a dependency graph and implementation groups that can be worked independently where the evidence supports it.
2. **Start point.** Use this skill only after the upstream `task-list` output includes `Task Inventory`, `Open Questions`, and `Readiness`.
3. **Readiness gate.** Continue only when the upstream readiness value is `READY_FOR_TASK_DEPENDENCY`.
4. **Stop point.** Do not implement tasks, run tests, judge group completeness, or dispatch implementation workers.

---

## B. Required Inputs

1. **Task inventory.** Read the complete `task-list` output, including every `id`, `type`, `title`, `target_files`, `target_symbols`, `action`, `done_when`, and `depends_on` value.
2. **Source material.** Read any source cards, specs, architecture notes, codebase surface maps, data model notes, runtime state notes, migration notes, fixture notes, and test strategy included with the run.
3. **Codebase evidence.** Inspect the codebase only as needed to verify dependency evidence, shared ownership, file-family collisions, runtime-state coupling, migration order, and test fixture order.

---

## C. Dependency Construction

1. **Seed explicit edges.** Treat each populated `depends_on` value from `task-list` as an explicit dependency edge before inferring additional edges.
2. **Infer required edges.** Add an inferred edge only when file ownership, symbol ownership, data flow, runtime state, migration order, fixture setup, API contract order, or test setup proves that one task must happen before another task.
3. **Classify every edge.** Use exactly one edge type: `hard-blocker`, `shared-file-risk`, `shared-state-risk`, `test-order-risk`, `migration-order-risk`, or `soft-ordering`.
4. **Ground every edge.** Record the concrete evidence for each edge from task fields, source material, file paths, symbols, migrations, fixtures, tests, or runtime state.
5. **Preserve uncertainty.** Put unclear relationships in `Ambiguities` instead of forcing a dependency edge or an implementation group.

---

## D. Group Construction

1. **Place every task.** Put every task in exactly one proposed implementation group unless the task is explicitly blocked by an ambiguity.
2. **Keep collision-prone work together.** Keep tasks in the same group when splitting them would force multiple workers to edit the same file family, state object, migration chain, fixture, scenario setup, or test harness.
3. **Separate independent work.** Split tasks into separate groups only when their target files, target symbols, tests, fixtures, runtime state, and data assumptions can be changed independently.
4. **Respect gates.** Preserve sequential gates between groups when one group creates an API, schema, migration, fixture, state contract, or shared behavior that another group consumes.
5. **Avoid fake parallelism.** Do not optimize for maximum group count when shared-file conflicts would make parallel work unsafe.

---

## E. Output Contract

1. **`Dependency Graph`.** Produce a table with `from_task`, `to_task`, `edge_type`, `reason`, and `evidence`.
2. **`Independent Task Groups`.** Produce a table with `group_id`, `task_ids`, `target_files`, `target_symbols`, `independence_reason`, and `dispatch_notes`.
3. **`Sequential Gates`.** List group-to-group gates with the required completion condition for each downstream group.
4. **`Collision Risks`.** List files, symbols, tests, fixtures, migrations, data models, and runtime state that make parallel work unsafe.
5. **`Ambiguities`.** List only dependency questions that block reliable grouping.
6. **`Readiness`.** End with exactly one readiness value. Use `READY_FOR_TASK_GROUP_COMPLETENESS` when grouping is reliable. Use `BLOCKED_NEEDS_OPERATOR_ANSWER` when an operator answer is required.

---

## F. Hard Rules

1. **No implementation.** Do not edit product code, tests, fixtures, migrations, config, or docs while using this skill.
2. **No test runs.** Do not run verification commands while creating the dependency graph.
3. **No invented tasks.** Do not create implementation tasks; report missing or unsafe work as an ambiguity for the next gate.
4. **No hidden blockers.** Do not put an ambiguous task into a group just to make every task appear dispatchable.
5. **No duplicate placement.** Do not place the same task in multiple implementation groups.
6. **No generic rationale.** Keep output concrete and limited to edges, groups, gates, collision risks, ambiguities, and readiness.
