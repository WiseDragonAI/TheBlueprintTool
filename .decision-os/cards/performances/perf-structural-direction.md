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
