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
