## A. Task

1. **Type:** `test` and `code`.
2. Add backend integration coverage for master-task creation, `synchronization` labeling, canonical pipeline launch, idempotent admission, local phase execution, federated phase dispatch, verified SHA progression, and terminal failure projection.
3. Add frontend integration coverage for the Control Room redirect, task selection, reload persistence, and admission error recovery.
4. After the new coverage passes, remove `start-project-sync-codex.ts`, `build-project-sync-prompt.ts`, their direct-spawn tests, dedicated SSE status plumbing, and project-sync run UI code that duplicates pipeline state.
5. Retain repository status, origin lock, federation authentication, safe clone materialization, and `verifyProjectSyncPhase`.

---

## B. Targets

1. `backend/test/server/project-sync.integration.test.ts`
2. `backend/test/unit/project-sync/build-project-sync-prompt.test.ts`
3. `frontend/test/runtime/project-sync.integration.test.ts`
4. `backend/src/business/project-sync/controller/start-project-sync-codex.ts`
5. `backend/src/business/project-sync/helper/build-project-sync-prompt.ts`
6. `frontend/src/app/responsive/application.js::subscribeProjectSyncEvents`, `renderProjectSyncStatus`, and `notifyProjectSync`

---

## C. Completion

1. Focused backend and frontend suites pass through `node bin/decision-os-verify.mjs -- <command>`.
2. Backend and frontend typechecks pass through the repository verification lease.
3. Repository search finds no direct project-sync Codex spawn and no settings-owned synchronization run lifecycle.
4. Served-route verification records the settings click, Control Room destination, created master task, visible pipeline state, and HTTP result.

---

## D. Dependencies

1. **Depends on:** all preceding subtasks.
