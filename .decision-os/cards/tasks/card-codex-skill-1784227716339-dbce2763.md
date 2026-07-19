## A. Dependency Graph

| from_task | to_task | edge_type | reason | evidence |
|---|---|---|---|---|
| T1 | T2 | shared-file-risk | The layout state and shortcut transitions both change the responsive thread lifecycle, so separate workers would collide in the same functions and could assign incompatible open and close behavior. | T1 targets `frontend/src/app/responsive/thread.js` at `openMobileThread` and `closeMobileThread`; T2 targets the same file and the same lifecycle symbols through `initializeMobileThread`, `openMobileThread`, and `closeMobileThread`. Both behaviors use `canvasState.threadPanelOpen` and the visibility of `.mobile-thread-inspector` and `.thread-panel`. |
| T1 | T3 | hard-blocker | The desktop and mobile geometry assertions require the split-layout implementation before the regression scenarios can assert final dimensions and visibility. | T3 explicitly declares `depends_on: T1`; its `done_when` requires both visible desktop columns, `clamp(420px, 33vw, 620px)` thread geometry, and retained full-screen behavior at `390px`. |
| T2 | T3 | hard-blocker | The keyboard scenarios require the responsive command router and thread transitions before they can exercise `A`, `X`, `Esc`, and editable-target suppression. | T3 explicitly declares `depends_on: T2`; its action and `done_when` require responsive key transitions plus retained canvas selection shortcuts. |

---

## B. Independent Task Groups

| group_id | task_ids | target_files | target_symbols | independence_reason | dispatch_notes |
|---|---|---|---|---|---|
| G1 | T1, T2 | `frontend/index.html`; `frontend/assets/application.css`; `frontend/src/app/responsive/application.js`; `frontend/src/app/responsive/thread.js`; `frontend/src/runtime/input/helper/is-card-editing-keyboard-target.ts` | `#card-view`; `.mobile-thread-inspector`; `.thread-panel.agent-chat.phone`; responsive `window` keydown binding; `initializeMobileThread`; `openMobileThread`; `closeMobileThread`; editable-target guard | T1 and T2 form one implementation boundary because both own responsive thread opening, closing, visibility, focus, voice cancellation, and `canvasState.threadPanelOpen`. Keeping them together prevents competing edits to `thread.js` and lets one worker preserve a single state-transition contract across layout and keyboard entry. | Implement the desktop shell state and responsive shortcut router as one change. Preserve the full-screen mobile branch below `760px`, use the existing inspector width `clamp(420px, 33vw, 620px)`, and leave the canvas keyboard controller unchanged except for consuming its existing editable-target helper where required by T2. |
| G2 | T3 | `tests/browser/application/the-application-is-one-responsive-frontend.spec.ts`; `frontend/test-responsive/mobile-thread.test.mjs`; `frontend/test/runtime/input-controller-routing.integration.test.ts` | desktop card-route scenario; responsive thread source assertions; canvas input routing assertions | These files are test-only surfaces and do not collide with G1 product files. The group is not dispatchable until G1 stabilizes the DOM, CSS state, and shortcut transitions that its assertions consume. | Add the required `1440px` and `390px` served-route observations, key-transition coverage, editable-target suppression coverage, and retained canvas shortcut assertions after G1 completes. |

---

## C. Sequential Gates

1. **G1 → G2:** G1 must establish the final desktop thread-open shell state, mobile full-screen branch, responsive `A`/`X`/`Esc` routing, editable-target suppression, focus transition, voice transition, and close transition before G2 encodes browser geometry and keyboard expectations.
2. **G2 completion condition:** the regression group must cover both viewport contracts and all responsive shortcut transitions while retaining assertions for canvas `Del`, `Ctrl+C`, `Ctrl+V`, and `Ctrl+D` routing.

---

## D. Collision Risks

1. **`frontend/src/app/responsive/thread.js`:** T1 and T2 both target `initializeMobileThread`, `openMobileThread`, and `closeMobileThread`; parallel edits could duplicate event ownership, alter close precedence, or desynchronize `canvasState.threadPanelOpen` from DOM visibility.
2. **Responsive thread visibility state:** `.mobile-thread-inspector[hidden]`, `.thread-panel[hidden]`, `body` overflow locking, `currentCard`, and `canvasState.threadPanelOpen` jointly determine whether the task and thread surfaces are visible. Layout and shortcut work must use the same transitions.
3. **Responsive key ownership:** `frontend/src/app/responsive/application.js` already owns a global `window` keydown listener, while `initializeMobileThread` owns a document keydown listener after thread initialization. T2 must prevent duplicate handling and preserve the editor guard across both entry and open-thread states.
4. **Voice-close precedence:** the existing open-thread `Escape` path cancels `canvasState.voice.recording` before closing the inspector. The responsive global shortcut path must share that precedence so G2 has one deterministic transition to verify.
5. **Browser scenario state:** `tests/browser/application/the-application-is-one-responsive-frontend.spec.ts` already creates `390px` and `1440px` pages and navigates to `#card-view`; all geometry observations belong in G2 to avoid competing setup changes.

---

## E. Ambiguities

1. **None.** Every task has a reliable group, the explicit test dependencies establish the only sequential gate, and the shared responsive thread lifecycle requires T1 and T2 to remain together.

---

## F. Readiness

READY_FOR_TASK_GROUP_COMPLETENESS
---

Codex run completed: exit code 0
