# Drag Performance Summary

Ardaria Game Design has zero relationships, yet drag can miss the frame budget by a large margin. The worst reproduced path is the image-heavy `Logo and naming` card at scale `0.35`.

Measured slow frame:

| Case | Relationships | Scale | Worst during-drag frame | Top actionable trace event |
| --- | ---: | ---: | ---: | --- |
| `card-9026fced-519b-4a3b-b472-f8c655825f6c` | 0 | 0.35 | 80.4ms | `ProxyMain::BeginMainFrame / Commit`, about 71ms |

The main conclusion is that relationship rendering is not required to reproduce the drag lag. The lag is produced by layout-position dragging and browser frame production work: style/layout invalidation, layer-tree commit, and raster/compositor tasks.

The app-side synchronous work is also too high: baseline pointermove dispatch was around `109ms / 13 moves`, with the zone-label overlay doing hundreds of geometry reads per drag.

## Counter-analysis update

Fresh validation run on `2026-06-05`:

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

Current sampled runtime shape was `103 cards`, `23 zones`, `0 relationships`, and `35 images`. That invalidates the older card-count detail (`77 cards`, `18 zones`) as a current fact, but not the causal claim that drag lag reproduces on a zero-relationship ledger.

Counter-analysis verdict:

| Claim | Verdict | Proof / correction |
| --- | --- | --- |
| Relationship rendering is not required to reproduce drag lag. | Validated | Fresh baseline reproduced slow drag frames with `0 relationships`. |
| Zone-label overlay is a synchronous pointermove offender. | Validated | Baseline pointermove dispatch was `151.635ms / 13 events`; `skip-zone-labels` dropped it to `11.462ms / 13 events`. |
| Hover controls are the main pointermove offender. | Invalidated for this run | `no-hover-controls` still measured `149.843ms / 13 pointermove events`, effectively matching baseline. |
| Skipping zone labels is sufficient to hit the frame budget. | Invalidated as a general claim | `skip-zone-labels` removed pointermove reads but still had during-drag slow frames up to `33.1ms`. |
| Browser frame production remains a separate bottleneck. | Validated | Baseline during-drag frames still showed raster/composite and `ProxyMain::BeginMainFrame` offenders alongside JS input. |
| Pointer release jank is separate from movement jank. | Validated | Fresh after-release frame max was `1281.9ms`, dominated by style/layout lifecycle work. |

The strongest corrected conclusion is: zone labels explain most app-side pointermove cost, but not all user-visible frame loss. A correct fix must remove hot-path DOM geometry reads and also stop dragging selected nodes through `left/top` layout-position writes every move.
