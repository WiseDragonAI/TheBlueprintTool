#master-task

Ledger: Specs
Queue rank: 9

## A. Implemented Result

1. **Flexible content:** `AGENTS.md` now asks for only verified information needed for the next operator decision and requires task-specific section titles instead of a default schema.
2. **Short policy:** the note-treatment skill replaces its eight formatting rules with one reference to the workspace policy.
3. **Single source:** each Decision OS thread run now references the workspace policy instead of repeating a card recipe.
4. **Schema removal:** `master-task-gate` no longer parses or emits a field tied to a literal section name.
5. **Repository state:** implementation commit `b8ef4e2` is merged into `main` by merge commit `e5cce83`; the worktree and feature branch are removed.

---

## B. Verification

1. **Prompt regression:** `1` focused test passed and confirms named default headings are absent from the runtime prompt.
2. **Gate regression:** the gate accepts the task-specific `Current Finding` heading and omits the former named-section field.
3. **Transaction regression:** the planner accepts a child section titled `Implementation Detail`.
4. **Affected ledger cases:** all `3` focused cases passed across the initial run and failed-case rerun.

---
