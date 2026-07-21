## A. Outcome and correction

1. **Requested outcome:** bottom-pinned threads must open at the newest content while preserving the reader's immediate ability to scroll upward.
2. **Delivered result:** commit `e6ae4c70`, merged by `b3107975`, separated reader-owned scroll state from render and delayed-layout synchronization and made the queued entry pin revalidate thread identity and follow-bottom state.
3. **Verified behavior:** Chromium moved `scrollTop` from `1566` to `1066` after upward wheel input; delayed content growth left it at `1066`. Focused tests passed `25/25`, and the full frontend suite passed `504/504`.

---

## B. Retrospective finding

1. **Incorrect architectural decision:** a two-frame suppression window coupled programmatic render tracking to reader-owned position and follow-bottom state. An upward scroll during that window could not revoke follow-bottom authority, so `ResizeObserver` later snapped the viewport back to `scrollHeight`.
2. **Operator correction:** the operator explicitly required this architectural regression to be retained as a durable lesson.
3. **Preventive boundary:** only actual viewport scroll events may mutate saved reader position and follow-bottom state. Render, restore, pin, and delayed-layout synchronization must remain outside that ownership path, and deferred writes must revalidate current ownership before changing the viewport.

---

## C. Durable memory

1. **Saved record:** code memory `73`, `Keep reader scroll ownership event-driven`.
2. **Deduplication:** the project memory search for scroll ownership, follow-bottom, render suppression, and `ResizeObserver` returned no existing matching lesson before insertion.
3. **Source:** `e6ae4c70`, `b3107975`, `codex-skill-1784542325653-978e49ff`, and `codex-pipeline-1784552421560-ca73562d`.

---

## D. Closure

1. **Gate result:** ready with no discrepancies; both canonical subtasks were already `done`.
2. **Canonical action:** `ledger-cli master-task-complete --card-id card-2f561c37-bdcd-4931-be7d-d3456880ae20` invoked exactly once to complete the master task and its canonical subtasks atomically.
---

Codex run completed: exit code 0
