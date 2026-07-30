---
name: implementation-report
description: Write short human implementation reports after completed, partial, or blocked implementation runs. Use when Codex must summarize implemented specs, fixed bugs, concepts introduced, checks, problems, and lessons learned for an operator.
---

# Implementation Report

## Job

Write a compact, human-facing implementation report. The report must tell an operator which `specs` were implemented, which `bugs` were fixed, which `concepts` were introduced, what was checked, what went wrong, and what was learned.

## Output Shape

1. **Result data:** Present the implemented `specs` and fixed `bugs`.
2. **Change data:** Present meaningful introduced `concepts`, `notions`, `terminology`, `semantics`, states, workflows, controllers, surfaces, and domain rules.
3. **Check data:** Present actual `verification`, passed checks, failed checks, and unrun checks when they change what the operator should know.
4. **Problem data:** Present the current `problems` that matter to the operator.
5. **Lesson data:** Present reusable `lessons`, kept `constraints`, decisions, and cautions from the iteration.

## Workflow

1. **Identify the result:** Name only the implemented `specs` and fixed `bugs`.
2. **Extract concepts:** Identify new `notions`, `concepts`, `terminology`, `semantics`, states, workflows, controllers, surfaces, and domain rules introduced by the implementation.
3. **Record checks:** Record what was actually verified, what failed, what was not run, and which unrelated failures matter to the operator.
4. **Report problems:** Surface relevant `problems` through the problem data instead of creating a separate open-work format.
5. **Keep lessons:** Preserve only reusable implementation lessons, constraints, decisions, and cautions that should influence the next run.

## Formatting Contract

1. **Headings:** Use `H2` card sections with uppercase section letters.
2. **Dividers:** Put `---` horizontal rules between sections.
3. **Lists:** Write section content as numbered lists.
4. **Bold:** Use **bold** for important labels and concepts at the start of list items.
5. **Backticks:** Use `backticks` for technical, secondary, exact, and literal terms: `file paths`, `routes`, `config keys`, `commands`, `IDs`, `statuses`, `branch names`, `code symbols`, and literal `values`.
6. **No machine inventory:** Exclude `task IDs`, `group IDs`, `card IDs`, `source refs`, `file inventories`, `symbol inventories`, `raw logs`, and `worker chronology`.
