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
| Zone screen x/y | `viewport.x + annotation.x * viewport.scale`, `viewport.y + annotation.y * viewport.scale` |
| Label screen padding | `basePadding * viewport.scale`, then clamped to a readable minimum when counter-scaled text is used |
| Label width cap | `annotation.width * viewport.scale - horizontalPadding` |

The important distinction is that zoom changes the projection of known geometry; it does not change the underlying zone/card canvas rectangles. Fresh DOM reads are only needed when CSS layout truly changes, for example after a label text edit, font change, or zone geometry resize. Pan and zoom should reuse ledger geometry plus viewport scale.
