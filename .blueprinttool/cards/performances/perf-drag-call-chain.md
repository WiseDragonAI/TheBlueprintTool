# Drag Move Call Chain

This card replaces the earlier after-release-focused analysis. The relevant drag problem is inside frames while the pointer is moving.

Fresh measured run:

```text
output: /tmp/corev2-drag-frame-decomposition-rerun
report: /tmp/corev2-drag-frame-decomposition-rerun/prep_development_cheat_menu_ae913a0a-scale0_35-baseline-cold-run1.report.json
route: http://127.0.0.1:4173/ardaria-game-design
target: prep_development_cheat_menu_ae913a0a
scale: 0.35
runtime: 104 cards, 23 zones, 0 relationships, 35 images
moves: 12 pointer moves
DOM read probes: enabled
source spans: enabled
```

## Current Source Path

The drag pointermove path is:

```text
handlePointerMove()
  -> moveSelected(canvasDx, canvasDy)
  -> moveSelectedLedgerGeometry()
  -> patchNodePosition(... left/top ...)
  -> renderZoneLabelOverlay()
  -> renderRelationshipOverlay()
  -> renderCanvasControlOverlay()
```

Source links:

- `frontend/src/runtime/gesture/controller/handle-pointer-move.ts:20-57`: `handlePointerMove()` calls `moveSelected()` for `drag` and `group`.
- `frontend/src/runtime/selection/effect/move-selected.ts:9-38`: `moveSelected()` moves selected geometry, emits telemetry, then synchronously renders zone labels, relationships, and controls.
- `frontend/src/runtime/selection/effect/move-selected.ts:41-52`: active-ledger card drag patches ledger geometry and calls `patchNodePosition()`.
- `frontend/src/runtime/selection/effect/move-selected.ts:93-96`: `patchNodePosition()` writes `style.left` and `style.top`.
- `frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:5-48`: zone labels are fully rebuilt on every call.
- `frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:30-36`: each label reads `offsetLeft`, `offsetTop`, `offsetWidth`, and `getComputedStyle()`.

## Worst During-Drag Frame

The worst during-drag frame in the fresh run is frame `#13`:

```text
frame #13
phase: during-drag
duration: 52.0ms
window: 259.2ms -> 311.2ms
```

Chrome trace overlap inside that same frame:

```text
EventDispatch:pointermove: 18.224ms
ProxyMain::BeginMainFrame: 30.839ms
LayerTreeHost::WaitForCommitCompletion: 29.770ms
raster-composite grouped overlap: 645.322ms across traced raster/compositor events
style-layout grouped overlap: 58.067ms across many small layout/style events
```

App source spans inside that same frame:

```text
handlePointerMove: 17.9ms
  moveSelected: 17.7ms
    renderZoneLabelOverlay: 16.5ms
      renderZoneLabelOverlay:buildLabels: 15.0ms
        renderZoneLabelOverlay:readLayoutAndStyle: 13.8ms exclusive, 22 calls
      renderZoneLabelOverlay:replaceChildren: 1.1ms exclusive
      renderZoneLabelOverlay:appendLabel: 1.1ms exclusive, 22 calls
```

That is the missing frame decomposition. The app event alone nearly consumes a full `16.7ms` frame budget, and most of that app event is not abstract "CSS"; it is source code in `renderZoneLabelOverlay()` repeatedly forcing layout-dependent reads while rebuilding labels.

## Worst Pointermove Event

Worst measured pointermove source span:

```text
pointermove#2
top-level app span: 17.9ms
handlePointerMove: 17.9ms
  moveSelected: 17.7ms
    moveSelectedLedgerGeometry: 0.7ms
      patchNodePosition:card: 0.3ms
    renderZoneLabelOverlay: 16.5ms
      replaceChildren: 1.1ms
      buildLabels: 15.0ms
        readLayoutAndStyle: 13.8ms exclusive, 22 calls
      telemetry: 0.1ms
      appendLabel: 1.1ms exclusive, 22 calls
  calculate-drag-delta telemetry: 0.1ms
```

This recomposes to the pointermove app time with normal rounding error:

```text
0.7ms movement
+ 16.5ms zone labels
+ 0.5ms relationships/controls/surrounding pointermove work
= 17.7ms measured inside a 17.9ms top-level handlePointerMove span
```

## DOM Read Proof

The same report recorded DOM reads by active event:

```text
pointermove:capture / offsetLeft: 792 reads, 135.6ms total
pointermove:capture / offsetTop: 528 reads, 3.5ms total
pointermove:capture / offsetWidth: 264 reads, 0.8ms total
pointermove:capture / getComputedStyle: 264 reads, 0.1ms total
```

This matches the code exactly:

```ts
label.style.left = `${zone.offsetLeft + title.offsetLeft}px`;
label.style.top = `${zone.offsetTop + title.offsetTop}px`;
label.style.maxWidth = `${Math.max(0, zone.offsetWidth - title.offsetLeft)}px`;
const titleStyle = getComputedStyle(title);
```

There are 22 visible labels in the bad pointermove. The function reads layout/style per visible label, then appends a replacement label. That is why a label pass is around `16ms`.

## What Is Validated

Validated:

- Drag frames are bad during pointer movement, not only after release.
- `renderZoneLabelOverlay()` is the dominant app-side pointermove offender in this Ardaria trace.
- The exact hot subspan is `renderZoneLabelOverlay:readLayoutAndStyle`.
- `moveSelectedLedgerGeometry()` and `patchNodePosition()` are present in the chain but are not the measured `16ms` JS cost in this run.
- Relationships are not the reproduced cause in this run because the ledger has `0 relationships`; relationships measured below the dominant label path.
- Controls are not the reproduced pointermove cause in this run; the measured app frame is dominated by zone labels.
- Browser frame production is also a real visible-frame offender: the same bad frame overlaps `ProxyMain::BeginMainFrame` and lifecycle/raster work after the selected card is moved with `left/top`.

Invalidated:

- Any claim that the drag problem is mainly after release.
- Any claim based only on accumulated totals.
- Any claim that "CSS style" alone explains the slowdown without pointing to the code path that triggers style/layout work.

## Fix Direction

First fix the measured JS offender:

- Stop rebuilding every zone label on every raw pointermove.
- Stop reading `offsetLeft`, `offsetTop`, `offsetWidth`, and `getComputedStyle()` for every visible zone during drag.
- Use ledger/in-flight geometry for label position and cached title style.
- Coalesce label/relationship/control overlay updates through one `requestAnimationFrame`.

Then fix the browser frame-production offender:

- Move selected cards with a compositor-friendly transform preview during drag.
- Commit `left/top` once on release.
- Feed labels, relationships, and controls from the same in-flight geometry so feedback stays correct while the DOM position is previewed.

Acceptance proof for the drag fix:

```text
same route/card/scale
worst during-drag frame < 16.7ms
worst EventDispatch:pointermove < 4ms
renderZoneLabelOverlay:readLayoutAndStyle absent or below 1ms per pointermove
no ProxyMain::BeginMainFrame / commit overlap above 8ms during drag
```
