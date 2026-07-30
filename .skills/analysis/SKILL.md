---
name: analysis
description: Launch deep static codebase analysis with a native subagent (not agent mcp), correlate implementation against specs, identify gaps/omissions/drift, and produce a working document with repo intent, current iteration intent, issues, and remediation paths. Use when the user says "agentanalysis" or asks for a full code/spec drift analysis and operator-facing decision summary.
---

# Analysis

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

Execute a repository-wide static analysis using a native subagent (not agent mcp).

## Workflow

1. Spawn a native subagent and assign it deep static analysis coverage over the codebase.
2. Read canonical specs/architecture docs and correlate them with current implementation.
3. Identify and classify:
- Gaps (missing required behavior)
- Omissions (partially implemented or unimplemented scope)
- Drift (implementation no longer matching specification)
4. Create a new working document in the repo that includes:
- Intent of the repository
- Intent of the current iteration
- Full issue list
- Remediation paths per issue
5. Produce a concise, human-readable operator summary focused on decisions and tradeoffs.

## Execution Requirements

- Use only native subagents for analysis; do not use agent-mcp wrappers for core analysis execution.
- Prefer deterministic evidence: file paths, symbols, and behavior deltas tied to specs.
- Keep findings actionable by pairing each issue with a concrete remediation path.
- Keep the final operator summary short and decision-oriented.

## Deliverable Template

Use this structure for the generated working document:

1. Repository Intent
2. Current Iteration Intent
3. Findings
4. Remediation Paths
5. Operator Decision Summary
