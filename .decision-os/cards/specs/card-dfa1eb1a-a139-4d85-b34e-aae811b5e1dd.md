## A. Delivered

1. **Policy:** `AGENTS.md` now requires only verified information needed for the next operator decision and task-specific section titles; named default sections were removed.
2. **Duplication:** `.skills/decision-os-treat-open-notes/SKILL.md` now defers to the workspace policy, and each thread run references that policy instead of repeating a Markdown recipe.
3. **Gate:** `master-task-gate` no longer parses or emits the unused literal `Acceptance Criteria` field.
4. **Regression:** prompt and ledger fixtures use task-specific headings and assert that the named-section schema is absent.

---

## B. Verification

1. **Prompt test:** `1` test passed.
2. **Ledger tests:** all `3` affected cases passed across the focused run and failed-case rerun.
3. **Commit:** implementation commit `b8ef4e2` was merged into `main` by merge commit `e5cce83`.
4. **Cleanup:** the isolated worktree and feature branch were removed.