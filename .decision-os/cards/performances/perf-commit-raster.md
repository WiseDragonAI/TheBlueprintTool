# Commit And Raster Mechanism

The worst frame is not explained by a long JavaScript handler alone.

For `Logo and naming` at scale `0.35`:

| Trace component | Time | Interpretation |
| --- | ---: | --- |
| Full frame duration | 80.4ms | User-visible missed frame. This is the number that matches the sluggish drag feeling. |
| `EventDispatch(pointermove)` max | about 9.9ms | JavaScript did meaningful work, but it is not the whole 80ms. |
| `ProxyMain::BeginMainFrame` | about 71ms | Browser main-frame production was the dominant cost. |
| `Commit` | about 71ms | Chrome spent most of the bad frame committing visual updates. |
| `LayerTreeHost::WaitForCommitCompletion` | about 71ms | The frame was blocked waiting for commit completion, not simply running app JavaScript. |

That means the pointermove handler triggers invalidation, then Chrome spends the frame producing the committed visual result.

Why it is expensive:

| Mechanism | Why it matters |
| --- | --- |
| Drag writes `left/top` | This is a layout-position mutation, so Chrome cannot treat the drag as a compositor-only move. |
| The card remains visually large | Even at zoomed-out scales, some cards occupy a large screen rectangle, so the dirty paint region is not tiny. |
| The card surface is visually rich | Borders, layered backgrounds, shadows, overview text, and status controls increase paint artifact work. |
| The world layer is transformed | The canvas scale changes how pixels are sampled and committed, so softened/repainted content can force extra work. |
| Overlay renderers run after the write | Zone label/control work can add synchronous layout reads before Chrome even starts the visual frame commit. |

Trace totals like `raster-composite total=1694ms` inside an 80ms frame are sums of overlapping trace events and worker tasks. They do not mean a 1.6s frame; they mean the frame spawned a large amount of raster/compositor work and the main thread waited on a costly commit.

This is why removing some visuals helps but does not fully solve the problem. The structural problem is the drag rendering model.

The measurable target is not “make the card prettier cheaper”. The target is “make pointermove stop producing layout-position invalidation”. The expected implementation shape is a temporary transform layer during drag, with ledger `x/y` and DOM `left/top` committed once on release.
