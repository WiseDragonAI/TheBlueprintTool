## A. Type and Targets

1. **Type:** `test`
2. **Files:** `frontend/test-responsive/mobile-control-room.test.mjs`, `frontend/test-responsive/mobile-federated-projects.test.mjs`
3. **Targets:** new-task dialog contract and federated project ownership/presence behavior

---

## B. Implemented Regressions

1. Replaced the flat project-grid and visible-ID assertions with the node-tab and tabpanel structure.
2. Added assertions for local-node defaulting, node labels, node presence, project-name-only choices, offline visibility, and offline disabled actions.
3. Preserved the existing assertions for task-intake mutation scope and federated project behavior outside this dialog.

---

## C. Verification

1. **Focused tests:** `2` passed and `0` failed.
2. **Full frontend suite:** `415` passed and `11` unrelated baseline asset-contract tests failed.
3. **State:** automated regressions pass; device interaction remains required before closing this interaction task.
