# Ledger Overview Canvas Refactor Plan

## Summary

Add a first-class `/ledgers` canvas mode where each real ledger is represented as a card. The overview layout persists in a hidden ledger-like file, reuses existing card, zone, and group UX, and becomes the parent surface for future infinite-layout navigation.

Header click, toolbox button, and extra wheel-out from a fully zoomed-out ledger all enter this overview. Zooming into the overview past the low-detail/normal threshold opens the ledger nearest the viewport center, using full card geometry.

## Key Changes

- Add `canvasMode: 'ledger' | 'ledgers'` to runtime state, keeping `activeTab` as the selected real ledger only.
- Add hidden overview persistence at `.decision-os/ledgers-canvas.json`; do not add it to `.decision-os/state.json.tabs`.
- Add backend GET/PATCH support for `/decision-os/ledgers-canvas`, using the same ledger card/annotation mutation behavior as real ledgers.
- Refactor backend ledger mutation handling out of the large HTTP route into semantic one-function-per-file helpers/controllers so real ledger and overview mutations share code.
- Render the overview through the existing ledger DOM contract:
  - one card per tab with id `ledger-card:<tabId>`
  - `targetLedgerId` maps the card back to the real ledger
  - overview zones/groups use the existing `annotations` schema
  - new tabs get default grid positions while existing persisted geometry is preserved

## Interaction Behavior

- In normal ledger mode, show a small viewport-fixed `Ledgers` indicator when `viewport.scale` is at the min zoom threshold.
- In `handle-wheel`, if the user wheels out while already clamped at min zoom, enter `/ledgers` instead of silently clamping.
- In `/ledgers`, normal wheel zoom continues until zooming in crosses `0.35`; then open the target ledger nearest the viewport center.
- Target resolution must use full card geometry: compute each overview card center from `x + w / 2` and `y + h / 2`; if viewport center is inside a card rect, that card wins, otherwise choose nearest card center.
- Entered ledgers open in a canonical fully-zoomed-out framing, not the prior detailed working viewport. Direct tab/route loads may continue restoring saved ledger viewports.
- Header title becomes a clickable control that navigates to `/ledgers`.
- Add a toolbox button with `data-action="open-ledgers-canvas"` for the same navigation.
- Remove top-bar ledger-tab navigation from the primary workflow; topbar should show current ledger identity, not all ledgers.

## Coding Conventions

- Every new exported function lives in its own file under the appropriate runtime/backend subtree.
- File/function names should be semantic, for example:
  - `enter-ledgers-canvas-controller`
  - `enter-ledger-controller`
  - `load-ledgers-canvas-state`
  - `resolve-overview-target-ledger`
  - `active-ledger-endpoint`
  - `ensure-ledgers-canvas-document`
- Add header comments to new or meaningfully refactored functions with `WHAT` and `WHY`.
- Add short comments before branch-heavy blocks, especially:
  - wheel branch for ledger mode vs overview mode
  - route branch for `/ledgers` vs real ledger tab
  - backend branch for hidden overview ledger vs visible tab ledger
- Keep comments explanatory, not repetitive.

## Test Plan

- Unit/helper tests:
  - overview target resolution uses full `x/y/w/h` geometry and viewport center
  - endpoint resolution returns `/decision-os/ledgers-canvas` only in `ledgers` mode
  - hidden overview document merges current tabs while preserving persisted card/zone/group geometry
- Backend tests:
  - `/ledgers` serves the app route
  - `/decision-os/ledgers-canvas` GET returns ledger cards for all tabs
  - PATCH persists card, zone, group, and viewport geometry to the hidden file
  - hidden overview file is not rendered as a normal tab
- Browser tests:
  - at min zoom, indicator appears
  - one extra wheel-out enters `/ledgers`
  - header click enters `/ledgers`
  - toolbox button enters `/ledgers`
  - zones/groups can be created, moved, resized, and persisted on the overview
  - zooming in past `0.35` opens the viewport-center ledger card
  - real ledger mode still supports normal card/zone/group editing and persistence
- Regression tests:
  - existing low-detail thresholds remain `0.35` and `0.18`
  - min zoom remains `0.03` inside ledger mode
  - current decision-os route/state rename compiles before feature tests run

## Assumptions

- Overview route is `/ledgers`.
- Overview persistence uses hidden `.decision-os/ledgers-canvas.json`.
- Zoom-in selection is viewport-center based, with full card geometry considered.
- This refactor is allowed to update tests that currently assert all ledger tabs are rendered in the topbar.
