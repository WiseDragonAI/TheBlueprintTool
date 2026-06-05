# Real Offender Mechanism Proof

This card identifies the current real offenders for:

1. Card drag while the pointer is moving.
2. Zoom transition from low-detail cards back to full-detail cards.

The mechanisms are different. Drag is a bad pointermove frame with a measured app-code offender plus browser frame production. Zoom detail transition is a global detail-layer reveal that forces browser lifecycle, layout, paint, raster, and commit work.

## Drag: Frame-Decomposed Proof

Fresh trace:

```text
output: /tmp/corev2-drag-frame-decomposition-rerun
report: /tmp/corev2-drag-frame-decomposition-rerun/prep_development_cheat_menu_ae913a0a-scale0_35-baseline-cold-run1.report.json
route: http://127.0.0.1:4173/ardaria-game-design
target: prep_development_cheat_menu_ae913a0a
scale: 0.35
runtime: 104 cards, 23 zones, 0 relationships, 35 images
```

Instrumentation proof:

- `tools/live-verify/card-drag-trace-suite.mjs:561-586` installs `window.__corev2DragTraceSpan`.
- `tools/live-verify/card-drag-trace-suite.mjs:872-902` computes exclusive source-span timing.
- `tools/live-verify/card-drag-trace-suite.mjs:904-930` groups spans by pointermove event and by frame window.
- `frontend/src/runtime/performance/drag-trace-span.ts` makes spans no-op unless the live verifier installs the tracing hook.

Runtime code path:

```text
pointermove
  -> handlePointerMove()
  -> moveSelected(canvasDx, canvasDy)
  -> moveSelectedLedgerGeometry()
  -> patchNodePosition(... left/top ...)
  -> renderZoneLabelOverlay()
  -> renderRelationshipOverlay()
  -> renderCanvasControlOverlay()
```

Source proof:

- `frontend/src/runtime/gesture/controller/handle-pointer-move.ts:20-57`: drag/group pointermove calls `moveSelected()`.
- `frontend/src/runtime/selection/effect/move-selected.ts:9-38`: movement and all overlay renderers run synchronously inside pointermove.
- `frontend/src/runtime/selection/effect/move-selected.ts:41-52`: selected card geometry is patched, then the selected node is repositioned.
- `frontend/src/runtime/selection/effect/move-selected.ts:93-96`: DOM movement writes `left/top`.
- `frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:5-48`: zone labels are rebuilt.
- `frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:30-36`: each label reads layout/style.

Worst during-drag frame:

```text
frame #13
duration: 52.0ms
phase: during-drag
```

Same-frame Chrome trace overlap:

```text
EventDispatch:pointermove: 18.224ms
ProxyMain::BeginMainFrame: 30.839ms
LayerTreeHost::WaitForCommitCompletion: 29.770ms
```

Same-frame app source spans:

```text
handlePointerMove: 17.9ms
  moveSelected: 17.7ms
    renderZoneLabelOverlay: 16.5ms
      buildLabels: 15.0ms
        readLayoutAndStyle: 13.8ms exclusive, 22 calls
      replaceChildren: 1.1ms exclusive
      appendLabel: 1.1ms exclusive, 22 calls
```

Worst pointermove event:

```text
pointermove#2
top-level handlePointerMove: 17.9ms
  moveSelected: 17.7ms
    moveSelectedLedgerGeometry: 0.7ms
      patchNodePosition:card: 0.3ms
    renderZoneLabelOverlay: 16.5ms
      readLayoutAndStyle: 13.8ms exclusive, 22 calls
      replaceChildren: 1.1ms
      appendLabel: 1.1ms exclusive, 22 calls
```

DOM read proof:

```text
pointermove:capture / offsetLeft: 792 reads, 135.6ms total
pointermove:capture / offsetTop: 528 reads, 3.5ms total
pointermove:capture / offsetWidth: 264 reads, 0.8ms total
pointermove:capture / getComputedStyle: 264 reads, 0.1ms total
```

Those reads are exactly the code in `renderZoneLabelOverlay()`:

```ts
label.style.left = `${zone.offsetLeft + title.offsetLeft}px`;
label.style.top = `${zone.offsetTop + title.offsetTop}px`;
label.style.maxWidth = `${Math.max(0, zone.offsetWidth - title.offsetLeft)}px`;
const titleStyle = getComputedStyle(title);
```

Conclusion:

