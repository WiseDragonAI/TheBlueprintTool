## A. Scope

1. Expose one runtime admission callback backed by the durable poweroff state.
2. Reject operator starts, pipeline starts, continuations, and restarts with HTTP `409` and code `shutdown_drain_armed`.
3. Allow only scheduler dispatch of items that were durable before the arm transition.
4. Reopen admission immediately after cancellation.

---

## B. Targets

1. **Files:** `backend/src/business/codex/controller/start-card-skill-process-controller.ts`; `backend/src/business/codex/controller/start-thread-codex-process-controller.ts`; `backend/src/business/codex/controller/start-codex-pipeline-run-controller.ts`; `backend/src/business/codex/controller/continue-card-skill-run-controller.ts`; `backend/src/business/codex/controller/restart-codex-pipeline-run-controller.ts`.
2. **Symbols:** each controller's pre-mutation admission boundary; runtime `codexAdmissionState` callback; existing `queueDispatch` path.

---

## C. Done When

1. Every direct launch surface returns the same stable `409` contract while armed.
2. No rejected request mutates a card, queue file, pipeline store, run file, or thread.
3. Existing pending work still starts and settles through the scheduler.
