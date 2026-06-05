# Zone Label Overlay Reads

`renderZoneLabelOverlay()` rebuilds the full label overlay every drag move.

Per zone, it reads:

- `zone.offsetLeft`
- `title.offsetLeft`
- `zone.offsetTop`
- `title.offsetTop`
- `zone.offsetWidth`
- `getComputedStyle(title)`

The DOM read probe measured baseline drag on the heavy Ardaria card at:

```text
pointermove:capture / offsetLeft: 576 reads
pointermove:capture / getBoundingClientRect: 24 reads
```

Disabling only zone label overlay in the probe reduced pointermove dispatch from roughly:

```text
109ms / 13 pointermoves
```

to roughly:

```text
24ms / 13 pointermoves
```

This is a direct synchronous offender. It is not the only offender, but it is a guaranteed tax on every drag frame and it compounds with browser commit/raster work.

Structural requirement: zone labels must be positioned from ledger geometry or an invalidation cache, not from fresh DOM layout reads on every drag move.

Mechanism detail:

| Current input | Why it is read | Stable replacement |
| --- | --- | --- |
| `zone.offsetLeft` / `zone.offsetTop` | Finds the zone in canvas coordinates after DOM layout | `annotation.x` / `annotation.y` from the active ledger |
| `zone.offsetWidth` | Clamps the label inside the visible zone width | `annotation.width` from the active ledger |
| `title.offsetLeft` / `title.offsetTop` | Finds how the title text landed after CSS layout | A fixed title anchor derived from the zone's canvas-space padding |
| `getComputedStyle(title)` | Reads rendered color/shadow state | Store the zone color/readable title color at zone render time |

The operator intuition is right: most of this should be scale math, not layout discovery.

The stable model should be:

| Coordinate layer | Formula |
| --- | --- |
| Zone canvas x/y | `annotation.x`, `annotation.y` |
| Label canvas x/y | `annotation.x + titleAnchorX`, `annotation.y + titleAnchorY` |
| Label canvas width cap | `annotation.width - titleAnchorX` |
| Readability scaling | Keep `.zone-label-proxy { transform: scale(var(--inverse-viewport-scale, 1)) }` so text remains readable inside the transformed world layer. |

The important distinction is that zoom changes the projection of known geometry; it does not change the underlying zone/card canvas rectangles. Fresh DOM reads are only needed when CSS layout truly changes, for example after a label text edit, font change, or zone geometry resize. Pan and zoom should reuse ledger geometry plus viewport scale.

## Counter-analysis update

The previous screen-coordinate replacement was too broad for the current DOM structure. `renderZoneLabelOverlay()` inserts `.zone-label-overlay` into `.canvas-content`, and `.canvas-content` is the transformed world layer. Therefore label `left/top/maxWidth` should remain canvas-space values. Screen-space projection is only needed for overlays outside `.canvas-content`, such as the canvas control overlay.

Source proof:

- `frontend/src/runtime/zone/effect/render-zone-label-overlay.ts` inserts `.zone-label-overlay` into `content`.
- `frontend/assets/canvas/canvas-layer.css` transforms `.canvas-content` with `translate(...) scale(...)`.
- `frontend/assets/canvas/objects.css` counter-scales `.zone-label-proxy` with `--inverse-viewport-scale`.

Fresh trace proof:

| Variant | Pointermove layout reads | Pointermove dispatch |
| --- | --- | ---: |
| `baseline` | `offsetLeft` 756, `offsetTop` 504, `offsetWidth` 252, `getComputedStyle` 252 | `151.635ms / 13 events` |
| `skip-zone-labels` | no pointermove layout-read top entries | `11.462ms / 13 events` |

Correct replacement shape:

- Source zone geometry from `activeLedgerAnnotationMap()` or a maintained render cache.
- Source label text/color/readable shadow from ledger/render-time data, not `getComputedStyle()` during pointermove.
- Use fixed title anchors in canvas coordinates unless the title is actively edited or typography changes.
- Rebuild all labels on ledger load, zone create/delete, zone rename, color edit, and zone geometry resize.
- During drag, update only affected labels from in-flight geometry and coalesce with `requestAnimationFrame`.
