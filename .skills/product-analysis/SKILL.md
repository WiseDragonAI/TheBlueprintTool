---
name: product-analysis
description: Product analysis from codebase evidence. Use when mapping a goal or need to affected workflow, actor, linked specs, missing specs, and spec gaps without using documentation or inventing evidence.
---

# Product Analysis

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

Read the codebase. Do not use documentation, README files, generated docs, context reports, decision-os ledgers, decision-os cards, or decision-os threads unless the operator explicitly says to use them.

## Output

1. Goal/spec link: goal need, affected product area, affected workflow, affected actor or role, relevant context fact, current behavior, expected behavior, acceptance signal.

2. Linked specs: spec id, title, source, support/constrain/block/conflict/adjacent/non-goal, goal relevance.

3. Missing specs: implied requirement, missing acceptance signal, missing UX spec, missing technical spec, missing data spec, missing operational spec.

4. Spec gaps: contradiction, unknown, unverified fact, source gap, ownership gap, product-boundary decision, technical constraint, UX constraint, data constraint, dependency constraint.

## Rules

- Preserve existing spec IDs and titles.
- Do not invent specs, owners, metrics, or requirements.
- Mark missing evidence as unknown or unverified.
- Do not recommend a path, implementation plan, or approval gate.
