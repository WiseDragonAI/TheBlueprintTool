# Drag Performance Summary

Ardaria Game Design has zero relationships, yet drag can miss the frame budget by a large margin. The worst reproduced path is the image-heavy `Logo and naming` card at scale `0.35`.

Measured slow frame:

| Case | Relationships | Scale | Worst during-drag frame | Top actionable trace event |
| --- | ---: | ---: | ---: | --- |
| `card-9026fced-519b-4a3b-b472-f8c655825f6c` | 0 | 0.35 | 80.4ms | `ProxyMain::BeginMainFrame / Commit`, about 71ms |

The main conclusion is that relationship rendering is not required to reproduce the drag lag. The lag is produced by layout-position dragging and browser frame production work: style/layout invalidation, layer-tree commit, and raster/compositor tasks.

The app-side synchronous work is also too high: baseline pointermove dispatch was around `109ms / 13 moves`, with the zone-label overlay doing hundreds of geometry reads per drag.
