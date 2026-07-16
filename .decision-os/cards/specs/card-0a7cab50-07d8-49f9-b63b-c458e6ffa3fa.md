## A. Admission Runbook

1. **Check:** Run `node bin/decision-os-workload-status.mjs` before tests or typecheck.
2. **GO:** Start verification.
3. **WAIT:** Run `sleep 5` then retry. Do not start verification.
4. **Race:** Simultaneous `GO` remains possible. No lock is created.

---

## B. Verification Hygiene

1. **During implementation:** Run smallest relevant test files. Add and fix change-specific tests first.
2. **Typecheck:** Run once after code stabilizes. Scope changed package.
3. **Full suite:** Run once after implementation and focused tests pass.
4. **Failure:** Rerun smallest failing scope.
5. **Concurrency:** Keep project default test concurrency.