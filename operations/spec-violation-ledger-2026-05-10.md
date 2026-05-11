# Spec Violation Ledger - 2026-05-10

Scope: CoreV2 canvas workbench implementation pass.

## V-001: Card edit control was inert

Violated spec: card edit affordances must be effective.

Why it was violated: the first pass rendered an `Edit` button but only routed the click to a toast-style notice. There was no editor modal, no form state, and no apply path back to the rendered card.

Remediation: `frontend/src/ui/app.ts` now opens a real card editor modal and applies title/body changes to the card DOM.

## V-002: Panning inside an unselected zone selected the zone instead of panning

Violated spec: left-click drag from an unselected zone pans the canvas; zone movement requires selected zone state.

Why it was violated: pointer-down was treated as selection immediately, so drag intent and click selection were conflated.

Remediation: unselected zone/group pointer-down now enters a pending pan-or-select state. A click selects; a drag pans the canvas without selecting.

## V-003: Relationship arrows did not redraw from moved card geometry

Violated spec: arrows must adapt to the shortest available card border path and use evenly spaced ports.

Why it was violated: the first path renderer stored initial SVG paths and did not recompute source/target side, port slot, and bezier endpoints from live card rectangles after drag.

Remediation: drag updates now call relationship overlay recomputation, choose the shortest side pair, spread shared side ports deterministically, and update path/label positions. SVG markers now use `orient="auto"` and initial render emits side/slot datasets so top-border arrows rotate with the path direction instead of pointing sideways.

## V-004: Relationship labels were dark on a dark canvas

Violated spec: connection labels must remain legible on the dark blueprint background.

Why it was violated: the SVG text inherited default dark text styling and had no contrast-specific rule.

Remediation: relationship text now uses a light fill with dark stroke paint ordering.

## V-005: Non-spec zoom controls were added to the toolbox

Violated spec: the toolbox contains zone/group/toolbox actions only; zoom is a canvas gesture, not a toolbox button.

Why it was violated: extra convenience buttons were added without checking the toolbox card list.

Remediation: zoom buttons were removed from the toolbox. Wheel zoom remains available as a canvas gesture.

## V-006: Closing the conversation ledger left a dead right column

Violated spec: closing the thread/conversation panel must free the right-side work area.

Why it was violated: the first implementation only hid the aside element and left the grid template column allocated.

Remediation: closing the panel now hides the aside and toggles a workbench class that collapses the third grid column to `0px`.

## V-007: Direct tab URLs returned JSON instead of the app shell

Violated spec: route-addressable tabs must load the proper ledger UI when opened directly.

Why it was violated: backend route resolution returned a `tab` JSON payload for browser navigation instead of serving `frontend/index.html`.

Remediation: native server route handling now serves the browser shell for tab routes while preserving JSON API routes.

## V-008: Zone color only affected the border

Violated spec: zone color must drive the main zone visual theme.

Why it was violated: the draft zone logic only set `borderColor`; CSS did not bind the chosen color to zone background/header variables.

Remediation: zone color now sets `--node-accent`, `--zone-fill`, and `--zone-header`.

## V-009: Cards inside zones did not inherit zone color

Violated spec: cards within a zone inherit the zone color treatment.

Why it was violated: render and drag code did not compute zone-card intersection for visual inheritance.

Remediation: initial render and live drag/update passes compute intersecting zones and apply card accent/fill variables.

## V-010: Cards used an unstyled light placeholder theme

Violated spec: workbench cards must be styled as part of the dark blueprint UI.

Why it was violated: placeholder card CSS used a white background and default panel treatment.

Remediation: cards are now dark themed with accent borders, zone-tinted fills, readable text, and consistent button styling.

## V-011: Select was incorrectly exposed as a toolbox tool

Violated spec: selection is an on-click behavior, not a toolbox mode.

Why it was violated: the toolbox renderer included a `select` button by copying runtime tool state literally.

Remediation: the select button was removed. The app uses `none`, `zone`, and `group` as UI tool states while click selection remains always available.

## V-012: Escape did not clear the active tool

Violated spec: Escape clears the current tool/selection context.

Why it was violated: the app lacked a keydown interaction layer.

Remediation: global key handling now clears active tool, selection, modal, context menu, and active drag state on Escape.

## V-013: Delete did not ask for confirmation

Violated spec: deleting a selected zone/card requires a confirmation modal.

Why it was violated: deletion flow was not wired to keyboard interaction or modal state.

Remediation: Delete/Backspace now opens a confirmation modal and deletion only executes from the confirmation action.

## V-014: Conversation ledger styling was placeholder-level

Violated spec: the workbench must use an advanced, coherent UI/UX treatment.

Why it was violated: the first pass focused on DOM presence and left the panel as a raw textarea/button layout.

Remediation: the thread panel now uses the same dark design system, compact header, styled textarea, voice row, and closable affordance.

## V-015: Background pattern exposed empty space when zooming out

Violated spec: the blueprint canvas background must visually continue through zoomed/panned view states.

Why it was violated: the patterned world was too small and only covered the initial working area.

Remediation: the canvas world is now substantially larger and is the only element that paints the repeating blueprint pattern. The canvas surface is a solid fallback background so the transformed world does not double-render against another pattern layer.

## V-016: Controller/runtime code drifted from scaffold shape

Violated spec: generated scaffold shape and one-function-per-file expectations must be respected.

Why it was violated: the implementation concentrated browser interaction glue in `frontend/src/ui/app.ts` and runtime helpers in a broad runtime module instead of keeping all behavior aligned to generated function file boundaries.

Remediation: generated business functions remain one function per source file. Browser geometry, zone color inheritance, live SVG overlay routing, and runtime relationship routing are now split into one-function TypeScript implementation files with barrel exports only for stable import paths.

## V-017: New browser logic initially looked like plain JavaScript

Violated spec: the whole frontend and backend codebase must be TypeScript.

Why it was violated: some helper logic was added in browser-style imperative code without enough explicit interfaces around relationship routing and interaction state.

Remediation: the touched frontend/backend sources compile under strict TypeScript, relationship routes/ports now use explicit TypeScript types, and `npm run typecheck:frontend` plus `npm run typecheck:backend` pass.
