# Frontend Telemetry Oversized Message Runtime Pause

## A. Incident Summary

1. **First observation:** `2026-08-15T19:37:03.849Z`.
2. **Trigger:** One browser sent a frontend-telemetry WebSocket message larger than the server's `64 KiB` `ws` limit.
3. **Transport result:** `ws` rejected the message, emitted `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH`, and closed only the owning client with close code `1009`.
4. **Incorrect runtime result:** Decision OS persisted the client rejection under `background:frontend-telemetry`, added `frontend-telemetry` to `pausedBackgroundComponents`, and reported degraded health after later restarts.
5. **Actual component state:** The HTTP server and telemetry writer remained operational; the incident represented no stopped component state that the background recovery dispatcher could reconstruct.

---

## B. Failed Invariant

1. A rejected browser diagnostic message must fail only its owning client connection.
2. A durable component pause must identify runtime state that has actually stopped and has a valid revalidation operation.
3. A contained diagnostic failure must remain queryable as resolved incident history without degrading unrelated server health.

---

## C. First Incorrect Transition

1. `frontend-telemetry-websocket.ts` correctly allowed `ws` to reject the oversized frame at the receiver boundary.
2. The socket emitted an `error` event with operation `frontend-telemetry-client` before closing with code `1009`.
3. The server wiring passed that event to `recordBackgroundFailure('frontend-telemetry', operation, error)`.
4. `recordBackgroundFailure()` inserted the component into `pausedBackgroundComponents` and persisted the incident under `background:frontend-telemetry`.
5. The incorrect transition was therefore the classification from **stopped client operation** to **paused background component**, not the WebSocket size limit or close behavior.

---

## D. Why Restart Did Not Recover It

1. The incident ledger correctly retained the active incident across process restarts.
2. Startup reconstructed every active `background:*` incident as a paused background component.
3. No application gate had stopped frontend telemetry, so there was no component state to validate and reinstall.
4. The generic background recovery dispatcher had no recovery operation for a rejected client message.
5. Restart therefore reproduced the false pause instead of clearing it.

---

## E. Detection Gap

1. The original transport tests covered same-origin acceptance, cross-origin rejection, record persistence, and configuration exposure, but did not exercise an oversized frame.
2. Health degradation was inferred from the durable incident rather than from telemetry-writer availability, so a resolved client failure appeared equivalent to a stopped component.
3. Startup tests did not contain a retained `background:frontend-telemetry` client rejection and therefore did not expose the unrecoverable legacy pause.

---

## F. Correction

1. `createDecisionOsServer()` now routes `frontend-telemetry-client` and `persist-frontend-telemetry` failures through `recordStoppedOperation()`.
2. Each current failure uses its own scope, `frontend-telemetry:<operation>`, records warning evidence, and resolves that scope immediately with the stopped-operation resolution.
3. The current path never inserts `frontend-telemetry` into `pausedBackgroundComponents`.
4. The `64 KiB` receiver limit remains intact; rejecting an oversized message is the required containment behavior.
5. The telemetry WebSocket test now proves close code `1009`, one `frontend-telemetry-client` observation, continued listener availability, and successful persistence through a second client.

---

## G. Legacy Incident Recovery

1. Startup recognizes the legacy scope `background:frontend-telemetry` only for operations `frontend-telemetry-client` and `persist-frontend-telemetry`.
2. Startup resolves the legacy scope only when every active incident in that scope belongs to that complete allowlist.
3. An unknown operation sharing the legacy scope prevents normalization; the complete scope stays active and `frontend-telemetry` remains paused.
4. This scope-wide check clears the known false pause without concealing an independent background failure.

---

## H. Regression Evidence

1. `backend/test/unit/server/http/frontend-telemetry-websocket.test.ts` contains `contains an oversized browser message to its telemetry client socket`.
2. `backend/test/unit/server/runtime/incident-supervisor.test.ts` contains `startup resolves a retained frontend telemetry client rejection without pausing the writer`.
3. The same supervisor test file contains `startup preserves an unknown frontend telemetry failure sharing a legacy client scope`.
4. `backend/test/unit/server/helper/create-http-server.test.ts` proves a retained legacy client rejection reconstructs ready health, zero active incidents, and no background pause.

---

## I. Production Recovery Evidence

1. The retained production incident has one occurrence, remains preserved with status `resolved`, and records resolution at `2026-08-27T16:02:43.869Z`.
2. The corrected production process started at `2026-08-27T16:02:42.837Z` and reached listener readiness in `27.38 ms`.
3. All nine discovered projects reconstructed from persistent warm snapshots with one worker checkpoint read and zero worker shard reads per project; runtime readiness completed in `3,713.41 ms`.
4. At `2026-08-27T20:07:33.461Z`, `/api/health` reported `ready`, zero active incidents, and no paused background components.
5. After the corrected restart, the retained telemetry file accepted 118 frontend records; the largest serialized retained record was 3,237 bytes. No new frontend-telemetry incident was recorded.

---

## J. Durable Lesson

1. Classify a failure from the state transition it caused, not from the callback in which it surfaced.
2. Use `recordStoppedOperation()` when the failed operation terminates without invalidating durable or runtime component state.
3. Use a pausing recorder only when the owner has actually stopped admission and exposes a validated recovery transition.
4. When correcting a legacy classification, normalize the complete active scope against an explicit operation allowlist; never resolve one recognized incident while an unknown incident shares the scope.

---

## K. Evidence Index

1. **Current architecture:** [Frontend telemetry and incident containment](../documentation/architecture/frontend-telemetry-and-incident-containment.md).
2. **Transport and limits:** `backend/src/business/server/http/frontend-telemetry-websocket.ts`.
3. **Current failure wiring:** `backend/src/business/server/application/create-decision-os-server.ts`, `installFrontendTelemetryWebSocket()`.
4. **Stopped-operation and legacy normalization:** `backend/src/business/server/runtime/incident-supervisor.ts`, `createIncidentSupervisor()`.
5. **Durable production incident:** `/home/jbb/.decision-os/runtime-incidents.json`.
6. **Production startup:** `/home/jbb/.local/state/multiwezterm-staging/process-logs/jbb-50150.log`.
7. **Retained browser evidence:** `/home/jbb/.decision-os/frontend-telemetry.jsonl`.
8. **Transport regression:** `backend/test/unit/server/http/frontend-telemetry-websocket.test.ts`.
9. **Classification regressions:** `backend/test/unit/server/runtime/incident-supervisor.test.ts` and `backend/test/unit/server/helper/create-http-server.test.ts`.
