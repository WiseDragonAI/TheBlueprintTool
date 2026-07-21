## A. Scope

1. Use an injected fake executor so automated verification cannot power off the workstation.
2. Cover immediate idle firing, pending queue drain, active process drain, multi-project drain, project-sync ownership, concurrent arm, cancel, stale boot, restart recovery, command failure, and all guarded admission paths.
3. Assert persistent state and files after every transition.

---

## B. Targets

1. **Files:** `backend/test/server/deferred-poweroff.integration.test.ts`; `backend/test/codex/start-thread-codex-process-admission.test.ts`; `backend/test/codex/start-codex-pipeline-run-controller.test.ts`; focused tests for card start, continuation, and restart controllers.
2. **Symbols:** fake executor call ledger; multi-project fixtures; boot-ID fixture; scheduler callback fixtures.

---

## C. Done When

1. Tests prove exactly one executor call after complete local idle.
2. Tests prove zero calls before idle and zero automatic retries after `firing`, `failed`, stale-boot, and restart states.
3. Tests prove every rejected admission is mutation-free and uses `shutdown_drain_armed`.
