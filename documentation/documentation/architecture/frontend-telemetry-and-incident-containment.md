# Frontend Telemetry and Incident Containment

## A. Runtime Ownership

1. `frontend/src/runtime/telemetry/effect/frontend-telemetry-websocket.ts` owns the browser connection to `/api/diagnostics/frontend-telemetry`.
2. `backend/src/business/server/http/frontend-telemetry-websocket.ts` owns same-origin admission, message validation, rate limiting, bounded buffering, JSON Lines persistence, and client shutdown.
3. `createDecisionOsServer()` installs the transport against the master Decision OS root and owns its lifetime through the HTTP server `close` event.
4. Frontend telemetry is local diagnostic evidence. It does not use federation transport.

---

## B. Enablement and Admission

1. The transport is enabled only when the master workspace setting `frontendTelemetryWebSocketEnabled` is `true`.
2. `GET /api/diagnostics/frontend-telemetry-config` exposes only the enabled state and endpoint; it does not expose workspace settings.
3. The upgrade path accepts only `/api/diagnostics/frontend-telemetry` and requires the request `Origin` host to equal the listener `Host`.
4. A disabled transport and a cross-origin handshake are rejected before WebSocket ownership is established.

---

## C. Browser Batching and Redaction

1. Installation reads telemetry configuration once for the browser module lifetime and owns at most one active WebSocket.
2. Traces observed before configuration settles remain in the bounded queue; a disabled setting and a failed configuration read clear that queue without affecting application boot.
3. The browser queue retains at most 200 records, evicts its oldest record at capacity, waits 250 ms to coalesce work, and sends at most 50 records per frame.
4. Telemetry arguments retain at most 50 object entries, 25 array entries, four traversal levels, and 2,048 characters per string.
5. Keys named `authorization`, `body`, `content`, `credential`, `markdown`, `openaiApiKey`, `output`, `prompt`, `secret`, `token`, and `transcript` are replaced with `[redacted]` before serialization.
6. After the active socket closes, the browser reconnects with exponential delay from 1 second through 30 seconds plus at most 249 ms of jitter. Active-socket identity prevents replaced sockets from creating competing retry loops.

---

## D. Server Resource Bounds

1. `ws` limits each message to `64 KiB`.
2. One message must contain an array of at most 50 records.
3. One client may admit at most 500 records in a fixed 10-second window; exceeding the budget closes that client with code `1008` and reason `rate_limited`.
4. Invalid JSON closes the client with code `1007`; a non-array batch and a batch above 50 records close it with code `1008` and reason `invalid_batch`.
5. The pending writer queue retains at most 500 serialized records and evicts the oldest pending record at capacity.
6. The active `.decision-os/frontend-telemetry.jsonl` file rotates at 5 MiB to `.decision-os/frontend-telemetry.jsonl.1`; one rotated file is retained.
7. Record identity fields are bounded to 160 characters for `name`, 64 characters for `at`, 96 characters for `browserSessionId`, 2,048 characters for `route`, and 16,000 characters for `rawStack` after string conversion.

---

## E. Failure Classification

1. A client socket error is operation `frontend-telemetry-client`.
2. A writer preparation, rotation, or append failure is operation `persist-frontend-telemetry`.
3. `createDecisionOsServer()` records each operation through `recordStoppedOperation()` under `frontend-telemetry:<operation>`.
4. `recordStoppedOperation()` persists warning evidence, resolves the operation scope immediately, and does not add `frontend-telemetry` to `pausedBackgroundComponents`.
5. The classification is based on runtime impact: a failed client connection and a failed diagnostic append stop one operation without invalidating server or project state.
6. The HTTP listener, health routes, incident diagnostics, unrelated telemetry clients, and project runtimes remain admitted after either operation fails.

---

## F. Legacy Pause Normalization

1. Releases before the correction recorded both operations under `background:frontend-telemetry`, which reconstructed a false component pause at startup.
2. `createIncidentSupervisor()` treats `frontend-telemetry-client` and `persist-frontend-telemetry` as the complete known stopped-operation set for that legacy scope.
3. Startup resolves the legacy scope only when every active incident in the scope has one of those two operations.
4. Any unknown operation in the same scope preserves every active incident and reconstructs the background pause.
5. Current failures use operation-specific `frontend-telemetry:*` scopes, so legacy normalization is a migration boundary rather than the normal recording path.

---

## G. Diagnostic Evidence

1. Retained browser records are read directly from `<server-launch-workspace>/.decision-os/frontend-telemetry.jsonl` and its `.1` rotation.
2. `GET /api/health` reports active incident count and paused runtime collections.
3. `GET /api/diagnostics/incidents` exposes active and resolved incident history even when ordinary project startup fails.
4. A missing follow-up browser event identifies an unobserved transition. It does not prove a server failure without corroborating incident, route, or process evidence.

---

## H. Verification Surface

1. `frontend/test/unit/telemetry/frontend-telemetry-websocket.test.ts` verifies one same-origin socket, pre-configuration retention, batching, route capture, shared session identity, and sensitive-key redaction.
2. `backend/test/unit/server/http/frontend-telemetry-websocket.test.ts` verifies same-origin persistence, cross-origin rejection, oversized-message containment, continued listener availability, subsequent client persistence, and minimal configuration exposure.
3. `backend/test/unit/server/helper/create-http-server.test.ts` verifies ready health after safe legacy normalization.
4. `backend/test/unit/server/runtime/incident-supervisor.test.ts` verifies safe legacy normalization and preservation of an unknown shared failure.
5. [Frontend Telemetry Oversized Message Runtime Pause](../../postmortem/frontend-telemetry-oversized-message-runtime-pause-2026-08-27.md) records the historical failure chain and production recovery evidence.

---

## I. Source Evidence

1. `frontend/src/runtime/telemetry/effect/frontend-telemetry-websocket.ts`
2. `backend/src/business/server/http/frontend-telemetry-websocket.ts`
3. `backend/src/business/server/http/diagnostic-routes.ts`
4. `backend/src/business/server/application/create-decision-os-server.ts`
5. `backend/src/business/server/runtime/incident-supervisor.ts`
6. `backend/src/business/server/helper/runtime-incident-ledger.ts`
7. `frontend/test/unit/telemetry/frontend-telemetry-websocket.test.ts`
