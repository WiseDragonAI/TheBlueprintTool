---
name: retrospect-and-close-task
description: Review a completed Decision OS Codex task from its session logs, tool calls, thread, cards, tests, commits, and repository changes; extract and save reusable lessons to centralized Decision OS memory; report the retrospective; complete verified subtasks and master cards; validate ledger state; and commit Decision OS documentation. Use when the operator asks to retrospect, learn from, finalize, validate, archive, or close a completed Decision OS task or Codex session.
---

# Retrospect and Close Task

## Workflow

1. Run `ledger-cli session-context --ledger "$DECISION_OS_LEDGER_FILE" --card-id <master-card-id> --json` once. Read the returned master, thread, linked cards, run output, and every referenced task artifact.
2. Find every matching Codex JSONL under `$HOME/.codex/sessions` using the card ID and run ID. Read all matched events and tool calls. Inspect `git status`, unstaged and staged diffs, and every task commit.
3. Verify each acceptance criterion from concrete logs, tests, runtime results, files, and commits. Stop closeout and report the exact blocker when evidence is missing.
4. Extract only reusable, evidence-backed lessons. Search before saving:

```sh
PROJECT_ID=$(node -p "JSON.parse(require('fs').readFileSync('.decision-os/project.json','utf8')).id")
MEMORY="$HOME/decision-os/tool/memory/memory.mjs"
node "$MEMORY" search --root "$HOME" --project "$PROJECT_ID" --type <type> --query "<keywords>"
node "$MEMORY" add --root "$HOME" --project "$PROJECT_ID" --type <type> --title "<title>" --body "<lesson>" --tag <tag> --subtag <subtag> --source "<evidence>"
node "$MEMORY" list --root "$HOME" --project "$PROJECT_ID" --type <type>
```

5. Never write SQLite directly. Never touch `$HOME/.codex/memories_1.sqlite`. Use type `code` for development lessons and `copywriting` for writing lessons.
6. Summarize evidence, errors, corrections, and saved lessons in the thread with `ledger-cli answer`. Add the concise retrospective to the master card through `ledger-cli mutate`; never edit ledger JSON.
7. For every verified linked task, set its Markdown lifecycle to `#task-complete`, add `Completed at`, synchronize the master subtask projection to `Status: complete`, persist with `ledger-cli mutate`, then run `ledger-cli done` for the task.
8. Run `ledger-cli validate-master-tasks` and `ledger-cli master-task-gate`. Complete the master only when the gate reports `ready: true` with no discrepancies; persist its completed Markdown, run `ledger-cli done`, then validate again.
9. Review `git status --short -- .decision-os`, stage `.decision-os`, and create one final `docs: close <task>` commit. Report the memory records, completed cards, validation result, and commit SHA.
