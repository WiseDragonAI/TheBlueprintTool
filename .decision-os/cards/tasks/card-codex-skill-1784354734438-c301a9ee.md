## A. Retrospective

1. **Requested outcome:** Remove the obsolete global Control Room error-details disclosure while preserving task cards and their inline validation indicators.
2. **Delivered result:** Commit `a343b84c`, merged as `76e308df`, removed the disclosure's DOM node, CSS, element registration, render and failure branches, and unused grid row while retaining task-local diagnostics.
3. **Cause of the repeated defect:** Commit `ea1892a2` removed only the old styles. The independent `control-diagnostics` `<details>` path remained, and Chromium exposed its default `Details` summary after rendering replaced the authored summary.

---

## B. Durable lesson saved

1. **Memory record `18` — Remove obsolete UI across every rendering path.** When removing obsolete UI, delete its semantic DOM node, element registration, render and failure branches, layout allocation, and styles while preserving explicitly retained local indicators. Commit `ea1892a2` removed styles but left `control-diagnostics` rendering, so Chromium exposed the default `Details` summary until `a343b84c` removed the complete path.
2. Deduplication found no existing equivalent `code` lesson.
3. Source: `ea1892a2 a343b84c 76e308df codex-skill-1784354734438-c301a9ee`.

---

## C. Closure

1. The canonical completion gate reported **ready** with no discrepancies and valid thread roles.
2. Master card `card-07132fde-ffd4-4db4-a2b7-97587637438f` and its canonical subtask are **done**.
3. The atomic completion was committed as `cd20c8ff046de23b9eaee8b288aa95a3a316a343`.
---

Codex run completed: exit code 0
