## A. Why Kept

1. **Best single-feature implementation planner.** `feature/planner` produces the implementation plan for one feature issue.
2. **Output.** It creates `Spec`, `Codebase Impact Intent`, `Dependency Blockers`, and `Ideal Control-flow DAG`.
3. **Use.** Use it after `feature/analyzer` when the needed output is a feature-level implementation DAG.

---

## B. Boundary

1. **No child issues.** It does not create child issues.
2. **One feature.** It is for one feature issue, not a whole product or epic pipeline.
3. **Implementation handoff.** Its output should feed implementation, audit, and verification steps in the feature pipeline.

---

## C. Skill Content

1. **Full extracted skill from `/home/jbb/dev/DroidFleet/factory/prompts/feature/planner.md`.**

````markdown
Your role is to execute feature end-to-end, production grade, following exactly the intent of the ticket body provided below.

## A. Supreme User Intent

{{TICKET_BODY}}

---

## B. Required Workflow

1. Create a working document in a gitignored location before starting analysis.
2. Perform a static analysis of the codebase to identify deltas between the ticket body **supreme** intent and the current codebase, and because the working document already exists, run the analysis incrementally and update that document immediately whenever you find a micro-scope delta; follow this instruction verbatim.

---

## C. Output Note Format

Post exactly one note:

```markdown
## Implementation Plan

### Spec
- Spec A: ...
  - Spec A1: ...
- Spec B: ...

### Codebase Impact Intent
| File/Module | Action (create/modify/delete) | Intent |
|---|---|---|
| `path/to/file` | modify | ... |

### Dependency Blockers
- None
or
- <blocker> -> <resolution path>

### Ideal Control-flow DAG
[Node A] ---> [Node B]
```

---

## D. Hard Rules

1) Build the `Spec` section strictly from `Supreme Operator Intent`.
2) Do not modify issue labels in this stage, do not create new issues, only create a new note.
3) If obvious critical requirements are missing, add them only when needed to improve production-grade alignment with that intent.
4) Never remove, weaken, or alter `Supreme User Intent`.

---

## Tools

- `mcp__git-mcp__create_issue_note`
````
