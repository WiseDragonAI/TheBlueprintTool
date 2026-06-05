# Relationship Boundary

Ardaria Game Design has zero relationships, so relationships are not required to reproduce the current drag lag.

That does not mean relationships can be disabled during drag. Relationship rendering is part of the expected canvas feedback and must remain correct when relationships exist.

The correct boundary is:

- Do not hide or skip relationships as a product behavior.
- Do not measure relationship cost using a zero-relationship ledger.
- For relationship-heavy ledgers, route geometry should come from ledger `x/y/w/h` plus in-flight drag geometry, not DOM rect reads.
- Relationship paths should be recalculated from virtual geometry during drag, then persisted geometry on release.

This preserves behavior while removing DOM measurement from the drag hot path.

## Counter-analysis update

Current source split:

| Mode | Geometry source | Drag implication |
| --- | --- | --- |
| Active ledger | `activeLedgerCardRectMap()` from ledger card records | Relationships can follow in-memory ledger geometry without DOM card rect reads. |
| Static/non-ledger DOM | `elementCanvasRect(element)` from `offsetLeft/offsetTop/offsetWidth/offsetHeight` | Static relationship rendering still has DOM-read cost. |

The active-ledger implementation is better than the earlier concern implied: relationship paths do not need card `getBoundingClientRect()` during active-ledger drag. The remaining risk is architectural:

- `moveSelected()` calls `renderRelationshipOverlay()` on every raw pointermove, even when the active ledger has `0 relationships`.
- A zero-relationship run proves relationships are not required to reproduce lag, but it does not measure relationship-heavy drag cost.
- A transform-only drag preview would make relationships wrong unless the relationship renderer consumes the same in-flight geometry as the selected card preview.

Fresh proof:

- The `2026-06-05` Ardaria counter-run measured `0 relationships`.
- `renderRelationshipOverlay` telemetry still fired `14` times in the baseline run because the renderer is called unconditionally from `moveSelected()`.
- The same run still produced during-drag frames up to `33.6ms`, so relationship routing is not necessary for visible jank.

Required relationship-specific proof:

- Run the same drag trace on a relationship-heavy ledger, for example Ardaria Data Model or MOH `/s3`.
- Compare current active-ledger relationship rendering against an in-flight geometry renderer.
- Track relationship count, path count, label count, and route recalculation time separately from card movement.
