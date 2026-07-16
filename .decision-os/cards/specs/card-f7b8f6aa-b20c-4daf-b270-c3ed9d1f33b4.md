## A. Scope

1. **Objective:** Make queue rows reorder continuously under the pointer and animate every displaced row.
2. **Files:** Update `frontend-mobile/src/mobile.js`, `frontend-mobile/assets/mobile.css`, and focused tests under `frontend-mobile/test/`.

---

## B. Requirements

1. **Shared interaction:** Use one insertion-position update path for native mouse drag and touch pointer drag.
2. **Live model:** Move the dragged task inside the visible in-memory queue whenever it crosses a new row position.
3. **DOM update:** Reflect each live model move immediately while retaining drag capture and transient drag classes.
4. **Animation:** Apply a FLIP-style transform animation to rows displaced by each live reorder and respect reduced-motion preferences.
5. **Safety:** Preserve queue filtering, direct navigation, the drag handle, `next-task`, and scroll-anchor behavior.

---

## C. Acceptance Criteria

1. **Fine pointer:** Native drag movement visibly reorders and animates rows before drop.
2. **Touch:** Long-press pointer movement visibly reorders and animates rows before release.
3. **Cleanup:** Drop, pointer release, and cancellation remove all transient drag state.
4. **Coverage:** Focused automated tests verify live ordering, animations, filtering, and cleanup.