- The app-side drag offender is not a vague CSS claim. It is `renderZoneLabelOverlay()` doing repeated layout/style reads during pointermove.
- `moveSelectedLedgerGeometry()` and `patchNodePosition()` are in the critical path, but they are not the measured `16ms` JS cost in this run.
- The browser-side offender is frame production after the drag mutation: the same bad frame overlaps `ProxyMain::BeginMainFrame`, lifecycle, raster/compositor events, and the app pointermove.
- This is why only removing label JS is not enough in older A/B runs: browser frame production remains slow after the selected card is moved with `left/top`.

## Drag Fix Implications

Required:

- Do not rebuild every zone label on every raw pointermove.
- Do not read zone/title `offset*` and computed style during drag.
- Drive label positions from ledger or in-flight geometry.
- Cache title visual style unless the title/style actually changes.
- Coalesce drag overlay rendering through `requestAnimationFrame`.
- Use transform preview for selected cards during drag, then commit `left/top` once on release.

Acceptance:

```text
same route/card/scale
worst during-drag frame < 16.7ms
worst EventDispatch:pointermove < 4ms
renderZoneLabelOverlay:readLayoutAndStyle absent or < 1ms per pointermove
no ProxyMain::BeginMainFrame or commit wait > 8ms during drag
```

## Zoom Detail Transition Mechanism

The slow zoom transition is specifically `low-detail -> normal detail`, crossing upward through scale `0.35`.

Runtime path:

```text
wheel
  -> handleWheel()
  -> state.viewport.scale changes
  -> applyViewportTransform()
  -> updateDetailMode()
  -> canvas.classList.toggle('low-detail', false)
  -> CSS reveals every .ledger-card-detail-layer
  -> Chrome runs style/layout/paint/raster/commit for the full detail surface
```

Source proof:

- `frontend/src/runtime/gesture/controller/handle-wheel.ts:37-60`: wheel updates viewport scale and calls `applyViewportTransform()`.
- `frontend/src/runtime/canvas/effect/apply-viewport-transform.ts:7-16`: viewport apply writes CSS vars, calls `updateDetailMode()`, then writes the canvas transform.
- `frontend/src/runtime/canvas/effect/update-detail-mode.ts:9-15`: detail mode toggles classes at the threshold; it does not measure card dimensions.
- `frontend/assets/canvas/canvas-layer.css:156-167`: `.canvas.low-detail .ledger-card-detail-layer` is hidden and uses `content-visibility: hidden`.
- `frontend/src/runtime/ledger/component/patch-ledger-card.ts:66-81`: each card contains both detail and overview layers.
- `frontend/src/runtime/ledger/component/patch-ledger-card.ts:74-80`: the detail layer contains title/body/tabs/labels/status.

Trace outputs:

```text
/tmp/corev2-real-offenders-zoom-detail
/tmp/corev2-real-offenders-zoom-detail-combo
```

Frame proof:

```text
low-to-normal baseline: 114.6ms-117.4ms worst frame
low-to-normal no-detail-layer: 23.3ms-24.5ms worst frame
low-to-normal no-grid: 50.4ms-62.2ms worst frame
low-to-normal no-overview-layer: 42.0ms worst frame
low-to-normal no-counter-scale: 63.4ms worst frame
```

Largest baseline events:

```text
ProxyMain::BeginMainFrame: about 114ms-117ms
WebFrameWidgetImpl::UpdateLifecycle: about 113ms-116ms
style/layout max: about 75ms-78ms
paint max: about 20ms-26ms
```

Conclusion:

- The zoom slowdown is not input JS.
- The stale hypothesis that `updateDetailMode()` measures cards is invalid; current code toggles classes.
- The primary offender is revealing every `.ledger-card-detail-layer` at once when `.low-detail` is removed.
- Grid/world raster contributes, but the `no-detail-layer` A/B result proves detail-layer reveal is the main offender.

## Zoom Fix Implications

Required:

- Stage `low-detail -> normal` reveal instead of revealing every full card body in one frame.
- Reveal visible and near-viewport details first.
- Hydrate offscreen card detail later or in idle time.
- Keep `content-visibility` or intrinsic-size strategy for hidden/offscreen details.
- Treat grid optimization as secondary after detail reveal is staged.

Acceptance:

```text
same 0.34 -> 0.365 low-to-normal transition
worst transition frame < 16.7ms, or staged reveal with no single blocking frame
reduced WebFrameWidgetImpl::UpdateLifecycle, style/layout, paint, and ProxyMain::BeginMainFrame overlap
comparison includes baseline, no-detail-layer, and implemented fix
```
