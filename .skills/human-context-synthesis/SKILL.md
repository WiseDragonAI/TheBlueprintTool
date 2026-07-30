---
name: human-context-synthesis
description: Turn source-backed facts into concise human-readable context for a specific audience. Use when Codex must synthesize a corpus, extraction register, card, report, repo notes, PRD discovery, documentation, or feature inventory into a reader-facing summary about what the subject is for, what people can do with it, how they use it, key features, controls, workflows, surfaces, affordances, and only the supporting system facts that matter to that reader.
---

# Human Context Synthesis

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

## Job

Convert extracted or source-visible facts into an essential human report.

Keep the report:

- source-bound;
- audience-specific;
- focused on use, value, and continuation;
- concise enough to read without re-analysis.

## Workflow

1. **Lock the source.** Name the allowed source set. Use only that set unless the user asks for wider research.
2. **Lock the reader.** Name the reader, what they need to understand, and what they need to do next.
3. **Extract usable facts.** Pull purpose, capabilities, workflows, controls, surfaces, spatial model, content types, roles, handoffs, and use constraints.
4. **Select by reader value.** Keep facts that help the reader understand, use, judge, or continue the subject.
5. **Write the report.** Group facts into reader questions, not internal taxonomy.
6. **Check for drift.** Delete anything true-but-useless, off-source, or more technical than the reader needs.

## Audience Lens

| Reader | Promote | Demote |
|---|---|---|
| Operator or end user | purpose, capabilities, workflows, controls, shortcuts, visible surfaces, spatial model, content they manipulate, decisions they own | storage paths, repo layout, implementation internals, test commands, agent mechanics |
| Product owner | user value, main workflows, active capabilities, product boundaries, adoption or decision signals | low-level APIs, build details, file ownership |
| Developer | architecture, data flow, APIs, state ownership, source paths, tests, constraints | broad value claims, marketing phrasing |
| Agent | task boundary, source policy, handoffs, editable files, acceptance signals | product explanation already obvious from the task |

## Feature Extraction

Before summarizing, create a small internal register of source-backed usable facts.

Each item needs:

- a normalized statement;
- a type: `purpose`, `spatial_model`, `surface`, `feature`, `action`, `workflow`, `control`, `content_type`, `handoff`, `role`, or `use_constraint`;
- source pointer;
- importance: `primary`, `supporting`, or `detail`.

For operator or end-user reports, missing source-mentioned controls, shortcuts, visible features, or spatial behavior is a failure.

## Selection Gate

Keep a fact when it answers at least one question:

1. **Purpose:** what is this for?
2. **Capability:** what can the reader do with it?
3. **Workflow:** how does the reader use it?
4. **Control or surface:** where does it happen, or what input triggers it?
5. **Continuation:** what must the reader decide or do next?

Drop a fact when it is only:

- true but not useful to the reader;
- implementation detail for a non-developer;
- stale status or current-work noise;
- a count, KPI, or inventory number with no source-backed reader value;
- an agent/process detail that does not change the reader's action.

## Report Shape

Use sections that answer the reader's natural questions. Prefer:

1. **What is it for?**
2. **What can the reader do?**
3. **How is the workspace, object, or process shaped?**
4. **How does the reader use it?**
5. **What controls, shortcuts, or entry points matter?**
6. **What content, surfaces, or handoffs matter?**
7. **What decisions or constraints affect use?**

Omit sections that the source does not support. Do not add decorative labels, dashboards, scores, counts, or "first read" style framing unless the source or user asks for them.

## Reading Format

Use compact blocks:

- 3 to 4 bullets is ideal;
- 5 bullets is the maximum;
- each bullet carries one idea;
- sentences stay short;
- **bold** marks the human-facing claim;
- `backticks` mark paths, routes, commands, UI labels, object names, and concrete system terms.

For Markdown cards, use numbered sections, `---` separators, and numbered bullets.

Keep evidence visible but secondary: use compact source refs, footnotes, or an evidence index instead of burying the report in citations.

## Final Check

Before finishing, verify:

- every important claim is supported by the allowed source set;
- the first section explains what the subject is for;
- operator/end-user reports foreground features, workflows, controls, surfaces, and spatial model;
- no section exceeds 5 bullets;
- no important source-mentioned affordance is missing;
- no section exists only because it sounds generally useful.
