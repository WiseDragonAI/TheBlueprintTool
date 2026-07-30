---
name: over-engineering-analysis
description: Analyze implementation plans for over-engineering, unnecessary persistence models, speculative state objects, redundant indexes or manifests, and architecture bloat before coding. Use when reviewing feature designs, backend/frontend data flow, persistence choices, polling/status systems, or when the operator challenges complexity with phrases like "why create a new object", "simpler solution", "infer all the data", "same result", "re-assess", or "over-engineering".
---

# Over-Engineering Analysis

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

Use this skill to challenge proposed architecture before implementation. Prefer the smallest design that satisfies the behavior while preserving correctness, recovery needs, and existing source-of-truth boundaries.

## Workflow

1. Restate the required user-visible behavior in one sentence.
2. Identify existing durable anchors, IDs, files, routes, logs, events, and runtime state that already describe the behavior.
3. For each proposed new object, model, manifest, table, cache, index, or state store, ask:
   - What exact question does this object answer?
   - Can that answer be inferred from an existing anchor?
   - Does this object add correctness, restart recovery, auditability, or performance that the simpler design cannot provide?
   - What new synchronization invariant does this object create?
4. Remove any new object that only mirrors fields already present in an existing card, session id, log file, thread, process runtime, route parameter, or ledger relationship.
5. Keep an extra model only when it owns a distinct invariant that cannot be derived safely or cheaply.
6. Present the reassessment directly. Do not defend the bloated proposal.

## Red Flags

- Creating a manifest, registry, or run object that duplicates fields already encoded by a card, session id, ledger id, or file path.
- Persisting status that can be derived from process runtime, JSONL events, stderr, or an existing completion event.
- Adding a durable schema only to make one frontend poll route easier.
- Introducing a second source of truth for relationships already represented in the ledger.
- Building restart recovery, indexing, or query abstraction before the current requirement needs it.
- Using "future extensibility" as the only reason for a new object.

## Response Shape

Lead with the correction:

```text
This is over-engineered. The simpler anchor is <existing source of truth>.
```

Then provide:

- **Remove:** the unnecessary object or layer.
- **Use instead:** the existing anchor and derivation path.
- **Tradeoff:** any real capability lost by not adding the object.
- **Next implementation:** the minimal route/controller/UI change.

## Concrete Failure Case

Agent suggestion, verbatim:

```text
1. **Durable Run Manifest**
   - On `POST /api/codex/skills/process`, write a run manifest beside the JSONL:
     `.decision-os/runs/codex-skills/<ledger>/<runId>.json`
   - Include `runId`, `ledgerId`, `sourceCardId`, `outputCardId`, `threadId: thread-<outputCardId>`, `stdoutFile`, `stderrFile`, `startedAt`, `finishedAt`, `status`, `pid`, `lastPersistedLine`.
```

Operator correction, verbatim:

```text
I dont get why you want to create a new object for run persistence. Since the card widget will be hydrated with the session id, the backend can already infer all the data without need of an additional object. re-assess
```

Correct reassessment:

```text
This is over-engineered. The output card and Codex session id are already the durable anchor.

Remove: the run manifest.
Use instead: cardId + ledgerId + runId to derive the JSONL and stderr paths, parse new lines, infer status, and hydrate the widget.
Tradeoff: restart recovery for "currently running" is weaker unless process liveness can be inferred; completed progress and final output remain available from JSONL and the card thread.
Next implementation: add a polling route that derives run data from the card/session id and persists parsed JSONL events into the card thread idempotently.
```

## Rule

Before proposing a new persisted object, prove why the same result cannot be delivered by deriving from the existing source of truth. If that proof is weak, do not create the object.
