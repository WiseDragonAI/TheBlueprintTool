---
name: executor-precheck
description: Preflight phase before executor-implement. Goal is to check the master-ledger contains all the necessary information, all specs are
---

# Executor Precheck

The purpose is to verify that the executor pipeline has enough approved truth to begin.

Use this skill before `executor-stack`.

---

## A. Contracts

- **Do not invent Specs.**
- **Do not infer missing Data Model or Runtime State.**
- **Do not start stack analysis.**
- **Do not create Root Blocks.**
- **Do not create domains, tests, inputs, actions, controllers, helpers, effects, state, screens, pages, or components.**
- Only verify what exists, what is missing, and what must be clarified before `executor-stack`.

If a missing item blocks the next phase, ask an operator question.

---

## B. Inputs To Find

Locate and verify:

- operator request
- `Specs`
- `Data Model`
- `Runtime State`
- current repo root
- existing architecture notes, if the operator explicitly says to use them
- `executor-stack` target scope: whole repo, one Root Block, one feature, or one codebase section

Read project specs/data through the CLI ledger tool when present:

```bash
node ./tool/ledger-zones.js inspect specs.json --json
node ./tool/ledger-zones.js inspect data.json --json
```

If paths differ, report the discovered paths.

---

## C. Precheck Output

Create or update a temporary document inside an untracked `tmp` directory under the analysis root.

Name it:

```text
executor-precheck-{YY-MM-DD-N}.md
```

Increase `N` when a file already exists for the date.

The document must contain:

```text
A. Operator Intent
B. Available Truth
C. Missing Truth
D. Scope Boundary
E. Repo Facts
F. Blockers
G. Operator Questions
H. Precheck Decision
```

---

## D. Section Rules

### D.1 Operator Intent

State what the operator asked for using only operator words and approved nomenclature.

### D.2 Available Truth

List each available source:

```js
{
   type: 'Specs | Data Model | Runtime State | operator instruction | repo fact',
   path: 'path or source',
   status: 'available',
   notes: 'short factual note'
}
```

### D.3 Missing Truth

List missing sources that matter for `executor-stack`.

```js
{
   type: 'Specs | Data Model | Runtime State | operator instruction',
   why_needed: 'what next phase cannot safely analyze without it',
   blocking: true
}
```

### D.4 Scope Boundary

Define the requested analysis boundary.

Examples:

```text
whole repo
single Root Block
frontend only
backend only
feature slice
unknown
```

Do not invent the boundary. If it is unclear, ask.

### D.5 Repo Facts

Only record facts needed before `executor-stack`, such as:

- repo root
- package/workspace files
- existing `tmp` or architecture documents
- known ledger files
- obvious Root Block candidates only as facts, not decisions

### D.6 Blockers

Blockers are gaps that prevent safe `executor-stack` execution.

Examples:

- no Specs found
- no Data Model found but Specs require durable data
- Runtime State missing for a requested frontend/app state machine
- requested scope unclear
- operator asks to use existing architecture but path is missing

### D.7 Operator Questions

Ask only questions that unblock `executor-stack`.

Each question must include:

```js
{
   question: 'one direct question for the operator',
   why: 'specific ambiguity or applicability risk',
   source: 'operator instruction, missing file, repo fact, or ledger fact',
   impact: 'what cannot be safely analyzed until answered',
   expected_answer_shape: 'yes/no, provide path, choose scope, provide missing ledger, confirm boundary'
}
```

### D.8 Precheck Decision

End with one decision:

```text
READY_FOR_EXECUTOR_STACK
```

or:

```text
BLOCKED_NEEDS_OPERATOR_ANSWER
```

---

## E. Handoff

If ready, tell the operator the precheck document path and say `executor-stack` can run next.

If blocked, output the operator questions in chat and do not run `executor-stack`.
