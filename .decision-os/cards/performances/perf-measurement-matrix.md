# Measurement Matrix

The CDP suite measured real Decision OS large-ledger cards across zoom scales `0.35`, `0.5`, and `0.75`.

Representative baseline results:

| Card | Scale | Worst during-drag frame | Dominant offender |
| --- | ---: | ---: | --- |
| `Logo and naming` | 0.35 | 80.4ms | commit/raster |
| `New card` image/table heavy | 0.35 | 56.8ms | commit/raster |
| `Voxel Planet B Generation Analysis` | 0.35 | 66.1ms | commit/raster |
| `Runes List` | 0.35 | 58.3ms | commit/raster |
| `Food And Digestion` | 0.35 | 60.9ms | commit/raster |
| `Weight And Stats UI` | 0.35 | 53.6ms | commit/raster |

The pattern is consistent: zoomed-out large cards are worst because a single card can still occupy a tall screen region after scale, and moving it with `left/top` creates large dirty paint/commit work.

Measured frame decomposition from the fresh drag trace:

| Scope | Measured time | Evidence | Interpretation |
| --- | ---: | --- | --- |
| Full drag trace, input bucket | 604.771ms total / 43.620ms max | Baseline trace group `input` | Input handling is not free, but it is not the whole frame story. |
| Pointermove dispatch | 102.937ms total / 11.948ms max | `EventDispatch:pointermove`, 12 moves | The pointermove chain can exceed a 60 FPS per-frame budget before Chrome commits the visual frame. |
| Pointermove DOM reads | 576 `offsetLeft` reads | DOM read probe during `pointermove:capture` | Zone-label work is doing repeated layout-dependent reads during movement. |
| Worst during-drag frame | 29.1ms | Slow frame #7, phase `during-drag` | This is the visible drag hitch while the pointer is moving. |
| Worst during-drag input overlap | 11.948ms | `EventDispatch:pointermove` inside frame #7 | JS input work explains part of the 29.1ms frame. |
| Worst during-drag compositor overlap | 12.093ms | `ProxyMain::BeginMainFrame` inside frame #7 | Browser frame production explains another measured part of the same bad frame. |
| Worst during-drag raster bucket | 590.466ms summed overlap | Trace group `raster-composite` for frame #7 | This is overlapping compositor/raster work, not serial wall time, but it shows significant rendering debt attached to the frame. |
| Worst after-release frame | 844.4ms | Slow frame #38, phase `after-release` | Release jank is a separate problem from movement jank. |
| After-release style/layout | 212.921ms | `Document::UpdateStyleAndLayout` in frame #38 | The release freeze is dominated by browser style/layout lifecycle work. |
| After-release style update | 152.570ms | `Blink.Style.UpdateTime` in frame #38 | A large part of the release frame is style recalculation. |

Probe variants:

| Variant | Meaning | Result |
| --- | --- | --- |
| `skip-zone-labels` | Prevent zone label overlay rebuild | Pointermove dispatch drops sharply |
| `no-images` | Hide card media shells and media overlay | Raster decreases, but frames can still exceed budget |
| `cheap-visuals` | Remove shadows/filters/text shadows in probe | Raster decreases, but not enough alone |
| `skip-zone-labels+no-images+cheap-visuals` | Combined cheap probe | Heavy card still around 19ms |

Even aggressive visual probes do not reliably reach 16.7ms, so the structural problem is how drag frames are produced, not one decorative effect.
