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

## Counter-analysis run

Fresh run used a temporary headless Chromium CDP session:

```bash
COREV2_URL=http://127.0.0.1:4173/ardaria-game-design \
COREV2_CDP_JSON=http://127.0.0.1:9223/json \
COREV2_DRAG_TRACE_OUTPUT_DIR=/tmp/corev2-perf-counter-drag \
COREV2_DRAG_TRACE_CARD_ID=prep_development_cheat_menu_ae913a0a \
COREV2_DRAG_TRACE_SCALE=0.35 \
COREV2_DRAG_TRACE_VARIANTS=baseline,skip-zone-labels,no-hover-controls \
COREV2_DRAG_TRACE_HOVER_MODES=cold \
COREV2_DRAG_TRACE_RUNS=1 \
COREV2_DRAG_TRACE_MOVES=12 \
COREV2_DRAG_TRACE_DOM_READ_PROBES=1 \
node tools/live-verify/card-drag-trace-suite.mjs
```

Use this run as the current counter-analysis proof for the Ardaria zero-relationship case. Do not treat old exact timings as current facts unless their raw report is attached or the same target is rerun with the same scale, move count, variants, and browser mode.

## Zoom Detail Transition Suite

The live transition trace suite is:

```bash
node tools/live-verify/zoom-detail-transition-trace.mjs
```

Useful command shape:

```bash
COREV2_URL=http://127.0.0.1:4173/ardaria-game-design \
COREV2_CDP_JSON=http://127.0.0.1:9223/json \
COREV2_ZOOM_DETAIL_TRACE_OUTPUT_DIR=/tmp/corev2-real-offenders-zoom-detail \
COREV2_ZOOM_DETAIL_CASES=normal-to-low,low-to-normal,low-to-overview,overview-to-low \
COREV2_ZOOM_DETAIL_VARIANTS=baseline,no-grid,no-detail-layer,no-overview-layer,no-counter-scale \
node tools/live-verify/zoom-detail-transition-trace.mjs
```

The suite uses one real wheel input to cross a detail threshold, records page `requestAnimationFrame` gaps, aligns Chrome trace events to page marks, and reports the largest overlapping offenders inside the slow transition frame.

Current proof outputs:

```text
/tmp/corev2-real-offenders-zoom-detail
/tmp/corev2-real-offenders-zoom-detail-combo
```
