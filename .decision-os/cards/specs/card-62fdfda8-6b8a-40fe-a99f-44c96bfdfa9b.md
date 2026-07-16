#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-13T09:38:43.307Z
Active since: 2026-07-13T10:10:06.152Z
Completed at: 2026-07-13T10:15:13.646Z

## A. Scope

1. **Objective:** Make Markdown in thread notes preserve the intended desktop visual contract on the mobile surface.
2. **Inline code:** Render backtick-delimited inline code in the surrounding sans-serif font and use the thread secondary accent color.
3. **Ordered lists:** Preserve numbered-list semantics and color each visible number with the thread secondary accent.
4. **Surfaces:** Apply the shared thread rules to desktop and mobile without changing fenced code-block typography.

---

## B. Acceptance Criteria

1. **Inline code typography:** Inline code inside a thread note uses the note's inherited font while retaining accent-color differentiation.
2. **Ordered-list semantics:** Consecutive Markdown items beginning with `1.`, `2.`, and later numbers render as an `ol`, not separate paragraphs.
3. **Marker color:** Ordered and unordered thread-list markers use the thread accent color on both desktop and mobile.
4. **Code blocks:** Fenced code blocks retain monospace syntax-highlighted presentation.
5. **Regression coverage:** Parser, renderer, and mobile style contracts have focused automated coverage.

---

## C. Subtasks

1. [Implement shared thread Markdown styling](card:card-1bc22bdf-1008-421a-aeba-0e783bf4206f) — Status: complete
---

## D. Implementation Evidence

1. **Root cause:** `parseLedgerCardMarkdown` treated numbered Markdown lines as independent paragraphs, so the renderer produced no list marker for CSS to color.
2. **Implementation:** Commit `51baf95`, merged by `bff6b7c`, preserves ordered-list semantics, emits `ol` markup, inherits the thread-note font for inline code, accents inline code and list markers, and keeps fenced code blocks monospace.
3. **Automated verification:** Frontend TypeScript passes and the focused parser, renderer, and thread-style suite passes `26/26`.
4. **Full-suite baseline:** The full frontend run retains three unrelated failures in media rendering, Codex-run cache behavior, and input-routing source contracts; all Markdown-focused tests pass.
5. **Served target:** `GET http://127.0.0.1:50150/specs/zone/zone-f233f487-1e5e-4aac-99eb-8e2969e64d9b/card/card-62fdfda8-6b8a-40fe-a99f-44c96bfdfa9b` returns `200`; the served CSS and renderer expose the merged rules. No server restart was performed.
6. **Contradicted device result:** Mobile Brave at `2026-07-13T09:51:36Z` shows ordered-list marker `1.` in cyan while inline code in the same agent note remains visually indistinguishable from body text.
7. **Persisted source:** The displayed agent note in `thread-card-8b9dee68-8979-4112-b59d-6781713a9677.md` contains backticks around `LedgerCli`, `command -v LedgerCli`, and `sh -lc`.
8. **DOM reproduction:** The shared parser and renderer produce three `code` elements for those exact spans; the new regression asserts their tag names and text.
9. **First incorrect transition:** `frontend-mobile/assets/mobile.css` loads after `thread.css`; its `.ledger-card-body code` rule had equal specificity and therefore replaced the intended thread code color on mobile.
10. **RCA correction:** Commit `a689b51`, merged by `817960c`, raises the shared thread selector to `.thread-note .thread-note-message code`, which outranks the later generic mobile card rule without using `!important`.
11. **Verification:** Frontend TypeScript passes, the focused Markdown and CSS suite passes `27/27`, and the mobile thread suite passes `6/6`.
12. **Served target:** The exact affected mobile route returns `200`; served `thread.css` contains the stronger selector with `cache-control: no-store`. Local headless Chromium cannot load the target because its Android network subprocess fails to link `libtermux-exec.so`, so mobile Brave remains the behavioral gate.
