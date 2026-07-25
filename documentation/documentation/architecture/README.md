# System Architecture

## A. Root Blocks

1. **Frontend:** `frontend/` owns the browser canvas, UI components, operator input, Runtime State, client persistence requests, and client telemetry.
2. **Backend:** `backend/` owns HTTP and WebSocket serving, project discovery, ledger persistence, Codex processes, task state, transcription, refresh, federation, and server telemetry.
3. **Ledger CLI:** `ledger-cli/` owns non-visual ledger inspection and mutation commands.
4. **Generator CLI:** `generator-cli/` owns scaffold generation from Master Ledger inputs; it does not own routine ledger editing.
5. **Federation relay:** `federation-relay/` owns relay behavior used by federated Decision OS nodes.
6. **Verification harness:** `tests/browser/`, `frontend/test/`, `backend/test/`, and `ledger-cli/test/` own browser, integration, unit, and CLI evidence.

---

## B. Runtime Entry

1. `bin/decision-os-server.mjs` derives repository-owned runtime paths from its own location.
2. The launcher sets `DECISION_OS_FRONTEND_ROOT`, `DECISION_OS_REPOSITORY_SETTINGS_FILE`, and `TSX_TSCONFIG_PATH`.
3. The launcher starts `backend/src/server.ts` through the repository `tsx` loader.
4. The server launch directory defines the master project catalog boundary.
5. On this workstation, the decision-os workspace uses port `50150` under the server procedure in `AGENTS.md`.

---

## C. Project and Ledger Flow

1. The master `.decision-os/projects.json` registry defines registered projects.
2. `project-catalog-store.ts` resolves registered paths into project records.
3. Each project `.decision-os/state.json` declares its ledgers and ledger files.
4. Project-sensitive routes carry `/p/:projectId` so one server can resolve the owning workspace.
5. Ledger changes persist to project-owned JSON and file-backed card or thread content.
6. Frontend refresh paths reconcile server-confirmed content into client Runtime State.

---

## D. Source-of-Truth Boundaries

1. Project identity belongs to `.decision-os/project.json`.
2. Project membership belongs to the master `.decision-os/projects.json` registry.
3. Ledger availability belongs to each project `.decision-os/state.json`.
4. Canvas and card references belong to the corresponding ledger JSON.
5. Large card and thread bodies belong to `.decision-os/cards/` and `.decision-os/threads/`.
6. Derived Control Room projections must not replace project-owned task truth.

---

## E. Evidence

1. `bin/decision-os-server.mjs`
2. `backend/src/server.ts`
3. `backend/src/business/server/helper/project-catalog.ts`
4. `backend/src/business/server/helper/project-catalog-store.ts`
5. `backend/src/business/server/helper/create-http-server.ts`
6. `frontend/src/business/` and `frontend/src/runtime/`
7. `package.json`, `frontend/package.json`, `backend/package.json`, and `ledger-cli/package.json`

---

## F. Detailed Architecture

1. [Epoch-3 task state and federation](./epoch-3-task-state-and-federation.md) is the historical architecture and rollback reference for offline migration, structural entities, immutable content, durability, relay anti-entropy, derived remote stores, lazy content routing, and production diagnostics.
2. [Epoch-4 task assignment, execution, and content](./epoch-4-task-assignment-execution-and-content.md) defines durable assignment, replicated execution, thread-note and Markdown consistency, immutable execution artifacts, in-place media references, and the recoverable node migration transaction.
