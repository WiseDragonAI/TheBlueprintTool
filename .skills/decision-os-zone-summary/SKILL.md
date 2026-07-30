---
name: decision-os-zone-summary
description: Create or update a Decision OS bridge card that summarizes every source card in the same zone as a target card. Use when the user asks for a "Decision OS Zone Summary", "zone summary", "bridge card", "summarize cards in this zone", or wants a reusable card that references other cards in a Decision OS zone without scanning unrelated notes.
---

# Decision OS Zone Summary

## Overview

Create a durable bridge card for a Decision OS zone. The bridge card should let the next operator or process understand what each source card in the zone does without reopening every card first.

## Workflow

1. **Lock the target.** Use the workspace root, ledger file, card id, card markdown path, thread id, and thread markdown path supplied by the user. If the request is scoped to one thread, do not query or treat unrelated open notes.
2. **Read the request source.** Read the full thread markdown and the target card markdown before acting when a thread is supplied. Treat the newest operator note in that scoped thread as the active request.
3. **Resolve the launch card context.** Run `ledger-cli card-context --ledger <ledger-file> --card-id <card-id> --json`. Use the returned `zone.id` as the authoritative zone id for this run.
4. **Resolve source cards.** Run `ledger-cli zone-cards --ledger <ledger-file> --zone-id <zone-id> --json`. Use the returned `cards[]` list as the authoritative source-card set for the zone.
5. **Read source card bodies.** Exclude the target bridge card id from `cards[]` by default because it is the output card, unless the operator explicitly asks to summarize it too. Read each remaining card's `contentFile` markdown. Use card title, card id, status, relationships, and content path as supporting context, but summarize only source-visible facts.
6. **Write the bridge card.** Replace or create the target card markdown with one section per source card. Do not update the target card with later meta-instructions that are about the skill or the process rather than the card content.
7. **Close the scoped thread.** If a thread is supplied, append exactly one final `# AGENT` reply after the work is complete or blocked. For multi-paragraph replies, patch the thread markdown directly.

## Bridge Card Format

1. **Sections:** use `H2` headings only, one section per summarized source card.
2. **Section letters:** prefix each heading with an uppercase section letter, for example `## A. Product Analysis Result`.
3. **Dividers:** put `---` between sections.
4. **List length:** write 3 to 5 numbered items per card.
5. **First item:** make the first item `**Content path:**` followed by the exact card markdown path in backticks.
6. **Labels:** start important items with bold labels such as `**Core request:**`, `**Main gaps:**`, `**Screens to build:**`, or `**Use in next process:**`.
7. **Exact tokens:** use backticks for card paths, routes, statuses, config keys, commands, ids, filenames, and literal values.
8. **Language:** write the bridge content in the user's required output language; if the workspace rules require English, write English.

## Summary Rules

1. **Stay source-bound.** Do not invent implementation details, decisions, APIs, roles, or status changes that are not present in the source cards.
2. **Summarize for continuation.** Prefer facts that help the next process continue: purpose, output, decisions, gaps, acceptance direction, generated assets, and unresolved dependencies.
3. **Keep it simple.** Avoid analysis scaffolding, raw extraction registers, process logs, and long evidence indexes unless the operator explicitly asks for them.
4. **Preserve provenance.** Every section must identify the source card content path. Mention source card ids only when they help disambiguate similar cards.
5. **Respect the chain.** If the zone is a workflow chain, preserve its order from source request through analyses, plans, reviews, mockups, or implementation outputs.

## Safety Rules

1. **Do not change status.** Do not change card status, labels, relationships, geometry, or other structured ledger fields unless the operator explicitly asks.
2. **Do not hand-edit ledger JSON for prose.** Use card markdown files for durable card content and thread markdown files for replies.
3. **Do not scan unrelated notes.** When the task is scoped to one thread or one card, do not run broad unanswered-note treatment.
4. **Do not hand-parse zone geometry.** Use `ledger-cli card-context` and `ledger-cli zone-cards` for zone ownership and zone membership.
5. **Do not use production access.** This skill works on local Decision OS markdown and ledger files only.
6. **Keep unrelated files unchanged.** Edit only the target bridge card, the scoped thread reply, and a run summary if the user supplied one.

## Thread Reply Format

Append one final reply in this format:

```markdown
# AGENT
<!-- decision-os:note {"id":"note-agent-<epoch-ms>-<8-hex>","timestamp":"<ISO-8601>"} -->

Done. I rewrote the bridge card at `<card-content-path>`.

The card now summarizes the `<n>` source cards in the `<zone-label>` zone, excluding the bridge card itself because it is the generated reference card. Each section maps to one source card, includes the card content path, and gives 3 to 5 concrete points for the next process to use.
```

For blocked work, state the blocker and the exact next step instead of saying the task is done.

## Validation

1. **Card shape:** verify every `H2` section maps to one source card and contains 3 to 5 numbered items.
2. **Paths:** verify every section includes the exact `comment.contentFile` path.
3. **Scope:** verify the target bridge card is not included as a source card unless requested.
4. **Thread:** verify the final `note-agent-*` reply appears exactly once and at the end of the scoped thread file when a thread is supplied.
5. **Ledger:** verify no ledger JSON status or geometry changed unless explicitly requested.
