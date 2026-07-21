## A. Verified Result

1. **Typed state:** Added initialized `threadViewportOpenGeneration` and `threadViewportPinRequest` state with exact thread, surface, generation, and reason identity.
2. **Matched lifecycle:** Request and consume effects reject anonymous, stale, wrong-thread, and wrong-surface intents.
3. **Documentation:** `ThreadPanelState` now records active surface, open generation, pin request ownership, and continuation-only persisted follow semantics.
4. **Regression:** Focused tests prove one-shot matching and prove persisted `false` cannot veto thread entry.
