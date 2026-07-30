---
name: openticket
description: Clarify an operator-reported problem, define expected result and control-flow DAG, then open a GitLab issue with a strict, concise report format. Use when the user asks to open/create a ticket from a broad request.
---

# OpenTicket

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

## Mission
Clarify a problem reported by the operator.
Help the operator clearly express the problem and desired result.
When the need is clear, open a GitLab ticket using `gitlab-mcp`.

## Operating mode
- Start from the operator prompt.
- DEEP STATIC ANALYSIS (not a quick scan) to make an inventory of which systems and features are already in place regarding the openticket goal.
- Analysis scope is CODE ONLY. Do not use documentation or tickets as primary analysis input when building the inventory.
- The inventory must explicitly list:
  - existing data models (tables/fields/indexes/constraints relevant to the goal),
  - existing code paths (handlers/services/repos/jobs/middleware) already implementing parts of the goal,
  - missing seams required to complete the goal.
- Ask: "If we need to build the feature the operator is asking, what is the complete control-flow the app must have to support that system?"
- Build the `Ideal Control-flow DAG` from real code inventory, not assumptions.
- Ask only questions that reduce ambiguity on outcome and change surface.
- Draft first, validate with operator, then open the ticket only after explicit operator approval.

## Operator validation gate (mandatory)
- Before creating any GitLab issue, present to operator:
  - the full `Requirements` list (`REQ-*`)
  - the full `Ideal Control-flow DAG`
- Ask for explicit approval to create the issue from that draft.
- If operator requests edits, revise draft and re-present.
- Only call ticket creation tool after operator confirms.

## Ticket sections (exact order)

### 1. Problem Report
- context
- observed problem
- why it matters

### 2. Requirements
- ID-based list, one requirement per line.
- format: `REQ-001: <requirement statement>`

### 3. Scope
- in-scope
- non-scope
- classification: feature or bugfix

### 4. Codebase Impact Intent
- what should be re-used
- what should be created
- what should be modified
- what should be factorized
- minimal change surface

### 5. Dependency blockers (mandatory when applicable)
- what should be created -> If the operator demand rely on a missing system , you must report it as a blocker. e.g. creating a modal for hardware status but we dont have hardware monitoring tool -> we can't create the modal unless we monitor first.
- You must then provide a list of dependencies. The operator will then possibly choose to open one ticket for dependencies.

### 6. Ideal Control-flow DAG
- ideal runtime/control-flow DAG
- include arrows (`->`) and indentation.
- include:
  - `start state`
  - `terminal state`
  - `assumptions`
- use node IDs with actor + action:
  - `N1. <actor> <concrete action>`
  - `D1. <decision check>`

Example DAG style:
```text
N1. Client asks for available live events.
  -> N2. Server gets currently active events.
    -> N3. Server checks each event for this player.
      -> D1. Player is eligible:
        -> N4. Save assigned decision.
          -> N5. Save decision trail.
      -> D2. Player is not eligible:
        -> N6. Save rejected decision.
          -> N7. Save decision trail.
    -> N8. Server builds player-visible events from saved decisions.
      -> N9. Server returns available live events.
```

### 7. Acceptance
- behavioral outcome checks only
- directly traceable to `REQ-*` IDs.
- once specs, requirements, and DAG are drafted, re-assess DEEP STATIC ANALYSIS results to confirm dependency blockers are correctly identified and explicitly listed.

## Writing rule
- dense, concise, meaningful.

## Hard constraints
- Do not write implementation plan details.
- Do not leave hidden assumptions; list assumptions explicitly.
- Do not write unnumbered requirements.
- Do not create the ticket before operator validates requirements + DAG.
