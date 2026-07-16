#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-13T11:19:29.682Z
Active since: 2026-07-13T11:20:08.229Z
Completed at: 2026-07-13T11:30:11.760Z

## A. Scope

1. **Card Markdown:** Preserve the card's base font for inline Markdown code rendered from backticks.
2. **Visual distinction:** Apply only `--card-code-color` to inline code; do not substitute the monospace font used by fenced code blocks.

---

## B. Requirements

1. **Body inline code:** Set `.ledger-card-body code` to inherit the surrounding card font.
2. **Title inline code:** Set `.ledger-card-title code` to inherit the surrounding card font so the contract is consistent across card Markdown.
3. **Fenced code:** Keep `.ledger-card-code-block` monospace.
4. **Regression coverage:** Assert the inline-code and fenced-code font contracts in the focused frontend integration test.

---

## C. Acceptance Criteria

1. **Inline rendering:** Backtick-delimited card text uses the same computed font family as adjacent text while retaining `--card-code-color`.
2. **Code blocks:** Fenced code blocks continue to use `--mono`.
3. **Verification:** The focused frontend integration test, frontend typecheck, and `git diff --check` pass.

---

## D. Subtasks

1. [Restore the base font for card inline code](card:card-3c79ae06-ef5f-4f63-a08a-2bb7acf3c24c) — Status: complete