Ledger: Specs
Waiting since: 2026-07-17T08:10:12.544Z

## A. Requested Result

1. **Desktop layout:** Show three simultaneous columns ordered `Backlog | Queue | Exec`.
2. **Movement:** Let the operator drag master-task cards between `Backlog` and `Queue` in both directions.
3. **Card fidelity:** Render every lane with the current compact `Queue` card structure; clicking a card opens it directly and no card expands in place.
4. **Mobile boundary:** Preserve the existing single-tab Control Room on widths below the desktop breakpoint.

---

## B. Verified Implementation Boundary

1. **Layout and rendering:** `frontend/index.html`, `frontend/src/app/responsive/application.js`, and `frontend/assets/application.css` currently own the Control Room tabs, one active task list, `taskRow()`, and desktop media rules.
2. **Existing interaction library:** `frontend/src/app/controller/boot-application.ts` loads vendored SortableJS `1.15.7`; its license file records the MIT license and `initializeQueueSortable()` already uses it for queue ordering.
3. **Persistence:** `ledgerMutation()` already accepts `patch-card` changes for `status` and `queueRank`; `persistQueueOrder()` already performs optimistic rank changes and reloads server truth after the latest rejected request.
4. **Projection:** `frontend/src/app/responsive/control-room.js` and `backend/src/business/server/helper/control-room-projection-store.ts` already classify `todo`, `backlog`, and executing master tasks into the three requested collections.

---

## C. Task Inventory

| id | type | title | target_files | target_symbols | action | done_when | depends_on |
|---|---|---|---|---|---|---|---|
| T1 | code | Render desktop Backlog, Queue, and Exec lanes | `frontend/index.html`; `frontend/src/app/responsive/application.js`; `frontend/assets/application.css` | `renderControlRoom()`; `taskRow()`; `.control-room`; `.control-tabs`; `.control-task-list` | Add three labeled desktop lane containers in the required order, render each filtered collection at once, preserve the existing tab-driven mobile surface, and use the queue summary markup for every task. | At desktop width all three lanes are visible in `Backlog | Queue | Exec` order; every card is a compact direct link with no chevron, disclosure state, subtask details, expand action, or collapse action; mobile still exposes one selected tab. | — |
| T2 | code | Move tasks between Backlog and Queue with SortableJS | `frontend/src/app/responsive/application.js`; `frontend/assets/application.css` | `initializeQueueSortable()`; `syncQueueFromDom()`; `persistQueueOrder()`; `ledgerMutation()` | Replace the one-list Sortable instance with grouped lane instances backed by SortableJS `1.15.7`, update local `status` and queue ordering at drop completion, persist the destination status and queue ranks, then reconcile the latest rejected mutation from server truth. Keep Exec read-only. | A desktop drag from Queue to Backlog persists `status: backlog`; a drag from Backlog to Queue persists `status: todo` plus queue rank; same-lane queue sorting still persists; the UI changes before the request settles; a successful reload preserves the result; a rejected request restores server-confirmed state. | T1 |
| T3 | test | Add responsive Control Room regressions | `frontend/test-responsive/mobile-control-room.test.mjs`; `tests/browser/application/the-application-is-one-responsive-frontend.spec.ts` | Control Room source-contract cases; responsive Playwright application case | Cover desktop lane order, compact card parity, grouped Sortable configuration, status and rank mutation payloads, mobile single-tab preservation, desktop drag movement, optimistic rendering, reload persistence, and rejection reconciliation. | Focused responsive tests pass through `node bin/decision-os-verify.mjs -- <command>` and the browser case fails when lane order, direct navigation, drag persistence, rollback, or mobile behavior regresses. | T1, T2 |
| T4 | scenario | Verify the served desktop drag workflow | Running route `http://127.0.0.1:50150/` | Desktop Control Room; Backlog lane; Queue lane; Exec lane | Use representative desktop pointer input on the running server without restarting it; compare the queue-format DOM and computed styling across all lanes; exercise Queue to Backlog, Backlog to Queue, same-lane queue sorting, successful reload, and rejected-request reconciliation. | The route returns HTTP success; computed card structure and styling match across lanes; all three persistence moments are observed; Exec rejects drops; the mobile route remains tab-driven. | T3 |

---

## D. Readiness

1. **Status:** `READY_FOR_TASK_DEPENDENCY`.
2. **Open questions:** None.
3. **Execution state:** Implementation and verification have not started; every subtask remains open.

---

## E. Subtasks

1. [Render desktop Backlog, Queue, and Exec lanes](card:card-cf40c6df-b05a-41bf-a09b-7e864a553eb1)
2. [Move tasks between Backlog and Queue with SortableJS](card:card-4c93e946-7d7b-4e74-8e88-15dc3553b1f8)
3. [Add responsive Control Room regressions](card:card-1f464e62-dbe8-4551-82f2-cda15a780e5e)
4. [Verify the served desktop drag workflow](card:card-1c05a286-8809-47ff-9492-b9ccb1862829)
