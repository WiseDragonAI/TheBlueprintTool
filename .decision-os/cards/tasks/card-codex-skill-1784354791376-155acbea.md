## A. Closeout result

1. **Master task:** `card-ac39aa2b-fd9a-4688-a897-ef66df98e2ed` is authorized for canonical completion.
2. **Delivered behavior:** accepted responsive Process skill launches now use `navigateVoiceSubmission()` → `navigate()` and return to Control Room Exec after closing the card detail and thread state.
3. **Corrected implementation:** merged on `main` in `a2b6aca5` after the first implementation in `1ab17742` targeted the wrong runtime.
4. **Task gate:** ready with no discrepancies; both canonical subtasks are `done`.
5. **Completion:** the canonical `master-task-complete` operation was invoked exactly once for the master card.

---

## B. Retrospective

1. **Incorrect decision:** the first implementation changed the canvas Process modal instead of tracing the operator-facing Execute control to `frontend/src/app/responsive/codex.js`.
2. **Observed failure:** the accepted-run listener called `loadRoute()` while the card URL remained active, so the Process modal closed and the same card rendered again.
3. **Operator correction:** launching a skill must preserve the already-established post-submit UX used by message submission and return to Control Room.
4. **Structural correction:** the responsive listener now delegates to the shared navigation lifecycle that owns card closure, thread cleanup, history replacement, retained-view commit, and route rendering.
5. **Verification correction:** the final behavior was exercised in Chromium on the exact served card route; the observed destination was `/?tab=exec`, with the Process modal closed, card view hidden, Control Room visible, and `card-thread-open` absent.

---

## C. Durable lessons saved

1. **Memory `19` — Trace the operator-facing control before editing:** trace a rendered control from the exact served route to its owning runtime before changing duplicated UI flows.
2. **Memory `20` — Use the application lifecycle for card exits:** route every card exit through the lifecycle that owns detail closure, thread cleanup, history, and rendering.
3. **Memory `21` — Preserve post-submit UX across equivalent actions:** equivalent accepted actions must preserve the established destination and cleanup behavior.
4. **Memory `22` — Verify the exact operator-facing interaction surface:** exercise the exact served route and owning runtime with representative browser input before claiming interaction success.
5. **Classification:** all four records are `code` lessons and cite `1ab17742`, `a2b6aca5`, `codex-skill-1784291468036-86c6d221`, and `codex-skill-1784354791376-155acbea`.

---

## D. Canonical subtasks

1. **Done:** [Trace direct skill and Shift+X navigation flows](card:card-67f41d8b-0da9-4b8b-9ab1-dc22b8f9362e).
2. **Done:** [Navigate successful direct skill launches to Exec](card:card-a4cbb933-2fd2-4907-ae67-4ae603a69fe7).
---

Codex run completed: exit code 0
