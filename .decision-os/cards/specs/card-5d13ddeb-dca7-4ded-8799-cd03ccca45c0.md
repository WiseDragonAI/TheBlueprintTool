## A. Runtime trace status

1. **Verified boundary:** source and deterministic regressions confirm the first incorrect transition was same-card `renderCard()` re-entering the viewport default in `openCardDetail()` after a federation refresh.
2. **Served target:** the exact card route returned HTTP `200` and served the merged ownership implementation.
3. **Pending evidence:** a pointer and touch transition trace is still required because no browser driver is available in this session.
