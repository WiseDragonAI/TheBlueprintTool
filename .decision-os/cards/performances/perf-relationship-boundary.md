# Relationship Boundary

Decision OS large-ledger fixtures can have zero relationships, so relationships are not required to reproduce the current drag lag.

That does not mean relationships can be disabled during drag. Relationship rendering is part of the expected canvas feedback and must remain correct when relationships exist.

The correct boundary is:

- Do not hide or skip relationships as a product behavior.
- Do not measure relationship cost using a zero-relationship ledger.
- For relationship-heavy ledgers, route geometry should come from ledger `x/y/w/h` plus in-flight drag geometry, not DOM rect reads.
- Relationship paths should be recalculated from virtual geometry during drag, then persisted geometry on release.

This preserves behavior while removing DOM measurement from the drag hot path.
