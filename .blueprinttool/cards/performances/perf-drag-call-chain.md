# Drag Move Call Chain

Measured run:

| Field | Value |
| --- | --- |
| Tool | `tools/live-verify/card-drag-trace-suite.mjs` |
| Output | `/tmp/corev2-card-drag-open-notes` |
| URL | `http://127.0.0.1:4173/ardaria-game-design` |
| Target card | `prep_development_cheat_menu_ae913a0a` |
| Scale | `0.35` |
| Runtime shape | 77 cards, 18 zones, 0 relationships, 35 images |
| Moves | 12 pointer moves |
| DOM read probes | enabled |
| Geometry commit | mocked to isolate local rendering path |

Measured drag flow:

```text
pointermove
  -> handlePointerMove()
  -> moveSelected(canvasDx, canvasDy)
  -> moveSelectedLedgerGeometry()
  -> patchNodePosition()
  -> renderZoneLabelOverlay()
  -> renderRelationshipOverlay()
  -> renderCanvasControlOverlay()
```

Trace evidence:

| Variant | Worst pointermove dispatch | Pointermove DOM reads | Worst during-drag frame | After-release max frame | Interpretation |
| --- | ---: | --- | ---: | ---: | --- |
| `baseline` | 11.948ms | `offsetLeft` 576 | 29.1ms | 844.4ms | Pointermove can consume most of a frame budget; release is a separate huge style/layout problem. |
| `skip-zone-labels` | 0.944ms | no pointermove `offsetLeft` top entry | 17.8ms | 860.6ms | Zone-label reads explain the pointermove event cost, but not release jank. |
| `no-hover-controls` | 9.917ms | `offsetLeft` 576, `offsetTop` 384 | 32.4ms | 899.7ms | Hover controls are not the main pointermove offender in this run. |

The critical measured write is that every pointermove writes layout position:

```ts
node.style.left = `${x}px`;
node.style.top = `${y}px`;
```

Those writes happen inside `moveSelected()`, after the ledger geometry has already been patched in memory. Because the DOM node is absolutely positioned, changing `left/top` is a layout-position mutation, not a compositor-only transform.

After the write, overlay renderers run synchronously in the same pointermove. In this measured run there are zero relationships, so relationship routing is not responsible for the drag lag. Zone labels are proven expensive by the `skip-zone-labels` probe.

Function-level evidence:

| Function / phase | Evidence status | Measured signal | Valid conclusion |
| --- | --- | --- | --- |
| `handlePointerMove()` | measured as event, not isolated | Baseline `EventDispatch:pointermove` max 11.948ms | The whole pointermove chain can consume most of a frame budget. |
| `moveSelected()` | not isolated as its own function timer | Style mutation occurs about 11.7ms after first move in baseline | It is on the critical path, but exact exclusive time is not proven yet. |
| `renderZoneLabelOverlay()` | measured by A/B probe | Skipping it drops worst pointermove dispatch from 11.948ms to 0.944ms | This is a proven pointermove offender. |
| `renderRelationshipOverlay()` | bounded by ledger shape | Runtime had 0 relationships | It is not the cause in this Ardaria Game Design drag trace. |
| `renderCanvasControlOverlay()` | measured by A/B probe | `no-hover-controls` keeps worst pointermove dispatch near baseline at 9.917ms | It is not the main pointermove offender in this run. |
| Browser style/layout after release | measured by trace | After-release frame 844.4ms, `Document::UpdateStyleAndLayout` 212.921ms | Release jank is a separate style/layout lifecycle problem. |
| Raster/composite during drag | measured by trace events | Baseline raster/composite max event 40.529ms | Drag also creates compositor/raster debt. |

This explains why the browser trace shows both:

- `EventDispatch(pointermove)` around 10-12ms max in baseline.
- During-drag frames around 29-32ms in the measured run.
- After-release frames around 844-900ms in this particular run, dominated by style/layout lifecycle work.

The JS event is only the trigger. The user-visible frame loss happens when Chrome tries to produce the next committed frame after the layout-position mutation.

Required next measurement before implementing the drag-preview refactor: add explicit `performance.mark()` spans around `moveSelectedLedgerGeometry`, `patchNodePosition`, `renderZoneLabelOverlay`, `renderRelationshipOverlay`, and `renderCanvasControlOverlay`. The current trace proves the zone-label A/B and the browser frame cost, but it does not provide exclusive function timings for every function in the call chain.

## Source validation and counter-findings

Source-confirmed path:

```text
handlePointerMove()
  -> moveSelected(canvasDx, canvasDy)
  -> moveSelectedLedgerGeometry(dx, dy)
  -> patchLedgerCardGeometry(...) / patchLedgerAnnotationGeometry(...)
  -> patchNodePosition(... left/top ...)
  -> renderZoneLabelOverlay()
  -> renderRelationshipOverlay()
  -> renderCanvasControlOverlay()
```

Code proof:

- `frontend/src/runtime/gesture/controller/handle-pointer-move.ts` calls `moveSelected()` for `drag` and `group` pointer intents.
- `frontend/src/runtime/selection/effect/move-selected.ts` patches active-ledger geometry in memory on every move, then writes `node.style.left` and `node.style.top`.
- The same `moveSelected()` call then synchronously renders zone labels, relationships, and controls.
- `frontend/src/runtime/gesture/controller/handle-pointer-up.ts` may call one final `moveSelected()` for the release delta, then commits selected ledger geometry, persists state, and rerenders the canvas surface for non-pan intents.

Fresh counter-run:

| Variant | Worst pointermove dispatch | Worst during-drag frame | Worst after-release frame | What this validates |
| --- | ---: | ---: | ---: | --- |
| `baseline` | `13.469ms` | `33.6ms` | `1281.9ms` | Current source path can consume most of the frame budget before browser frame production. |
| `skip-zone-labels` | `1.163ms` | `33.1ms` | `1257.2ms` | Zone labels dominate pointermove event cost but are not the only visible frame bottleneck. |
| `no-hover-controls` | `12.948ms` | `46.1ms` | `1223.6ms` | Hover controls are not the main pointermove offender here. |

Important correction: the current active-ledger relationship renderer already consumes ledger geometry through `activeLedgerCardRectMap()`, not DOM card rectangles. That is good for active ledgers. The missing piece is an explicit in-flight geometry snapshot that lets drag visuals, relationships, labels, and controls consume the same coalesced position once per animation frame without mutating persisted ledger records and layout-position DOM on every raw pointer event.

Implementation implication:

- A transform-only drag preview is insufficient by itself if relationships and labels still read stale ledger geometry.
- A ledger-only in-memory update is insufficient by itself if selected DOM nodes still move via `left/top`.
- The target model needs both: in-flight geometry for all overlays, and compositor-friendly visual movement for selected objects until release.
