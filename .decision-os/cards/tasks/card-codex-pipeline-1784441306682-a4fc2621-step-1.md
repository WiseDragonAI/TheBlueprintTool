## A. Outcome compared with the request

1. **Requested invariant:** Control Room columns must retain their scroll positions when task status changes refresh the board.
2. **Delivered result:** commit `52711fb8`, merged by `08e924f9`, prevents replacement columns and detached column nodes from overwriting remembered scroll state while restoration is pending.
3. **Regression source:** commit `a762e823` introduced hydrating and data renders in the same animation frame; replacement nodes at `scrollTop = 0` became authoritative before commit `e79167b8` could restore the saved positions.
4. **Operator correction addressed:** the implementation was re-evaluated against the original invariant after the operator reported that status changes still reset column scroll.

---

## B. Verified result

1. **Served interaction:** passed through two same-tick Control Room renders, a real `todo` to `backlog` mutation, refresh, task navigation, browser back, and reload reset.
2. **Focused frontend suite:** `51/51` passed.
3. **Frontend typecheck:** passed.
4. **Repository suite:** frontend passed; backend settings tests stopped because the workstation OpenAI key superseded the fixture literal `settings-key`. The failure is outside the changed Control Room files.
5. **Canonical subtasks:** `card-dd9ee16f-25d4-4b02-84cd-5893297ca9f4` and `card-411fa6e2-b8b3-40c6-843b-0e2e959888b9` were both verified `done`; the master-task gate reported no discrepancies.

---

## C. Durable memory saved

1. **Record `66` — Protect deferred DOM-state restoration:** Treat deferred DOM-state restoration as a protected transition: only the currently mounted container may update remembered state, and replacement or detached nodes remain non-authoritative until restoration settles.
2. **Evidence retained:** commit `a762e823` exposed the same-frame render race; `52711fb8` corrected it; the served regression exercised a status mutation and late events from removed nodes.
3. **Classification:** `code` / `frontend` / `scroll-restoration`.
4. **Source:** `e79167b8`, `a762e823`, `52711fb8`, `08e924f9`, `codex-skill-1784439508139-45a0918e`, and `codex-pipeline-1784441306682-a4fc2621`.

---

## D. Closure

1. **Authorized action:** this intentional retrospective invocation authorizes atomic completion of master card `card-3add8dea-07f1-4882-84e0-5c45b7967583` and its canonical subtasks.
---

Codex run completed: exit code 0
