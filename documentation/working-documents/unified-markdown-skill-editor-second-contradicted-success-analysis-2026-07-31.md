# Unified Markdown Skill Editor — Second Contradicted-Success Analysis

## A. Decision

1. The delivery on `origin/dev` at `5d3b22ca` is not the requested Skill editor presentation. It must not enter `main`.
2. The Git-history, diff-range, save-conflict, Worker-lifecycle, teardown, and performance work is real. The canonical Markdown visual surface is absent.
3. The third completion claim is withdrawn. **Study a Unified Markdown Diff Editor Model** remains `todo`.
4. This analysis makes no production-code change. The next implementation must start from the canonical rendered Markdown reference, not from the current semantic-class test contract.

---

## B. Operator-Visible Failure

1. The exact operator route is `http://127.0.0.1:50151/skills?editor=skill&name=GateTest&projectId=ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z`; it returned HTTP `200` during this analysis.
2. The screenshot at `.decision-os/thread-images/thread-card-ce629f8b-db81-4af6-9a7b-9fdf88615919/paste-1785491551922-08216b21404c8.png` shows CodeMirror source: monospace text, line numbers, literal `#`, `**`, backticks, and Markdown list markers.
3. The reference screenshot at `.decision-os/thread-images/thread-card-ce629f8b-db81-4af6-9a7b-9fdf88615919/paste-1785491567406-4559b4a275662.png` shows canonical rendered Markdown: proportional typography, enlarged section headings, semantic list indentation, hidden delimiters, horizontal rules, and block spacing.
4. The screenshots therefore show two different presentation systems. The current Skill editor is syntax-highlighted source; the requested surface is rendered canonical Markdown with editing retained.
5. The prior run did not record the operator device and browser. It also did not record a computed-style comparison against the reference. Those omissions invalidated its visual acceptance claim.

---

## C. First Incorrect Transition

1. `parseLedgerCardMarkdown()` correctly returns canonical blocks and source ranges.
2. `createLedgerMarkdownSemanticExtension()` converts those blocks into `Decoration.mark()` ranges carrying names such as `cm-ledger-heading`, `cm-ledger-list`, and `cm-ledger-code-block`.
3. `Decoration.mark()` wraps the original bytes. It does not create canonical heading, list, code, table, question, media, and rule elements. The literal Markdown delimiters remain visible inside CodeMirror lines.
4. `renderLedgerCardMarkdown()` takes the missing step: it creates actual `h1`–`h6`, `ol`, `ul`, `li`, `p`, `hr`, table, code, media, Git-diff, and question DOM using the canonical `ledger-card-*` classes.
5. The first incorrect transition is therefore the parser-to-presentation adapter. The implementation selected raw-source marks where the requested behavior required canonical rendered structures inside the editable surface.

---

## D. Styling Evidence

1. `frontend/src/runtime/codex/component/codemirror-file-editor.ts` fixes the editor scroller to `var(--mono, "Ubuntu Mono", monospace)`, `12px`, and line-oriented CodeMirror layout.
2. `frontend/assets/canvas/dialogs.css` gives `cm-ledger-heading` only accent color and weight. It gives inline strong, code, link, image, and quote ranges limited token styling.
3. The implementation maps paragraph, images, HTML, Git-diff, questions, list, table, rule, and directive blocks to `cm-ledger-*` classes, but the stylesheet defines no presentation rules for those mapped classes.
4. `frontend/assets/canvas/objects.css` gives canonical Markdown headings level-specific sizes, margins, line height, text colors, list indentation, list marker colors, rule geometry, table structure, and content spacing. The Skill editor does not use that structural boundary.
5. Adding more token CSS to the current raw spans cannot produce canonical parity because a marked source range still lacks the canonical block DOM and still contains visible syntax delimiters.

---

## E. What the Ninety-Minute Iteration Did

1. The remediation reconstructed the `GateTest` authored history and eliminated the whole-document empty-base false diff.
2. It strengthened exact addition and deletion checks, added save/reload and stale-save conflict evidence, bounded Worker settlement, rejected stale results, proved teardown, and exercised a one-million-byte document.
3. It added canonical parser-owned source ranges and semantic class names, then described those class names as “canonical semantics.”
4. The GateAgent spent its final stage on typechecks, `620/620` frontend tests, `667/667` backend tests, diff review, commits, merge, push, and canary registration.
5. None of those activities implemented the missing rendered presentation adapter. Most elapsed time proved adjacent mechanics after the central visual contract had already been reduced incorrectly.

---

## F. Why the Gate Passed

