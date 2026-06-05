# Real Offender Mechanism Proof

This card separates two different slow paths:

1. Card drag while a card is moving.
2. Zoom transition from low-detail cards back to full-detail cards.

The mechanisms are different. Drag has an app-side hot path plus browser frame production. Zoom transition is mostly browser frame production caused by revealing full card detail for the whole ledger in one class change.

## Evidence Sources

Trace outputs:

```text
/tmp/corev2-real-offenders-drag
/tmp/corev2-real-offenders-zoom-detail
/tmp/corev2-real-offenders-zoom-detail-combo
```

Trace tools:

```text
tools/live-verify/card-drag-trace-suite.mjs
tools/live-verify/zoom-detail-transition-trace.mjs
```

Current measured Ardaria route shape in the trace runs:

| Run | Cards | Zones | Relationships | Images |
| --- | ---: | ---: | ---: | ---: |
| Drag trace | 103 | 23 | 0 | 35 |
| Zoom detail trace | 100 | 21 | 0 | not material to primary result |

## Drag Mechanism

Runtime code path:

```text
pointermove
  -> handlePointerMove()
  -> moveSelected(canvasDx, canvasDy)
  -> moveSelectedLedgerGeometry(dx, dy)
  -> patchNodePosition(... left/top ...)
  -> renderZoneLabelOverlay()
  -> renderRelationshipOverlay()
  -> renderCanvasControlOverlay()
```

Source proof:

| Step | File / line | Mechanism |
| --- | --- | --- |
| Drag enters `moveSelected()` | `frontend/src/runtime/gesture/controller/handle-pointer-move.ts:37-42` | Pointermove dispatch calls selected-object movement for drag/group intents. |
| Move path renders overlays synchronously | `frontend/src/runtime/selection/effect/move-selected.ts:8-19` | After geometry mutation, it immediately renders zone labels, relationships, and controls in the same pointermove. |
| Active-ledger movement mutates ledger geometry and DOM position | `frontend/src/runtime/selection/effect/move-selected.ts:22-45` | Each selected card/zone/group patches in-memory geometry and calls `patchNodePosition`. |
| DOM move is layout-position mutation | `frontend/src/runtime/selection/effect/move-selected.ts:60-63` | `node.style.left` and `node.style.top` are written during drag. |
| Zone label overlay reads layout during drag | `frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:4-24` | It rebuilds labels and reads `zone.offsetLeft`, `title.offsetLeft`, `zone.offsetTop`, `title.offsetTop`, `zone.offsetWidth`, and `getComputedStyle(title)`. |

Frame proof from `/tmp/corev2-real-offenders-drag/suite-summary.json`:

| Variant | Worst during-drag frame | Largest overlapping offenders inside the frame | What it proves |
| --- | ---: | --- | --- |
| `baseline` | `38.8ms` | `EventDispatch:pointermove` `16.435ms`; `ProxyMain::BeginMainFrame` `16.641ms` and `15.987ms` | App JS and browser commit/raster both overlap the same bad frame. |
| `skip-zone-labels` | `33.2ms` | `ProxyMain::BeginMainFrame` `28.194ms`; `LayerTreeHost::WaitForCommitCompletion` `17.876ms` | Removing label JS does not remove the visible-frame stall. |
| `cheap-visuals` | `30.5ms` | `EventDispatch:pointermove` `13.841ms`; `ProxyMain::BeginMainFrame` `14.053ms` | Reducing visual cost does not remove label JS cost. |
| `no-images` | `46.3ms` | `ProxyMain::BeginMainFrame` `23.837ms`; `LayerTreeHost::WaitForCommitCompletion` `22.964ms` | Images alone are not the root cause. |
| `skip-zone-labels+no-images+cheap-visuals` | `18.0ms` | no actionable offender above `10ms` | Only removing both JS layout reads and heavy visual/commit cost gets close to budget. |

Interpretation:

- `renderZoneLabelOverlay()` is a real app-code offender because the A/B run drops worst pointermove dispatch from a frame-consuming event to about `1ms`.
- The visible drag frame remains slow after that because Chrome still has to produce a committed frame after `left/top` movement of rich DOM cards.
- The trace identifies `ProxyMain::BeginMainFrame` and `LayerTreeHost::WaitForCommitCompletion` as the remaining frame offenders after label JS is removed.
- Relationships are not the reproduced cause here because the measured ledger has `0 relationships`. They still need a relationship-heavy trace before making claims about relationship-heavy drag.

Fix implications:

| Required change | Why |
| --- | --- |
| Cache or ledger-drive zone label geometry | Removes layout reads from `renderZoneLabelOverlay()` during pointermove. |
| Coalesce drag rendering through `requestAnimationFrame` | Prevents multiple raw pointer events from forcing repeated overlay/DOM work before the next paint. |
| Move selected objects with transform preview | Avoids per-pointermove `left/top` layout-position mutation. |
| Commit `left/top` once on release | Preserves persisted ledger geometry without forcing layout-position commits every frame. |
| Feed labels/relationships/controls from in-flight geometry | Keeps visible feedback correct while the selected object is transform-previewed. |

## Zoom Detail Transition Mechanism

The slow zoom transition is specifically `low-detail -> normal detail`, crossing upward through scale `0.35`.

Runtime code path:

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

