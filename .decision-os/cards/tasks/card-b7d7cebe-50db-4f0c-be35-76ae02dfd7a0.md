#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-12T10:44:55.508Z
Queue rank: 1
Active since: 2026-07-12T12:20:16.715Z
Completed at: 2026-07-12T12:43:31.917Z

## A. Scope

1. **Active-task content:** Show only the master-task title and the live Codex session stopwatch in each `Active` control-room row.
2. **Stopwatch format:** Derive elapsed time from the canonical `Active since` timestamp and render it as zero-padded `MM:SS`, continuing past 59 minutes.
3. **Removed content:** Do not show the ledger name, Codex run ID, subtask progress, next actionable subtask, empty actionable-subtask message, or disclosure chevron in an active row.
4. **Navigation:** Clicking an active row opens its master card directly.
5. **Queue navigation:** Clicking a queued row opens its master card directly without an inline collapsed state, subtask list, or action buttons.
6. **Queue ordering:** Keep the dedicated queue reorder handle and its pointer and drag interactions independent from row navigation.
7. **Empty subtitle:** Do not render a next-subtask subtitle when the task has no actionable subtask; retain `Next: <title>` when a real next subtask exists.
8. **Progress removal:** Do not display the completed-subtask fraction in task-row metadata.

---

## B. Implementation

1. **Runtime:** `frontend-mobile/src/mobile.js` renders active rows as direct-navigation buttons and refreshes visible stopwatches every second.
2. **Formatting:** `frontend-mobile/src/mobile-control-room.js` owns the exact elapsed-time formatter.
3. **Presentation:** `frontend-mobile/assets/mobile.css` uses tabular numerals for a stable stopwatch width.
4. **Queue runtime:** `frontend-mobile/src/mobile.js` routes queued summaries directly to their master cards while retaining queue reordering.
5. **Subtitle runtime:** `frontend-mobile/src/mobile.js` creates `.task-next` only when `task.nextSubtask` exists.
6. **Metadata runtime:** `frontend-mobile/src/mobile.js` limits non-active task metadata to ledger and age/status context.
7. **Verification:** `frontend-mobile/test/mobile-control-room.test.mjs` covers exact formatting, durations beyond one hour, compact content, direct navigation, disclosure removal, retained queue drag behavior, empty-subtitle omission, and progress-count omission.

---

## C. Acceptance Criteria

1. **Compact row:** An active task displays its title and one `MM:SS` stopwatch only.
2. **Live time:** The stopwatch advances once per second from the Codex session launch timestamp.
3. **Direct open:** One click on the active row opens the master card without expanding inline details.
4. **Queue direct open:** One click on a queued row opens the master card without creating inline disclosure content.
5. **Queue reorder:** The dedicated reorder handle continues to support touch and drag queue reordering.
6. **Subtitle omission:** A task without an actionable subtask has no empty-state subtitle.
7. **Real subtitle:** A task with an actionable subtask displays `Next: <title>`.
8. **Progress omission:** Task-row metadata contains no `<complete>/<total> complete` fraction.
9. **Regression gate:** All mobile tests and frontend and backend TypeScript checks pass.

---

## D. Subtasks
