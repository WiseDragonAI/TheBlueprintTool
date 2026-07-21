#master-task

Ledger: Specs

## A. Scope

1. **Surface:** Persist navigation state for the mobile Control Room at `/` only.
2. **Active tab:** Store the selected `queue`, `active`, or `done` tab in the `tab` URL query parameter.
3. **Scroll anchor:** Store the nearest visible task row as the URL hash using `#task-<card-id>`.
4. **Refresh restoration:** Restore the tab and anchored task after a mobile page refresh.

---

## B. Implementation Contract

1. **Route helper:** Parse and format the mobile Control Room URL in `frontend-mobile/src/mobile-control-room-route.js`.
2. **History:** Use `history.pushState()` for tab selection and `history.replaceState()` for scroll-anchor updates.
3. **Stable anchors:** Assign each rendered Control Room task row the DOM id `task-<card-id>`.
4. **Canonicalization:** Resolve invalid tabs to `queue` and discard hashes that do not start with `task-`.
5. **Isolation:** Do not change desktop routing or desktop Control Room behavior.

---

## C. Acceptance Criteria

1. **Tab refresh:** Refreshing `/?tab=active` renders the `active` task tab.
2. **Scroll refresh:** Refreshing `/?tab=done#task-<card-id>` scrolls the matching task row into view.
3. **Browser navigation:** Tab changes create navigable browser history entries.
4. **URL churn:** Scrolling updates the current history entry without creating a history entry per scroll event.
5. **Verification:** Mobile tests and the frontend TypeScript check pass.

---
