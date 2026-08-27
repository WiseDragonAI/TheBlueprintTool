# Frontend Telemetry Oversized Message Runtime Pause

## A. Incident

1. On `2026-08-15T19:37:03.849Z`, the production incident ledger recorded `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH` for `background:frontend-telemetry` after one browser sent a WebSocket message above the server's 64 KiB limit.
2. The retained incident kept Decision OS health degraded after restart even though the frontend telemetry writer remained operational.

---

## B. Root Cause

1. `ws` rejected the oversized message at its receiver boundary and closed the owning client socket with close code `1009`.
2. `frontend-telemetry-websocket.ts` routed every client socket `error` event to the server background-failure recorder.
3. The background-failure recorder persisted an error incident and added `frontend-telemetry` to the paused-component registry.
4. No application gate stopped the telemetry writer, and the background recovery dispatcher had no valid reconstruction operation for a rejected client message. The durable pause therefore described no paused runtime state and could not be recovered explicitly.

---

## C. Correction

1. Client socket and diagnostic append errors now terminate through the stopped-operation recorder. They retain bounded resolved incident evidence without entering the paused-component registry.
2. Startup resolves a retained `background:frontend-telemetry` scope only when every active incident in that scope is a known client or append operation. An unknown incident sharing the scope prevents normalization and remains paused.

---

## D. Verification

1. The oversized-message regression must prove close code `1009`, stopped-operation observation, continued HTTP service, and successful persistence from a second client.
2. Startup regressions must prove the known retained client incident becomes resolved and that an unknown incident sharing the scope prevents resolution.
3. Production closeout requires a restart onto the corrected release followed by `GET /api/health` and `GET /api/diagnostics/incidents` showing zero active incidents.
