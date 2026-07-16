## A. Objective

1. **Implement server support.** Make one Decision OS server aware of the detected project CWDs and able to serve their Decision OS data.

---

## B. Implementation

1. **Project catalog.** Recursively discover project directories containing Decision OS ledgers beneath the master workspace, retain each nested CWD path for resolution, and expose the project directory basename as its display name.
2. **Scoped data access.** Carry project identity through project, ledger, card, thread, asset, and mutation requests that currently rely on one server CWD.
3. **Isolation.** Resolve and validate every project-scoped path within its selected project CWD.
4. **Compatibility.** Keep existing single-project routes and behavior working for a server launched from a repository.

---

## C. Verification

1. **Automated coverage.** Test a root-level project, projects below an intermediate directory with no Decision OS data, multiple ledgers in one nested project, project-scoped reads and writes, invalid project paths, and single-project compatibility.

---

## D. Evidence

1. **Implementation.** Commit `3243591` adds the recursive project catalog, per-request project runtime, project-scoped state, ledger, mutation, asset, thread, voice, and Codex routing, and launch-CWD fallback correction. Merge commit: `106c731`.
2. **Backend checks.** Backend TypeScript compilation passes. Five focused unit and integration tests pass, including nested discovery, multiple ledgers, project isolation, invalid-id rejection, color persistence, and launch-CWD fallback.
3. **Regression result.** The backend suite passes `101/102`; the remaining isolated failure is the existing Codex event-count assertion at `backend/test/codex/start-card-skill-process-controller.test.ts:412`, where the fixture reports `2` instead of `1` tool call.
