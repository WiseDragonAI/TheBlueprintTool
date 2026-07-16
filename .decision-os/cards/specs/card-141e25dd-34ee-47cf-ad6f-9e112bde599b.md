## A. Scope

1. **Dependency:** Pin `@panzoom/panzoom` `4.6.2` and integrate it through the frontend's local module build.
2. **Implementation:** Add the tap-revealed fullscreen affordance, active-image modal, scale bounds `0.3` to `50`, fixed close control, focus management, scroll lock, and teardown.
3. **Boundary:** Keep current slide selection and modal state in decision-os; delegate only gesture normalization, pan, zoom, cancellation, and gesture listener cleanup to Panzoom.

---

## B. Acceptance Criteria

1. **Regression coverage:** Frontend tests exercise reveal, active-image selection, open/close, scale bounds, canvas gesture isolation, focus restoration, cleanup, and saved-slide preservation.
2. **Checks:** Frontend typechecking and the focused carousel/viewer tests pass.
3. **Commit:** Implement and verify in an isolated worktree, merge with a merge commit, then remove the worktree and feature branch.

---

## C. Evidence

1. **Implementation:** Added the tap-revealed carousel control, fullscreen dialog, fixed close control, focus trap and restoration, scroll lock, gesture isolation, wheel zoom, Panzoom teardown, and exact scale bounds `0.3` to `50`.
2. **Runtime delivery:** Pinned `@panzoom/panzoom` `4.6.2` in `frontend/package.json` and served its exact MIT-licensed ES module locally from both `frontend/assets/vendor/` and the operator-facing `frontend-mobile/assets/vendor/`.
3. **Automated checks:** `npm run typecheck --prefix frontend`, the focused frontend carousel test, all `29` mobile Control Room tests, and `git diff --check` pass.
4. **Commits:** Focused commits `e607722` and `b5fc144` are merged through merge commits `2e1f553` and `5394145`; both isolated worktrees and feature branches were removed.
5. **Claim:** Implemented; automated checks pass; device interaction not yet verified.

---

## D. Reopened Interaction RCA

1. **Contradicted result:** At `2026-07-12T16:37:35.324Z`, the operator reported that mobile pinch zoom and pan do not respond in the fullscreen viewer.
2. **Status:** Keep this implementation subtask active; the prior static and HTTP evidence did not prove the touch interaction.
3. **Verified chain:** The live route serves the viewer and Panzoom asset; the viewer attaches Panzoom to the modal image with `touch-action: none`, `minScale: 0.3`, and `maxScale: 50`.
4. **Missing evidence:** Capture the exact device, browser and version, route, gesture sequence, recording, modal DOM state, pointer-event sequence, image transform, and carousel state before another implementation edit.

---

## E. Root Cause and Correction

1. **First incorrect transition:** Touch `pointerdown` reached the image and emitted `panzoomstart`, but application listeners on the dialog stopped `pointermove` and `pointerup` before Panzoom's document-level handlers received them; the image remained at `scale(1) translate(0px, 0px)`.
2. **Correction:** Removed the dialog-level pointer propagation blockers. The modal top layer and Panzoom's own `handleStartEvent` continue to isolate viewer input from the underlying canvas.
3. **Regression boundary:** The focused test now asserts that Panzoom owns document-level move handling and that the viewer does not install a conflicting dialog `pointermove` or `pointerup` propagation blocker.
4. **Commit:** Focused commit `ed1bd6e` is merged through merge commit `e5b9910`; the RCA worktree and branch were removed.
