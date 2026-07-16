---
name: task-list
description: Create concise, codebase-grounded task inventories from a clarified Decision OS source card and any run-provided source material. Use after expected behavior is clear and before dependency grouping, orchestration, implementation, or test attribution needs actionable tasks linked to files, symbols, task type, and completion checks.
---

# Task List

## A. Scope

1. **Purpose.** Convert clarified planning material into an actionable task inventory that an engineer or implementation agent can execute without rediscovering the problem.
2. **Start point.** Use this skill only after the operator intent, constraints, and expected behavior are clear enough to split work.
3. **Stop point.** Do not group dependencies, dispatch workers, implement code, run tests, or perform test attribution.

---

## B. Required Inputs

1. **Run source.** Read the source card path passed to the run.
2. **No source filtering.** Do not ignore source material because its kind is not named in this skill.
3. **Codebase grounding.** Inspect the codebase enough to link tasks to real files and symbols.

---

## C. Task Construction

1. **Extract work.** Capture each required behavior change, UI change, data change, test need, fixture, config change, doc change, operation, discovery step, and operator decision.
2. **Discover targets.** Do the additional codebase discovery needed to name target files and symbols before writing the task list.
3. **Create tasks.** Make each task an actionable codebase-linked change, not a research placeholder.
4. **Choose type.** Let the model choose the shortest useful `type`. Common terms include `code`, `test`, `scenario`, `data`, `fixture`, `config`, `docs`, and `ops`, but this list is not exhaustive.
5. **Define completion.** Give every task a concrete `done_when` check that is visible in code review, test output, rendered UI, data state, config, docs, or an operator answer.
6. **Check coverage.** Confirm the task list covers the requested work or state the blocking question.

---

## D. Type Nomenclature

1. **`code`.** Source behavior, UI behavior, API behavior, state handling, or internal logic.
2. **`test`.** Automated verification: unit, integration, end-to-end, regression, or harness work.
3. **`scenario`.** Human-readable behavior path that must be implemented or verified.
4. **`data`.** Schema, migration, seed, backfill, persisted shape, or data contract work.
5. **`fixture`.** Test data, mocks, stubs, snapshots, or repeatable setup data.
6. **`config`.** Environment, build, package, CI, deploy, flag, or tool configuration.
7. **`docs`.** Required developer, operator, or user-facing documentation.
8. **`ops`.** Deploy, monitoring, rollback, manual operation, or release task.

---

## E. Output Contract

1. **`Task Inventory`.** Produce one table with `id`, `type`, `title`, `target_files`, `target_symbols`, `action`, `done_when`, and `depends_on`.
2. **`Open Questions`.** List only operator answers that block a reliable codebase-linked task list.
3. **`Readiness`.** End with `READY_FOR_TASK_DEPENDENCY` or `BLOCKED_NEEDS_OPERATOR_ANSWER`.

---

## F. Hard Rules

1. **No implementation.** Do not edit code.
2. **No verification run.** Do not run tests.
3. **No generic tasks.** Do not write tasks like `update backend`, `fix UI`, or `add tests` without a target or discovery action.
4. **No invented requirements.** Do not add work that is not grounded in source material.
5. **No fake targets.** If the file, symbol, or surface is unknown after discovery, ask a blocking question instead of guessing.
6. **No report bloat.** Do not add rationale paragraphs, strategy essays, or duplicate sections.