| Step | File / line | Mechanism |
| --- | --- | --- |
| Wheel computes new scale | `frontend/src/runtime/gesture/controller/handle-wheel.ts:37-60` | Wheel updates `state.viewport.scale`, `x`, and `y`, then calls `applyViewportTransform()`. |
| Viewport apply updates CSS vars and transform | `frontend/src/runtime/canvas/effect/apply-viewport-transform.ts:7-16` | Writes `--viewport-scale`, `--inverse-viewport-scale`, calls `updateDetailMode()`, then writes `.canvas-content` transform. |
| Detail mode threshold is class-only | `frontend/src/runtime/canvas/effect/update-detail-mode.ts:9-15` | At `scale >= 0.35`, `low-detail` is removed. No card-size measurement happens here. |
| Low-detail hides full detail layer | `frontend/assets/canvas/canvas-layer.css:156-167` | `.canvas.low-detail .ledger-card-detail-layer` is hidden and `content-visibility: hidden`. |
| Low-detail shows overview layer | `frontend/assets/canvas/canvas-layer.css:169-195` | Overview title/status becomes the visible card representation. |
| Each card contains both layers | `frontend/src/runtime/ledger/component/patch-ledger-card.ts:66-81` | Every ledger card has a `.ledger-card-detail-layer` and a `.ledger-card-overview-layer`. |
| Detail layer contains full title/body/tabs/labels | `frontend/src/runtime/ledger/component/patch-ledger-card.ts:74-80` | The expensive layer includes rendered markdown/body or tab frame plus labels/tabs/status/title. |
| Detail and overview layers are normal DOM | `frontend/assets/canvas/objects.css:213-225` | The detail layer participates in layout/style; overview layer has separate containment. |

Frame proof from `/tmp/corev2-real-offenders-zoom-detail` and `/tmp/corev2-real-offenders-zoom-detail-combo`:

| Transition / variant | Worst frame | Largest overlapping frame events | What it proves |
| --- | ---: | --- | --- |
| `low-to-normal / baseline` | `114.6ms-117.4ms` | `ProxyMain::BeginMainFrame` `114ms-117ms`; `WebFrameWidgetImpl::UpdateLifecycle` `113ms-116ms`; style/layout max about `75ms-78ms`; paint max about `20ms-26ms` | Full detail reveal creates the slow frame. |
| `low-to-normal / no-detail-layer` | `23.3ms-24.5ms` | `ProxyMain::BeginMainFrame` about `23ms-24ms` | Removing full detail layers removes most of the stall. |
| `low-to-normal / no-grid` | `50.4ms-62.2ms` | `ProxyMain::BeginMainFrame` about `50ms-62ms` | Grid/world raster contributes, but is secondary to detail-layer reveal. |
| `low-to-normal / no-overview-layer` | `42.0ms` | `ProxyMain::BeginMainFrame` about `41.9ms` | Overview layer also contributes but is not primary. |
| `low-to-normal / no-counter-scale` | `63.4ms` | `ProxyMain::BeginMainFrame` about `63.3ms` | Counter-scaled titles are not the primary cause. |

Negative proof:

- Input is not the bottleneck in the zoom transition traces. The slow frames are dominated by browser lifecycle and commit events, not `EventDispatch:wheel`.
- The old hypothesis that `updateDetailMode()` measures card dimensions is stale. The current code only toggles classes.
- The A/B run is decisive: hiding `.ledger-card-detail-layer` changes the worst frame from about `115ms` to about `24ms`.

Mechanism conclusion:

Removing `.low-detail` changes the rendering state of every card at once:

```css
.canvas.low-detail .ledger-card-detail-layer {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  content-visibility: hidden;
}
```

When `.low-detail` is removed, those rules stop applying to every `.ledger-card-detail-layer`. The browser must make the full card body surfaces visible again for the whole ledger. The trace shows the resulting cost as `WebFrameWidgetImpl::UpdateLifecycle`, style/layout, paint, `ProxyMain::BeginMainFrame`, and commit wait inside one slow frame.

Fix implications:

| Required change | Why |
| --- | --- |
| Stage `low-detail -> normal` reveal | Avoid revealing every full card body in one frame. |
| Reveal visible/near-viewport details first | Limits layout/paint to content the user can inspect immediately. |
| Hydrate offscreen card detail in later frames or idle time | Prevents one global frame from doing all detail work. |
| Keep `content-visibility` or intrinsic-size strategy for hidden/offscreen details | Lets Chrome skip layout for card bodies that are not needed yet. |
| Keep grid optimization as secondary | `no-grid` helps, but `no-detail-layer` proves detail reveal is the primary offender. |

## Next Fix Should Prove This

Minimum proof for a drag fix:

- Same target card and scale as `/tmp/corev2-real-offenders-drag`.
- Worst during-drag frame below `16.7ms`.
- Worst `EventDispatch:pointermove` below `4ms`.
- No `ProxyMain::BeginMainFrame` or commit-wait overlap above `8ms`.
- Labels, controls, and relationships remain visually correct.

Minimum proof for a zoom detail fix:

- Same `low-to-normal` transition (`0.34 -> 0.365`) as `/tmp/corev2-real-offenders-zoom-detail`.
- Worst transition frame below `16.7ms`, or a staged reveal with no single blocking frame.
- Trace shows reduced `WebFrameWidgetImpl::UpdateLifecycle`, style/layout, paint, and `ProxyMain::BeginMainFrame` overlap.
- A/B comparison includes baseline, `no-detail-layer`, and the implemented fix.
