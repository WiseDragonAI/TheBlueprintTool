## A. Scope

1. **Objective:** identify the first incorrect transition after a headless Codex capacity failure and define the recovery contract.

---

## B. Evidence

1. **Observed error:** `Selected model is at capacity. Please try a different model.`
2. **Cause:** the thread process controller classified every non-zero exit as terminal without inspecting the run segment.
3. **Recovery inputs:** the JSONL artifact contains the session id, while the ledger card stores `codexRunModel` and `codexRunEffort`.
4. **Decision:** classify the exact capacity error as transient, retain the selection snapshot, and resume after `5,000ms`.

---

## C. Acceptance Criteria

1. **Status:** complete.
2. **Evidence:** repository inspection identified the terminal `close` handler, session-id event, and existing resume command builder.
