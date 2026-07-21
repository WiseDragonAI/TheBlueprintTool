## A. Corrected result

1. Accepted responsive Process card launches now enter the existing `navigateVoiceSubmission()` → `navigate()` lifecycle.
2. The lifecycle closes the card detail, removes the desktop thread state, replaces the route with `/?tab=exec`, and renders the Control Room.
3. The correction is merged on `main` in `a2b6aca5`.

---

## B. Root cause

1. The first implementation changed `frontend/src/runtime/codex/effect/render-card-process-modal.ts`, which owns the canvas modal.
2. The operator-facing Execute control is owned by `frontend/src/app/responsive/codex.js`.
3. Its accepted-run event was handled by `loadRoute()` while the card URL remained active, so the modal closed and the same card rendered again.
4. A direct URL assignment did not exercise the responsive card-exit lifecycle that owns `closeCardDetail()` and `closeMobileThread()`.

---

## C. Lessons retained

1. Trace the rendered button to its owning runtime before changing a duplicated UI flow.
2. Treat card exit as an application lifecycle, not a URL mutation.
3. Reuse `navigate()` because it owns thread closure, history, retained-view commit, and route loading.
4. Verify the exact served card route before making an interaction success claim.
5. A passing test for a different runtime surface is not evidence for the operator-facing control.

---
