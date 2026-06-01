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

Probe variants:

| Variant | Meaning | Result |
| --- | --- | --- |
| `skip-zone-labels` | Prevent zone label overlay rebuild | Pointermove dispatch drops sharply |
| `no-images` | Hide card media shells and media overlay | Raster decreases, but frames can still exceed budget |
| `cheap-visuals` | Remove shadows/filters/text shadows in probe | Raster decreases, but not enough alone |
| `skip-zone-labels+no-images+cheap-visuals` | Combined cheap probe | Heavy card still around 19ms |

Even aggressive visual probes do not reliably reach 16.7ms, so the structural problem is how drag frames are produced, not one decorative effect.
