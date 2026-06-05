# Measurement Matrix

The CDP suite measured real Ardaria Game Design cards across zoom scales `0.35`, `0.5`, and `0.75`.

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

Measured frame decomposition from the fresh drag trace. Frame-budget analysis must use per-event and per-frame overlap numbers; accumulated drag totals are not diagnostic.

| Scope | Frame-relevant measurement | Evidence | Interpretation |
| --- | ---: | --- | --- |
| Worst input event | 43.620ms max | Baseline trace group `input` | Some individual input events can exceed frame budget, but this still is not the whole frame story. |
| Worst pointermove dispatch | 11.948ms max | `EventDispatch:pointermove` | The pointermove chain can take most of a 60 FPS frame before Chrome commits the visual frame. |
| Pointermove DOM reads | 576 `offsetLeft` reads | DOM read probe during `pointermove:capture` | Zone-label work is doing repeated layout-dependent reads during movement. |
| Worst during-drag frame | 29.1ms | Slow frame #7, phase `during-drag` | This is the visible drag hitch while the pointer is moving. |
| Worst during-drag input overlap | 11.948ms | `EventDispatch:pointermove` inside frame #7 | JS input work explains part of the 29.1ms frame. |
| Worst during-drag compositor overlap | 12.093ms | `ProxyMain::BeginMainFrame` inside frame #7 | Browser frame production explains another measured part of the same bad frame. |
| Worst after-release frame | 844.4ms | Slow frame #38, phase `after-release` | Release jank is a separate problem from movement jank. |
| After-release style/layout | 212.921ms | `Document::UpdateStyleAndLayout` in frame #38 | The release freeze is dominated by browser style/layout lifecycle work. |
| After-release style update | 152.570ms | `Blink.Style.UpdateTime` in frame #38 | A large part of the release frame is style recalculation. |

Probe variants:

| Variant | Meaning | Result |
| --- | --- | --- |
| `skip-zone-labels` | Prevent zone label overlay rebuild | Worst pointermove event drops sharply |
| `no-images` | Hide card media shells and media overlay | Raster decreases, but frames can still exceed budget |
| `cheap-visuals` | Remove shadows/filters/text shadows in probe | Raster decreases, but not enough alone |
| `skip-zone-labels+no-images+cheap-visuals` | Combined cheap probe | Heavy card still around 19ms |

Even aggressive visual probes do not reliably reach 16.7ms, so the structural problem is how drag frames are produced, not one decorative effect.

## Counter-run: Ardaria drag, 2026-06-05

Fresh headless CDP run:

| Variant | Runtime shape | Worst pointermove dispatch | Pointermove DOM reads | Worst during-drag frame | Worst after-release frame | Valid conclusion |
| --- | --- | ---: | --- | ---: | ---: | --- |
| `baseline` | 103 cards / 23 zones / 0 relationships / 35 images | `13.469ms` | `offsetLeft` 756, `offsetTop` 504, `offsetWidth` 252, `getComputedStyle` 252 | `33.6ms` | `1281.9ms` | Zero relationships still reproduce drag jank; zone-label reads are present on the move path. |
| `skip-zone-labels` | same | `1.163ms` | no pointermove layout-read top entries | `33.1ms` | `1257.2ms` | Zone labels explain pointermove event cost, but not enough visible frame cost. |
| `no-hover-controls` | same | `12.948ms` | `offsetLeft` 756, `offsetTop` 504, `offsetWidth` 252 | `46.1ms` | `1223.6ms` | Hover controls are not the primary offender in this run. |

Reports:

```text
/tmp/corev2-perf-counter-drag/prep_development_cheat_menu_ae913a0a-scale0_35-baseline-cold-run1.report.json
/tmp/corev2-perf-counter-drag/prep_development_cheat_menu_ae913a0a-scale0_35-skip-zone-labels-cold-run1.report.json
/tmp/corev2-perf-counter-drag/prep_development_cheat_menu_ae913a0a-scale0_35-no-hover-controls-cold-run1.report.json
```

This counter-run preserves the earlier qualitative split but changes the confidence level of some numeric claims:

- The exact `80.4ms` / `71ms Commit` case remains a ledger-reported prior result until the raw trace for `Logo and naming` is attached or rerun.
- The current trace validates that a single pointermove event can consume most of a frame budget, but visible during-drag frames can stay above budget even after that JS cost is removed.
- The after-release freeze is consistently much larger than movement jank and should be treated as a separate release/render lifecycle issue.
