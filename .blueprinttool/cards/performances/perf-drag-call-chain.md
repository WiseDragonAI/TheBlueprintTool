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

| Variant | Pointermove dispatch total | Pointermove max | Pointermove DOM reads | Worst during-drag frame | After-release max frame | Interpretation |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| `baseline` | 102.937ms | 11.948ms | `offsetLeft` 576 | 29.1ms | 844.4ms | Pointermove has measurable sync work; release is a separate huge style/layout problem. |
| `skip-zone-labels` | 10.153ms | 0.944ms | no pointermove `offsetLeft` top entry | 17.8ms | 860.6ms | Zone-label reads explain most pointermove event cost, but not release jank. |
| `no-hover-controls` | 102.736ms | 9.917ms | `offsetLeft` 576, `offsetTop` 384 | 32.4ms | 899.7ms | Hover controls are not the main pointermove offender in this run. |

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
| `handlePointerMove()` | measured as aggregate, not isolated | Baseline `EventDispatch:pointermove` total 102.937ms / max 11.948ms | The whole pointermove chain can exceed budget. |
| `moveSelected()` | not isolated as its own function timer | Style mutation occurs about 11.7ms after first move in baseline | It is on the critical path, but exact exclusive time is not proven yet. |
| `renderZoneLabelOverlay()` | measured by A/B probe | Skipping it drops pointermove dispatch total from 102.937ms to 10.153ms | This is a proven pointermove offender. |
| `renderRelationshipOverlay()` | bounded by ledger shape | Runtime had 0 relationships | It is not the cause in this Ardaria Game Design drag trace. |
| `renderCanvasControlOverlay()` | measured by A/B probe | `no-hover-controls` keeps pointermove total at 102.736ms | It is not the main pointermove offender in this run. |
| Browser style/layout after release | measured by trace | After-release frame 844.4ms, `Document::UpdateStyleAndLayout` 212.921ms | Release jank is a separate style/layout lifecycle problem. |
| Raster/composite during drag | measured by trace groups | Baseline raster bucket total 10128.319ms, max 40.529ms | Drag also creates compositor/raster debt; totals are overlapping trace work, not one serial task. |

This explains why the browser trace shows both:

- `EventDispatch(pointermove)` around 10-12ms max in baseline.
- During-drag frames around 29-32ms in the measured run.
- After-release frames around 844-900ms in this particular run, dominated by style/layout lifecycle work.

The JS event is only the trigger. The user-visible frame loss happens when Chrome tries to produce the next committed frame after the layout-position mutation.

Required next measurement before implementing the drag-preview refactor: add explicit `performance.mark()` spans around `moveSelectedLedgerGeometry`, `patchNodePosition`, `renderZoneLabelOverlay`, `renderRelationshipOverlay`, and `renderCanvasControlOverlay`. The current trace proves the zone-label A/B and the browser frame cost, but it does not provide exclusive function timings for every function in the call chain.
