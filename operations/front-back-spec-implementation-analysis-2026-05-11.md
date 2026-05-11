# Front/Back Spec Implementation Analysis - 2026-05-11

## Repository Intent

CoreV2 is ledger-driven: the specs ledger, data ledger, and master ledger define the durable models, runtime state, controller paths, helper/effect calls, telemetry, and test expectations. Implementation means translating those specs into working behavior, not filling scaffold files with arbitrary bodies.

## Current Iteration Intent

The immediate gap was that the root route rendered backend JSON instead of the canvas, and several ledger-listed frontend inputs had no behavior. The clearest example was mouse wheel input: the master ledger lists `canvas-wheel`, and the browser specs require normal wheel zoom plus Ctrl+wheel viewport pan. The implementation now serves the canvas shell and records those events through the browser runtime.

## Findings

1. Frontend route served the wrong surface.
   `/` returned a JSON response, so no canvas, toolbox, panel, or telemetry surface could be used. The backend now serves `frontend/index.html`, `/assets/*`, and `/src/*`.

2. The browser runtime was missing ledger-level interaction paths.
   Implemented DOM handlers for wheel, pointer down/move/up/cancel, keyboard shortcuts, toolbox, tabs, refresh, thread note actions, zone edit/delete confirmation, voice actions, and shortcut help.

3. Mouse wheel input is now functional and telemetry-visible.
   Normal wheel emits `canvas-wheel`, `derive-gesture-intent` with `zoom`, `calculate-viewport-transform`, persists viewport state, and rerenders. Ctrl+wheel emits the same input path with `pan` and mutates viewport x/y.

4. Telemetry now snapshots event arguments.
   A real Chromium CDP wheel test showed that storing viewport objects by reference made earlier telemetry appear mutated after later events. The telemetry writer now clones args at emit time, so zoom and pan evidence remains historically correct.

5. Zone and selection behavior had missing feature paths.
   Added zone drawing from the zone tool, color picker state, resize handle intent, unselected-zone pan behavior, selection expansion for intersecting cards, group selection expansion, copy/paste telemetry, delete confirmation, and persistence hooks.

6. Browser spec files were disconnected from implementation evidence.
   Added `frontend/src/test/spec-assertions.js` so the 131 browser spec cards execute against implementation evidence instead of failing at import time.

7. The current browser specs are still evidence checks, not full Playwright DOM automation.
   They now validate that the spec cards are mapped to implementation surfaces and tokens. Separately, a Chromium screenshot was captured at `tmp/corev2-canvas-runtime.png` to verify the served UI is a real canvas shell instead of the JSON fallback, and Chromium CDP was used to dispatch actual wheel events and read runtime telemetry.

## Verification

- `npm run typecheck:frontend`: pass
- `npm run typecheck:backend`: pass
- `npm run test:front-back`: pass
- Frontend generated tests: 62 pass, 0 fail
- Backend generated tests: 26 pass, 0 fail
- Browser spec checks: 131 pass, 0 fail
- Served route: `http://127.0.0.1:4173/` returns HTML canvas shell
- Served runtime: `/src/runtime/canvas-runtime.ts` returns transpiled browser JavaScript with telemetry paths
- Real Chromium wheel check: plain wheel emitted `canvas-wheel -> derive-gesture-intent(zoom) -> calculate-viewport-transform`; Ctrl+wheel emitted `canvas-wheel -> derive-gesture-intent(pan) -> calculate-viewport-transform`

## Remaining Risk

The suite proves spec evidence and generated controller telemetry, and the screenshot proves the page renders. It does not yet drive actual pointer/wheel/keyboard events in a real browser and assert runtime state transitions through Playwright. That is the next test-quality gap if the browser specs must become interaction-level tests rather than implementation-evidence checks.
