---
name: code-quality-report
description: Audit implemented code against project quality rules and produce actionable quality findings without changing code. Use after implementation is functionally stable enough to inspect and before quality-improvement-orchestrator plans refactor workers.
---

## A. Purpose

1. **Inspection target:** Audit implemented code for maintainability, ownership, structure, and project-specific quality violations.
2. **Report-only boundary:** Produce a quality report without refactoring code, editing code, or changing behavior.
3. **Pipeline position:** Run after implementation is functionally stable enough to inspect and before `quality-improvement-orchestrator` plans refactor workers.

---

## B. Required Inputs

1. **Implementation evidence:** Read the implementation snapshot, changed-file list, accepted specs, task groups, and verification state.
2. **Repository instructions:** Read local repository instructions such as `AGENTS.md`.
3. **Quality criteria:** Read available Executor, Master Ledger, or project quality criteria when they are part of the source material.

---

## C. Workflow

1. **Changed-file inspection:** Inspect changed files and adjacent ownership boundaries.
2. **Structure review:** Check file organization, directory placement, naming, imports, dependency direction, and module boundaries.
3. **Size threshold review:** Flag files over `300` lines or local threshold equivalents when they indicate ownership conflation.
4. **Local-rule review:** Check controllers, helpers, effects, components, tests, comments, and telemetry against local rules.
5. **Expense review:** Identify expensive operations performed for more elements than needed.
6. **Fix classification:** Separate required fixes from optional cleanup.
7. **Candidate grouping:** Group findings into independent improvement candidates for the `quality-improvement-orchestrator`.

---

## D. Output Contract

1. **`Quality Summary`:** State overall risk and whether quality work is required.
2. **`Findings`:** Include finding id, severity, file path, evidence, violated rule, and impact.
3. **`Improvement Candidates`:** Group findings that can be fixed independently.
4. **`Do Not Change`:** List behavior or files that must remain untouched.
5. **`Verification Needed`:** List tests or checks required after quality changes.

---

## E. Hard Rules

1. **No code edits:** Do not edit code while running this skill.
2. **Evidence requirement:** Do not create broad style complaints without concrete file evidence.
3. **Critical severity threshold:** Do not mark a finding `critical` unless it threatens correctness, maintainability, or future implementation safety.
4. **Smallest sufficient correction:** Do not recommend a rewrite when a smaller ownership correction solves the issue.
