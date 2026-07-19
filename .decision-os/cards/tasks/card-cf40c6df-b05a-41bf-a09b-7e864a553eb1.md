## A. Scope

1. **Type:** `code`.
2. **Targets:** `frontend/index.html`, `frontend/src/app/responsive/application.js`, and `frontend/assets/application.css`.
3. **Symbols:** `renderControlRoom()`, `taskRow()`, `.control-room`, `.control-tabs`, and `.control-task-list`.

---

## B. Implementation

1. Add three labeled desktop lane containers ordered `Backlog | Queue | Exec`.
2. Render the filtered backlog, queue, and execution collections simultaneously at desktop width.
3. Preserve the current tab-selected single-list surface below the desktop breakpoint.
4. Use the current queue summary markup for every task and navigate directly when any card is clicked.
5. Remove backlog disclosure markup, chevrons, in-place subtask details, expand state, and collapse state.

---

## C. Completion

1. Desktop shows all three lanes in the required order.
2. Every lane uses the same compact card structure, spacing boundary, metadata placement, and direct navigation behavior as Queue.
3. Mobile still renders one selected tab with no horizontal overflow.
4. Empty-state text is scoped to its corresponding lane.
