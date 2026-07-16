#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-12T10:39:10.278Z
Active since: 2026-07-12T11:14:20.657Z
Completed at: 2026-07-12T11:15:23.635Z

## A. Scope

1. **Surface:** Add a bottom completion action to the master-task card opened from the mobile control room.
2. **Ledger synchronization:** Set every canonically linked subtask card and the master-task card to `done` through the authoritative ledger mutation endpoint.
3. **Markdown synchronization:** Update every linked entry under `## D. Subtasks` to `Status: complete`, replace the lifecycle label with `#task-complete`, and add `Completed at` in the same mutation.

---

## B. Implementation Contract

1. **Master action:** Render `Complete master task` below the subtask list on the master-task detail page.
2. **Validation:** Resolve every canonical `card:<id>` link before changing any ledger status.
3. **Atomic action:** Use `complete-master-task` to change all linked cards, the master card, and the master Markdown during one server request.
4. **Idempotent UI:** Render `Master task complete` as a disabled action when the master card already has status `done`.

---

## C. Acceptance Criteria

1. **Mobile action:** A master task opened from the control room shows `Complete master task` below its linked subtask list.
2. **Card statuses:** Activating the action persists every linked subtask card and the master card as `done`.
3. **Master Markdown:** Every canonical linked subtask line is persisted as `— Status: complete`, the lifecycle becomes `#task-complete`, and `Completed at` is recorded.
4. **Safety:** No card changes when a canonical subtask link does not resolve to a ledger card.
5. **Verification:** Mobile control-room tests, focused backend mutation tests, and backend TypeScript checking pass.

---

## D. Subtasks

1. [Implement Aggregate Master Completion](card:card-9ed2f4d1-1f30-4d68-b81c-3ec94629d9be) — Status: complete