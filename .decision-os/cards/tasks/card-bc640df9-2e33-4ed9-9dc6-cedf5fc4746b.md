## A. Implementation outcome

1. **Result:** Existing Codex prompts continue to call `master-task-apply` and `master-task-progress` with the same JSON contracts.
2. **Causal apply chain:** The CLI now translates apply into `patch-card` → `patch-region` → per-subtask `create-card` → `append-note` → positioned `create-relationship` → final `patch-geometry`.
3. **Causal progress chain:** The CLI preflights lifecycle authority, patches content and validated labels, appends one agent reply, hydrates materialized Markdown, then verifies every postcondition and gate result.
4. **Publication:** The implementation, concurrent-main reconciliation, and live-verification correction are published on `origin/main` at `e0dda33a`.

---

## B. Verification evidence

1. **CLI suite:** `83/83` tests pass; CLI typecheck passes.
2. **Backend scopes:** Label mutation tests and backend typecheck pass.
3. **Backend full suite:** `425/430` passed; five concurrent integration cases timed out or collided through process-global `cwd`, while the changed backend tests pass in isolation.
4. **Live apply:** The unchanged CLI command created eight activated subtasks, eight ordered relationships, renamed the mandatory zone, and isolated all nine graph cards in that zone.
5. **Live correction:** Raw task projection exposed that card bodies require content-file hydration; regression `3ae20f25` proves the corrected verification path.
