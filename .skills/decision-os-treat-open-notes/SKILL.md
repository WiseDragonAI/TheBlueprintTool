---
name: decision-os-treat-open-notes
description: Use when the user says "treat open notes", "treat open notes in <ledger>", "answer open notes", "process unanswered notes", or asks to handle unanswered decision-os threads. Query the ledger in the agent cwd by default, answer pending operator notes, and verify no unanswered notes remain.
---

# decision-os Treat Open Notes

## Purpose

Treat decision-os notes as the operator-to-agent inbox. Find unanswered operator notes in the current workspace ledger, do the requested work, persist the agent answer, and verify completion.

## Default Target

Use the agent shell cwd as the target workspace by default. Look for `.decision-os/` in that cwd first. Do not jump to any other directory unless the user explicitly names it.

If the user names a workspace, ledger, route, tab, or article, use that explicit target. Otherwise, resolve ledgers from the cwd workspace.

Resolve the decision-os runtime repo before using the ledger CLI:

```bash
if [ -n "${DECISION_OS_REPO:-}" ]; then
  DECISION_OS_REPO="$DECISION_OS_REPO"
elif [ -x "bin/ledger-cli.mjs" ]; then
  DECISION_OS_REPO="$(pwd)"
elif git rev-parse --show-toplevel >/dev/null 2>&1 && [ -x "$(git rev-parse --show-toplevel)/bin/ledger-cli.mjs" ]; then
  DECISION_OS_REPO="$(git rev-parse --show-toplevel)"
else
  printf 'Unable to resolve decision-os repo. Set DECISION_OS_REPO or run from a decision-os checkout.\n' >&2
  exit 1
fi
LEDGER_CLI="$DECISION_OS_REPO/bin/ledger-cli.mjs"
```

## Resolve Ledgers

Start from:

```bash
pwd
find .decision-os -maxdepth 1 -type f -name '*.json' -print
```

Prefer `.decision-os/state.json` for active tabs/routes when it exists. If the user names a ledger, match the name against state entries and `.decision-os/*.json` filenames. If no ledger is named, query the active/default ledger from state; if state is ambiguous, query all non-state ledger JSON files under `.decision-os/`.

## Query Open Notes

Use the decision-os ledger CLI launcher from the target workspace cwd:

```bash
node "$LEDGER_CLI" unanswered --ledger <ledger-json> --json
```

For human-readable output:

```bash
node "$LEDGER_CLI" unanswered --ledger <ledger-json>
```

The output provides `threadId`, `threadFile`, pending messages, and a suggested answer command. Read the full `threadFile` before answering. Also read the related card content under `.decision-os/cards/...` when the note refers to card content, design state, implementation details, or requested edits.

## Treat Each Note

For every pending operator note:

1. Understand the request from the note, thread history, target card/zone title, and relevant card content.
2. Perform the requested repo or ledger work before replying when the note asks for a change.
3. Update durable card content when the operator requested a design/content change; the thread reply confirms the work, but the card file is the persistent state.
4. Write a concrete answer that closes the request or states the blocker and exact next step.

Avoid generic acknowledgements. Answer the substance of the note.

Never change a card status while treating open notes unless the operator explicitly asks for a status change. Do not mark cards `done`, `todo`, processing, or similar as a side effect of answering a note.

## Durable Card Formatting

Follow the active workspace `AGENTS.md` card-content and formatting rules. This skill does not define a separate section schema.

## Persist Answers

For short plain-text answers, the CLI is acceptable:

```bash
node "$LEDGER_CLI" answer --ledger <ledger-json> --thread-id <thread-id> --message "..."
```

For multi-paragraph answers, markdown tables, code, bullets, or structured content, patch the `threadFile` directly instead of passing content through `--message`. Append exactly one agent section:

```markdown
# AGENT
<!-- decision-os:note {"id":"note-agent-<epoch-ms>-<8-hex>","timestamp":"<ISO-8601>"} -->

Answer markdown here.
```

Use only `# OPERATOR` and `# AGENT` as top-level message headings. Generate a unique note id and current ISO-8601 timestamp. Do not regenerate ledger JSON manually for a thread reply.

## Verify

After answering, rerun:

```bash
node "$LEDGER_CLI" unanswered --ledger <ledger-json>
```

Treat the work as complete only when the relevant ledgers report no unanswered notes, or when remaining notes are explicitly blocked. Report the ledgers checked, thread ids answered, files changed, and any remaining open threads.
