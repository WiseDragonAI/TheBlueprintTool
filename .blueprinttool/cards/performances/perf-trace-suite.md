# CDP Trace Suite

The live trace suite is `tools/live-verify/card-drag-trace-suite.mjs`.

Useful command shape:

```bash
COREV2_DRAG_TRACE_CARD_IDS=card-9026fced-519b-4a3b-b472-f8c655825f6c \
COREV2_DRAG_TRACE_SCALES=0.35,0.5,0.75 \
COREV2_DRAG_TRACE_VARIANTS=baseline \
COREV2_DRAG_TRACE_HOVER_MODES=cold \
npm run verify:live:drag-trace
```

The suite records:

- Page-side `requestAnimationFrame` gaps.
- Chrome trace events aligned to page marks.
- Slow frames grouped by phase: before drag, during drag, after release.
- Top frame offenders over threshold.
- Event dispatch cost by event type.
- Optional DOM read probes with `COREV2_DRAG_TRACE_DOM_READ_PROBES=1`.

The important reporting unit is per-frame, not aggregate totals. Aggregate raster totals can exceed frame duration because they sum overlapping worker tasks; the frame gap itself is still the user-visible stall.
