## A. Task

1. Replace the per-project chip source in `renderControlRoom` with the canonical repository groups.
2. Update `filteredControlTasks` and `controlTaskCount` to match every project ID in the selected group.
3. Populate ledger chips from the selected group's deduplicated ledgers.
4. Preserve queue ordering, task owner text, and navigation through each task's original `projectId`.

---

## B. Targets

1. **File:** `frontend/src/app/responsive/application.js`
2. **Symbols:** `renderControlRoom`, `filteredControlTasks`, `controlTaskCount`, `selectControlProject`
3. **Preserved behavior:** `taskRow` continues to display `ownerNodeLabel`; `pathForTask` continues to use the terminal-qualified project ID.

---

## C. Completion

1. The two `decision-os` catalog records produce one chip.
2. Selecting that chip includes workstation-owned and mobile-owned tasks.
3. Ledger filtering applies across the whole repository group.
4. Clearing filters restores the complete task list.
