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
