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
