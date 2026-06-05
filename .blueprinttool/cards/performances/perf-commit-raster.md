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

Ignore aggregate trace totals for frame-budget decisions. The useful numbers are the actual frame gap and the largest overlapping events inside that frame, such as `ProxyMain::BeginMainFrame`, `Commit`, or `LayerTreeHost::WaitForCommitCompletion`.

This is why removing some visuals helps but does not fully solve the problem. The structural problem is the drag rendering model.

The measurable target is not “make the card prettier cheaper”. The target is “make pointermove stop producing layout-position invalidation”. The expected implementation shape is a temporary transform layer during drag, with ledger `x/y` and DOM `left/top` committed once on release.

## Counter-analysis update

The `80.4ms` / `71ms Commit` result remains useful, but it should be treated as a prior trace result until the raw report is linked or rerun for the same `Logo and naming` target. The fresh `2026-06-05` counter-run used `prep_development_cheat_menu_ae913a0a`, so it validates the mechanism class, not the exact old worst-case number.

Fresh evidence:

| Variant | Worst during-drag frame | During-drag actionable offenders | Interpretation |
| --- | ---: | --- | --- |
| `baseline` | `33.6ms` | `ProxyMain::BeginMainFrame` around `12.9ms`, `EventDispatch:pointermove` around `12.8ms` in the same slow frame | App JS and browser frame production both contribute. |
| `skip-zone-labels` | `33.1ms` | `ProxyMain::BeginMainFrame` around `25.3ms`, `LayerTreeHost::WaitForCommitCompletion` around `15.2ms` | Removing zone-label JS does not remove commit/raster debt. |
| `no-hover-controls` | `46.1ms` | `ProxyMain::BeginMainFrame` around `25.7ms`, `LayerTreeHost::WaitForCommitCompletion` around `24.8ms` | Hover controls are not required for a slow browser-produced frame. |

Fresh after-release evidence:

| Variant | Worst after-release frame | Dominant offender |
| --- | ---: | --- |
| `baseline` | `1281.9ms` | `Document::UpdateStyleAndLayout` / `Blink.ForcedStyleAndLayout.UpdateTime` around `305.9ms` inside the frame |
| `skip-zone-labels` | `1257.2ms` | same style/layout lifecycle class, around `315.6ms` |
| `no-hover-controls` | `1223.6ms` | same style/layout lifecycle class, around `312.7ms` |

Corrected confidence:

- Validated: `left/top` drag writes are layout-position mutations and should be removed from the raw pointermove path.
- Validated: browser frame production can remain over budget after the zone-label JS offender is suppressed.
- Validated: release jank is separate and much larger in the current sample.
- Not yet proven exclusively: the exact share of cost owned by `left/top` versus rich card paint, grid/world raster, media, and forced style/layout after release.

Next proof step: add a trace variant that moves the selected card with `transform: translate(...)` while suppressing `left/top` writes, but still feeds relationships/labels/controls from in-flight geometry. That isolates layout-position invalidation from the rest of the visual surface.
