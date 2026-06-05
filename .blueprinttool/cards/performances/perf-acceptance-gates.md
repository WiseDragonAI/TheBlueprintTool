# Acceptance Gates

The performance target is 60 FPS interaction.

Hard gates:

- During-drag frame gaps stay below `16.7ms` in representative Game Design cases.
- No individual per-frame offender above `10ms` during drag.
- `EventDispatch(pointermove)` stays comfortably below frame budget.
- Relationship-heavy ledgers must keep relationships visible during drag.
- Zero-relationship ledgers must not pay relationship-specific costs.
- Zone-label overlay must not perform global layout reads per drag frame.
- Pointerup must not produce a visible geometry jump.

Regression ledgers:

- Ardaria Game Design: many cards, zero relationships, large cards/images/tables.
- Ardaria Data Model: relationship-heavy case.
- MOH `/s3`: medium relationship case.

Required proof:

- CDP trace summary with worst per-frame offenders.
- Comparison against baseline for the same target cards, same scales, same move count.
- Browser-side DOM read probe for paths expected to stop measuring layout.

## Counter-analysis gates

Evidence quality gates:

- Any numeric claim must link to a raw report path, checked-in operation note, or reproducible command.
- Stale runtime shape must be restated with the measurement date. Example: the current `2026-06-05` Ardaria run is `103 cards / 23 zones / 0 relationships / 35 images`, not the older `77 cards / 18 zones` shape.
- A/B conclusions must distinguish JS handler cost from visible frame cost. The `skip-zone-labels` run proves pointermove JS drops sharply; it does not prove frames meet budget.
- Zero-relationship evidence may invalidate relationship-causality claims, but it cannot prove relationship-heavy behavior.

New hard gates from the counter-run:

- `skip-zone-labels` or a cache-backed replacement must remove pointermove layout-read top entries.
- Pointermove dispatch should stay below `4ms max` in the zero-relationship Ardaria case after the refactor. The fresh `skip-zone-labels` probe reached `1.163ms max`, so this is realistic for JS.
- During-drag visible frames must stay below `16.7ms` after both DOM-read removal and `left/top` drag-write removal. The fresh `skip-zone-labels` run still hit `33.1ms`, so DOM-read removal alone is not enough.
- Pointer release must be profiled separately. The fresh run hit `1223ms-1282ms` after-release frames across all variants, so a movement fix cannot be accepted as complete if release still freezes.

Required additional variants:

- `transform-drag-preview`: selected object moved via transform, no `left/top` writes until release, labels/relationships/controls read in-flight geometry.
- `no-release-render`: already supported by the trace suite, but must be compared in the same run as baseline.
- relationship-heavy ledger run: same card count/scale/move-count discipline, with relationship count reported.
