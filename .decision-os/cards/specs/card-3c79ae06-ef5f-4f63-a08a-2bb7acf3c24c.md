## A. Scope

1. **Implementation:** Make inline Markdown code in card titles and bodies inherit the card's base font.

---

## B. Requirements

1. **Color-only emphasis:** Retain `--card-code-color` without a monospace font override.
2. **Code-block boundary:** Preserve `--mono` for `.ledger-card-code-block`.
3. **Regression coverage:** Add focused CSS contract assertions.

---

## C. Acceptance Criteria

1. **Checks:** The focused frontend test, frontend typecheck, and `git diff --check` pass.
2. **Target surface:** The served operator route returns `200`; device rendering remains operator-verified.

---

## D. Findings

1. **Root cause:** Desktop card title and body selectors explicitly set `font-family: var(--mono)`. The mobile card body selector omitted `font-family`, which activated the browser's default monospace styling for `code`.
2. **Correction:** Desktop inline-code selectors and the mobile `.ledger-card-body code` selector now use `font-family: inherit`.
3. **Boundary:** `.ledger-card-code-block` continues to render with a monospace font.

---

## E. Verification

1. **Focused desktop test:** `6` tests passed in `frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts`.
2. **Focused mobile test:** `36` tests passed in `frontend-mobile/test/mobile-control-room.test.mjs`.
3. **Typecheck:** `npm run typecheck:frontend` passed.
4. **Live asset:** `http://127.0.0.1:50150/assets/mobile.css` returned `200`.
5. **Chromium computation:** Inline code and adjacent prose both resolved to `Ubuntu, system-ui, sans-serif`; fenced code resolved to `monospace`.
