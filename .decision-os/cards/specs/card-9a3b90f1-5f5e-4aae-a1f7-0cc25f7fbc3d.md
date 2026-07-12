## A. Scope

1. **Objective:** migrate every mobile surface outside the `Control Room` to the shared control and input system.

---

## B. Requirements

1. **Ledger UI:** migrate overview rows, zone rows, card rows, search, create actions, back navigation, and card-detail actions.
2. **Thread UI:** migrate tabs, note actions, composer controls, close actions, confirmation dialogs, and voice-adjacent controls without changing recording behavior.
3. **Codex UI:** migrate processing tabs, pipeline actions, fields, selectors, save actions, back controls, and modal layers.
4. **Markup:** add shared classes and semantic attributes in `frontend-mobile/index.html`, `frontend-mobile/src/mobile.js`, `frontend-mobile/src/mobile-thread.js`, and `frontend-mobile/src/mobile-codex.js`.

---

## C. Acceptance Criteria

1. **Parity:** no actionable mobile element remains on an unrelated legacy visual treatment.
2. **Behavior:** ledger navigation, card actions, voice capture, thread actions, Codex processing, and persistence remain unchanged.

---

## D. Implementation

1. **Complete:** ledger, zone, card, thread, creation dialog, confirmation dialog, and Codex surfaces now share the same square control and recessed-input treatment.
