## A. Objective

1. **Map current behavior.** Trace how the launcher, backend, frontend, Control Room, settings, and ledger APIs resolve the active workspace from the server CWD.

---

## B. Evidence to Produce

1. **Launch chain.** Record the exact entry points and environment values used to start Decision OS.
2. **Workspace chain.** Record every module that derives `.decision-os`, ledger, card, thread, asset, and settings paths from the active workspace.
3. **Control Room chain.** Record the current `ledger → zone → card` data flow and the current task grouping/filtering flow.
4. **Constraints.** Identify verified single-workspace assumptions, path trust boundaries, and tests that protect current behavior.

---

## C. Exit Criteria

1. **Discovery report.** The master task can use a concrete current-state map with file and symbol references to define the implementation contracts.

---

## D. Findings

1. **Launch chain.** `bin/decision-os-server.mjs` launches `backend/src/server.ts`, injects `DECISION_OS_FRONTEND_ROOT` and `TSX_TSCONFIG_PATH`, and preserves the launch CWD. `startHttpServerController` resolves settings, state, watchers, and the HTTP server from that CWD.
2. **Workspace chain.** `resolveDecisionOsRoot` previously walked upward to one `.decision-os` root. `createHttpServer` closed over that root for state, ledgers, mutations, assets, threads, voice, and Codex routes.
3. **Control Room chain.** `frontend-mobile/src/mobile.js` previously loaded one `/decision-os/state`, fetched only that state's ledgers, and `deriveControlRoom` grouped master tasks by ledger.
4. **Verified correction point.** The server request boundary now selects a validated catalog project before project-scoped data access, while Control Room aggregates project-scoped ledger documents.
