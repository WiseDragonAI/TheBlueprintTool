#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-13T18:32:46.691Z
Active since: 2026-07-13T18:58:42.340Z
Completed at: 2026-07-14T07:39:48.577Z

## A. Scope

1. **Objective:** Restore `Pink` and enforce a strict separation between the home-scoped server catalog and project-scoped `ledger-cli` execution.
2. **Project path:** `/data/data/com.termux/files/home/health/pink`.
3. **Server policy:** Do not stop, restart, replace, or launch the Decision OS server without explicit operator authorization.

---

## B. Verified Root Cause

1. **Service launch:** The Termux service correctly starts from `/data/data/com.termux/files/home` and does not configure a catalog-root variable.
2. **Inherited scope:** The supervisor and live server descendants inherited the former project-scoping variable from an active Decision OS card environment.
3. **Architectural defect:** Backend startup consumed that ledger scope before the launch cwd and incorrectly derived the project catalog root from it.
4. **Observed impact:** The live catalog was confined below `/data/data/com.termux/files/home/decision-os`, excluding `/data/data/com.termux/files/home/health/pink`.
5. **Pink state:** Pink has a valid `.decision-os/state.json` with ledger `tasks`.
6. **Legacy selector:** The project cookie and header mechanism was absent from runtime source; its remaining test-only literals have now been removed.

---

## C. Implemented Decision

1. **Server scope:** The server catalog derives from the launch cwd and backend startup no longer consumes a root environment variable.
2. **Launcher sanitation:** The launcher strips inherited project-scoping `DECISION_OS_*` variables while retaining `DECISION_OS_FRONTEND_ROOT`.
3. **Ledger scope:** Project-scoped Codex children now receive `DECISION_OS_LEDGER_ROOT`; only `ledger-cli` consumes it for filesystem scope enforcement.
4. **Naming contract:** The ambiguous former root name has been removed from source, tests, and documentation outside managed Decision OS historical content.
5. **Legacy cleanup:** The remaining legacy project cookie and header literals were removed from tests; project scope remains canonical in `/p/:projectId/...` URLs.
6. **Documentation:** `README.md`, `MIGRATE_RUNBOOK.md`, and `documentation/specs.json` now distinguish server cwd from ledger scope.
7. **Repository:** Feature commit `53f33cb` was merged into `main` by merge commit `d94689a`; the isolated worktree and branch were removed.

---

## D. Acceptance Criteria

1. **Static contract:** Runtime and tests contain no legacy project cookie or header selector literal.
2. **Root isolation:** Inherited project-scoping variables cannot alter backend catalog discovery.
3. **CLI isolation:** Project-scoped ledger commands remain bounded by `DECISION_OS_LEDGER_ROOT`.
4. **Catalog:** `GET /decision-os/projects` includes the project rooted at `/data/data/com.termux/files/home/health/pink`.
5. **Surface:** `GET /` returns `200` and the Control Room displays Pink.
6. **Repository:** Focused checks pass and implementation changes are committed through the required isolated-worktree workflow.

---

## E. Verification

1. **Automated checks:** Backend and ledger CLI typechecks pass; all `51` ledger CLI tests, all `37` mobile Control Room tests, both launcher tests, and focused backend boundary tests pass.
2. **Concurrent suite note:** One pipeline-completion test timed out only in the full concurrent backend suite; its complete test file passes in isolation.
3. **Live gate:** The merged server code is not active until the operator authorizes the Termux service restart.

---

## F. Subtasks

1. [Diagnose Pink catalog disappearance](card:card-9f93844a-47c7-4892-9208-638fef4a5ed2) — Status: complete
2. [Decouple server catalog scope and restore Pink](card:card-18496a6d-ffac-47d7-a92d-ac3c58592662) — Status: complete