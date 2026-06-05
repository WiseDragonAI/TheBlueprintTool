# Structural Refactor Direction

The drag hot path needs a frame-oriented renderer.

Target model:

```text
pointermove
  -> update in-flight geometry state
  -> schedule one requestAnimationFrame if none pending

requestAnimationFrame
  -> render selected card/zone positions from in-flight geometry
  -> render relationships from in-flight geometry
  -> render labels from in-flight geometry
  -> render controls from in-flight geometry

pointerup
  -> commit ledger geometry once
  -> clear in-flight geometry
```

Important constraints:

- Relationships remain visible and correct.
- Zone labels remain visible and correct.
- Controls remain visible and correct.
- Rendering uses cached/ledger geometry, not DOM rect reads.
- Multiple pointer events before a frame are coalesced into one render.
- Pointer release must not trigger a full-surface rebuild unless content identity changed.

The goal is not to hide expensive systems. The goal is to make every system consume the same in-flight geometry snapshot so drag rendering is deterministic and bounded.

## Counter-analysis refinements

The refactor direction is still correct, but two details must be explicit:

1. Do not mutate persisted active-ledger records on every raw pointermove.
2. Do not move selected DOM nodes with `left/top` on every raw pointermove.

Corrected target model:

```text
pointerdown
  -> capture base ledger geometry for selected cards/zones/groups
  -> create in-flight drag geometry map

pointermove
  -> update latest drag delta only
  -> schedule one requestAnimationFrame if none pending

requestAnimationFrame
  -> derive selected object preview from base geometry + latest delta
  -> move selected visible objects with compositor-friendly transforms
  -> render relationship paths from in-flight geometry map
  -> render zone labels from in-flight geometry map and cached label anchors
  -> render controls from in-flight geometry or screen-projected source rects

pointerup
  -> patch ledger x/y once from final in-flight geometry
  -> commit selected ledger geometry once
  -> clear transforms and in-flight geometry
  -> render only affected overlays/surface parts
```

Coordinate correction:

- Zone labels are inside `.canvas-content`, so their `left/top/maxWidth` should be canvas-space values.
- Canvas controls are outside `.canvas-content`, so they need screen-space placement or a projected rect.
- Relationships are SVG world content; active-ledger paths should be routed from canvas-space card rectangles.

Proof still needed before final implementation:

- A transform-only trace variant that suppresses `left/top` writes while keeping relationship/label/control feedback correct.
- An active relationship-heavy drag trace to prove route recalculation stays bounded.
- A release trace split that separates local rerender, style/layout lifecycle, mocked network commit, and persistence.
