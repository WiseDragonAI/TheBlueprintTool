## A. Why Kept

1. **Best existing ticket implementer.** `ticket-solver` solves an existing GitLab ticket end to end.
2. **Planning before code.** It still creates a working document and full control-flow DAG before implementation.
3. **Use.** Use it after a ticket exists, not at the start of a broad goal.

---

## B. Boundary

1. **Downstream role.** It should consume a prepared ticket, create the working DAG, implement, test, and report evidence.
2. **Not a broad splitter.** It should not replace `executor-spec` for turning broad specs into implementation structure.
3. **Best fit.** Use when the workflow state is already a GitLab issue and the requested outcome is a solved ticket.

---

## C. Ticket Solver Content

```markdown
---
name: ticket-solver
description: Solve GitLab tickets end-to-end in DroidFleet. Use when prompts include solveticket<number> (for example solveticket44), where the numeric suffix is the ticket parameter, or when asked to investigate/fix a specific ticket number with tests and verification.
---

# Ticket Solver

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

Use this prompt template:

`solveticket<number>`

Expanded form:

`solveticket<number> (where <number> is the number used after solveticket): Pull issue <number> using gitlab MCP. If not already in a dedicated worktree, create one; otherwise continue in the current worktree. Create a working document and copy the verbatim WORKING_PROCEDURE_TEMPLATE.md at the beginning of the document. Then analyze the ticket and create a full DAG after the verbatim procedure covering all control-flow steps. Apply the procedure to solve the ticket using this repository's local testing suite (no Hangar local-up prerequisite).`
```

---

## D. Related Ticket Skills

1. **`openticket`.** Useful before `ticket-solver` when the operator has a broad problem and needs a GitLab issue created with requirements, scope, codebase impact intent, dependency blockers, `Ideal Control-flow DAG`, and acceptance checks.
2. **`improveticket`.** Useful before `ticket-solver` when an existing GitLab issue is weak and needs the OpenTicket structure, operator approval, updated issue content, factory-actionable labels, and removal of `improve`.
3. **`ticket/improver`.** Useful before `ticket-solver` when DroidFactory should normalize an `improve` issue and classify it for the feature or bug pipeline.
4. **Boundary.** These three are ticket intake or ticket normalization skills; `ticket-solver` remains the implementation-facing ticket skill in the five-card shortlist.
