# Drag Move Call Chain

Current drag flow:

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

The critical behavior is that every pointermove writes layout position:

```ts
node.style.left = `${x}px`;
node.style.top = `${y}px`;
```

Those writes happen inside `moveSelected()`, after the ledger geometry has already been patched in memory. Because the DOM node is absolutely positioned, changing `left/top` is a layout-position mutation, not a compositor-only transform.

After the write, overlay renderers run synchronously in the same pointermove. In a zero-relationship ledger, the relationship call is effectively bounded by no relationships, but zone labels and controls still do DOM work.

This explains why the browser trace shows both:

- `EventDispatch(pointermove)` around 8-12ms in baseline.
- Later `ProxyMain::BeginMainFrame / Commit` frames around 30-71ms.

The JS event is only the trigger. The user-visible frame loss happens when Chrome tries to produce the next committed frame after the layout-position mutation.
