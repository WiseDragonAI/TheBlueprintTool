# Grouped Ledgers

## A. Global Ledgers Ownership

1. The global `GET /ledgers` surface renders one project boundary for each entry in `state.projects`.
2. `renderGlobalLedgers()` preserves each project's owned `ledgers` array instead of flattening it into a shared ledger list.
3. The aggregate summary continues to state the total number of ledgers across the registered projects.

---

## B. Project Disclosure

1. Each project is a native `<details>` element with a `<summary>` label, so it is closed when first rendered and supports pointer and keyboard expansion without application-managed disclosure state.
2. The project boundary spans the global Ledgers host width; opening one boundary reveals only that project's ledger links.
3. An open boundary rotates its indicator and retains a visible keyboard focus outline.

---

## C. Ledger Content and Navigation

1. A project with no ledgers remains visible and renders `No ledgers` inside its disclosure.
2. Each revealed ledger link is generated with `ledgerPathForProject(project.id, ledger.id)`, preserving the project-qualified ledger route.
3. The project-scoped overview remains separate from this aggregate Ledgers behavior.

---

## D. Responsive Boundary

1. The nested project ledger grid has one column below `760px`.
2. At `760px` and above, only the nested project ledger grid changes to two columns; project disclosure rows remain full width.

---

## E. Verification Evidence

1. `tests/browser/application/global-ledgers-project-groups.spec.ts` serves Alpha, Beta, and an intentionally unavailable Gamma registry entry to prove ledger counts `2`, `1`, and `0` before UI assertions.
2. The scenario verifies default closure, pointer expansion, `Space` and `Enter` expansion, empty content, the `759px` and `760px` layout boundary, canonical navigation, no horizontal overflow, and clean page, HTTP, and console boundaries.
3. Current implementation evidence is `frontend/src/app/responsive/application.js` `renderGlobalLedgers()` and the `.overview-project-*` rules in `frontend/assets/application.css`.
