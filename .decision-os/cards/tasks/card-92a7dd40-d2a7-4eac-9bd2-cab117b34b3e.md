#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-13T11:30:14.799Z
Active since: 2026-07-13T11:30:51.428Z
Completed at: 2026-07-13T11:38:35.804Z

## A. Scope

1. **Card numbered lists:** Align ordered-list content with the left edge used by other card Markdown content.
2. **Number color:** Render ordered-list markers with the same secondary zone-derived color used by inline backtick code.
3. **Target surfaces:** Apply the contract to desktop canvas cards and the mobile card detail shown in the operator screenshot.

---

## B. Requirements

1. **Desktop alignment:** Apply `margin: 0` and `padding-left: 17px` to `.ledger-card-body ol` alongside unordered lists.
2. **Desktop marker:** Apply `--card-code-color` to `.ledger-card-body li::marker`.
3. **Mobile alignment:** Apply `margin: 0` and `padding-left: 17px` to mobile `.ledger-card-body ol`.
4. **Mobile marker:** Use the exact inline-code color expression `color-mix(in srgb, var(--zone-color), white 52%)` for mobile `.ledger-card-body li::marker`.
5. **Regression coverage:** Assert both desktop and mobile list contracts in `frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts`.

---

## C. Acceptance Criteria

1. **Visual alignment:** On the served mobile card route, numbered list content begins at the reduced `17px` list inset.
2. **Visual color:** Each number marker resolves to the same computed color as inline backtick code in that card.
3. **Verification:** The focused frontend test, frontend typecheck, `git diff --check`, and served asset checks pass.
4. **Operator gate:** The operator confirms the corrected alignment and marker color on the Brave mobile surface.

---

## D. Subtasks

1. [Align and verify card numbered lists](card:card-7877c056-66a9-47f1-ba2d-8b00cb83c43e) — Status: complete