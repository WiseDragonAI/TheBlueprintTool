# Product and Operator Model

## A. What Decision OS Is For

1. **Decision OS is a spatial workspace for structured project knowledge and work.** The browser renders cards, zones, groups, relationships, threads, and ledger navigation on a canvas.
2. **A server can expose several registered projects at once.** The Control Room is `/`; aggregate project and ledger surfaces are `/projects` and `/ledgers`.
3. **Project-owned resources use stable project-scoped routes.** Ledger pages use `/p/:projectId/ledgers/:ledgerId`.
4. **Workspace data stays with the workspace.** Each project owns a `.decision-os/` directory containing its identity, ledger catalog, ledger JSON, cards, threads, settings, and runtime artifacts.

---

## B. Main Operator Surfaces

1. **Control Room:** shows work aggregated across registered projects.
2. **Projects:** registers, relinks, edits, and unregisters project entries without deleting project files.
3. **Ledgers:** opens project-owned canvases whose available ledger files are declared in `.decision-os/state.json`.
4. **Thread panel:** attaches operator and agent discussion to the active card.
5. **Keys panel:** exposes the current keyboard contract from `AGENTS.md`.
6. [**Grouped Ledgers**](./ledgers-project-disclosures.md): describes the global project disclosures, project-qualified navigation, empty-project state, and nested responsive boundary.

---

## C. Main Controls

1. `A` opens or focuses the thread panel.
2. `X` starts or stops the active voice note.
3. `Esc` cancels voice capture, closes thread tooling, or clears selection.
4. `Del` confirms deletion for the selected card, zone, or group.
5. `Ctrl+C`, `Ctrl+V`, and `Ctrl+D` copy, paste, and resize the selected canvas objects.

---

## D. Durable Objects

1. `.decision-os/project.json` owns durable project identity.
2. `.decision-os/state.json` owns the project ledger catalog.
3. `.decision-os/<ledger-id>.json` owns canvas geometry and ledger-level state.
4. `.decision-os/cards/<ledger-id>/` owns file-backed card content.
5. `.decision-os/threads/<ledger-id>/` owns file-backed thread content.

---

## E. Evidence

1. `README.md`
2. `AGENTS.md`
3. `.decision-os/project.json`
4. `.decision-os/state.json`
5. `backend/src/business/server/helper/project-catalog.ts`
