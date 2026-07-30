## A. Repository Intent

1. **Task execution identity is `executionId`.**
2. **The backend owns JSONL parsing and emits normalized Codex log events.**
3. **The frontend consumes structured events and does not interpret executor-local artifact layout.**
4. **Federated reads proxy the same execution-scoped packet from the executor node.**

---

## B. Current Iteration Intent

1. **Epoch 4 made task-execution entities authoritative for execution identity, lifecycle, ownership, and federation routing.**
2. **The architecture acceptance proof requires one exact `executionId` in the execution store, runtime handle, event, API DTO, and executor observation.**
3. **Raw JSONL, stderr, and telemetry remain backend artifacts.**

---

## C. Findings

1. **Incomplete migration:** Epoch 4 changed lifecycle authority to `executionId`, but retained the legacy session-scoped log endpoint and frontend event segmentation.
2. **Packet omission:** `NormalizedRunEvent` and `CardSkillRunEvent` contain physical `line` and `sourceLine` fields but contain no `executionId`.
3. **Frontend leakage:** `render-thread-codex-log.ts` decides event ownership by comparing physical JSONL line numbers with execution boundaries.
4. **Regression trigger:** commit `89d4d41b` removed those boundaries from the backend execution-history response while leaving the frontend segmentation code active.
5. **First architectural defect:** normalized events are not execution-addressed despite the Epoch 4 identity contract.
6. **First visible bad transition:** the frontend converts missing boundaries to zero and rejects every correctly parsed event.
7. **Federation drift:** the internal execution-specific status route delegates to the same session-scoped reader, so its URL identity and returned event identity disagree.
8. **Live evidence:** the reported endpoint returned a running execution, populated structured events, and the correct aggregate tool count. The frontend discarded those events after receipt.
9. **Superseded recommendation:** restoring line boundaries would repair the symptom while preserving artifact-layout knowledge in the frontend.

---

## D. Remediation Path

1. **Add an execution-scoped log read contract:** `GET /api/task-executions/:executionId/log`.
2. **Resolve the authoritative task-execution record from `executionId`.**
3. **Parse the owned JSONL and stderr artifacts on the executor node.**
4. **Assign `executionId` to every normalized event before constructing the response.**
5. **Return an opaque continuation cursor, stable event IDs, normalized event content, execution lifecycle, and aggregate counters.**
6. **Keep physical line positions internal to the parser and cursor implementation.**
7. **Route remote reads to the same execution-scoped endpoint on the assigned executor.**
8. **Change the frontend poller to request the selected `executionId`, merge events by stable event ID, and render every event in the returned packet.**
9. **Remove `executionEvents()` and the frontend execution-boundary comparison.**
10. **Keep session history as an execution list. Selecting a historical entry changes the requested `executionId`.**
11. **Add an end-to-end contract regression:** a packet containing events for a running execution must render those events without execution boundary fields.

---

## E. Operator Decision Summary

1. **Selected correction:** complete the Epoch 4 execution-addressed log packet migration.
2. **Do not restore backend `startLine` and `endLine` response fields.**
3. **Do not let the frontend interpret JSONL layout.**
4. **Use physical positions only inside the backend to provide incremental reads and stable deduplication.**