1. The browser oracle asserts exact Git additions and deletions, visible diff colors, labels, unmarked context, save behavior, conflict behavior, lifecycle settlement, and teardown.
2. Its complete Markdown presentation check is: at least one `.cm-ledger-heading` contains expected text, `.cm-ledger-list` exists, and `.cm-ledger-code-block` exists.
3. The oracle does not assert canonical element types, canonical classes, computed font family, heading size, margins, line height, list structure, horizontal rules, syntax-delimiter hiding, block spacing, or screenshot parity.
4. A raw `<span class="cm-ledger-heading"># Heading</span>` therefore satisfies the test even though it visibly contradicts the reference.
5. GateAgent accepted the green internal contract and HTTP `200` as delivery readiness. It did not compare the served screenshot with the operator-named canonical Markdown component.
6. The test captured a screenshot but had no human reference-comparison gate. Green suites proved the reduced raw-source contract, not the operator outcome.

---

## G. Root Causes

1. The research phase introduced an unapproved product reduction: “source-positioned canonical semantics” became acceptable while complete `renderLedgerCardMarkdown()` parity was declared excluded. That exclusion remains codified in `documentation/documentation/architecture/codex-content-authoring.md:153`.
2. The term “canonical semantics” was then used ambiguously. In implementation it meant parser-owned byte ranges; to the operator it meant the visible canonical Markdown style.
3. The first postmortem required a live semantic Markdown surface, literal source only at the active range, and served visual comparison in `documentation/working-documents/unified-markdown-diff-editor-failure-analysis-2026-07-31.md:109-119`. The remediation left the conflicting architecture exclusion intact and implemented only parser ranges.
4. The second success claim reused the same evidence class that had already failed: internal classes, automated interaction checks, and server availability without reference-component fidelity.
5. The GateController optimized completion against its rewritten ledger instead of checking whether that ledger still represented the operator’s visible requirement.

---

## H. Required Remediation Contract

1. Keep CodeMirror as the single owner of exact Markdown bytes, transactions, history, selection, focus, search, scrolling, and disposal.
2. Replace inactive parsed Markdown blocks with CodeMirror replacement widgets that reuse the canonical renderer’s DOM helpers and `ledger-card-*` styling boundary.
3. Reveal the exact source bytes for the focused block while it is being edited. Return the block to canonical rendered form when focus leaves that block. This preserves direct editing without creating a separate preview pane.
4. Project Git additions and source-ordered deletion anchors onto those rendered blocks with accessible non-color labels. Never insert removed bytes into `EditorState.doc`.
5. Reuse `parseLedgerCardMarkdown()`, `appendInlineNodes()`, and the existing canonical block renderers. Do not recreate a second Markdown parser or duplicate the canonical styling rules under `cm-ledger-*` names.
6. Before implementation, inspect maintained CodeMirror rich-markdown and widget patterns under the repository’s complex-interaction library gate. Record the selected pinned dependency contract before production edits.
7. The served acceptance test must compare the Skill editor with the canonical Markdown reference for heading DOM and size, proportional body typography, list DOM and indentation, strong text without delimiters, code presentation, horizontal rules, paragraph spacing, and application directives.
8. The served interaction test must also prove source reveal on focus, direct editing, selection, keyboard navigation, search, undo, redo, exact save bytes, reload persistence, stale-save recovery, diff mapping, and teardown.
9. Operator QA remains mandatory before `main`. A green class-existence assertion cannot authorize another completion claim.

---

## I. Evidence Register

1. Semantic-mark implementation: `frontend/src/runtime/content-authoring/helper/create-ledger-markdown-semantic-extension.ts:31-129`.
2. Canonical DOM renderer: `frontend/src/runtime/ledger/component/render-ledger-card-markdown.ts:27-85`.
3. Raw CodeMirror typography: `frontend/src/runtime/codex/component/codemirror-file-editor.ts:78-106`.
4. Limited editor semantic styling: `frontend/assets/canvas/dialogs.css:1487-1512`.
5. Canonical Markdown styling: `frontend/assets/canvas/objects.css:879-1007`.
6. False visual oracle: `tests/browser/codex/content-authoring-canary.spec.ts:417-471`.
7. Screenshot capture without visual comparison: `tests/browser/codex/content-authoring-canary.spec.ts:492-502`.
8. Raw-source range expectation: `frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts:189-215`.
9. Architecture exclusion: `documentation/documentation/architecture/codex-content-authoring.md:141-154`.
10. Contradicted first-postmortem contract: `documentation/working-documents/unified-markdown-diff-editor-failure-analysis-2026-07-31.md:109-119`.
11. Remediation implementation: commit `0b778b47`.
12. Incorrect delivery merge: commit `5d3b22ca`.
13. GateAgent run evidence: `.decision-os/runs/codex-skills/tasks/codex-skill-1785490716749-55d3bc13.jsonl`.
14. Lifecycle and performance run evidence: `.decision-os/runs/codex-skills/tasks/codex-skill-1785488085680-29e6f416.jsonl` and `.decision-os/runs/codex-skills/tasks/codex-skill-1785488085681-6333bab3.jsonl`.
