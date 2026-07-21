Ledger: Specs
Waiting since: 2026-07-17T12:33:25.960Z

## A. Classification

1. **Category:** frontend interaction state and browser persistence.
2. **Surfaces:** desktop thread inspector, mobile card thread, and `Codex Log` tab.
3. **Constraint:** preserve the existing thread panel, note renderer, log renderer, and jump-to-bottom interaction; correct their state transitions and persistence.

---

## B. Required Behavior

1. **Default:** opening a conversation or `Codex Log` without saved state lands at the bottom and follows new content.
2. **Conversation updates:** completed voice transcription, operator notes, and agent replies remain visible while follow mode is active.
3. **Manual reading:** scrolling upward disables follow mode and preserves the exact position.
4. **Resume:** persisted follow mode lands on the newest content, including an agent reply posted while the panel was closed.
5. **Log independence:** `Codex Log` owns the same behavior independently.
6. **Restart persistence:** both offsets and follow modes survive browser and Decision OS restarts through the existing canvas-state contract.

---

## C. Verified Current State

1. `persist-thread-scroll.ts` keeps conversation and log offsets only in runtime maps.
2. `thread-follow-bottom.ts` keeps only a conversation follow flag in runtime memory.
3. Canvas-state persistence and hydration omit thread scroll and follow state.
4. Conversation scrolling disables follow only in memory.
5. `render-thread-codex-log.ts` infers follow from the mounted viewport and can reopen a populated log at the top.
6. `load-active-thread-slice.ts` renders incoming notes without an explicit follow-or-restore transition.

---

## D. Task Inventory

| id | type | title | target_files | target_symbols | action | done_when | depends_on |
|---|---|---|---|---|---|---|---|
| T1 | data | Persist and hydrate scroll state | persistence, boot, refresh, state, and thread state helpers | `persistState`; `readPersistedState`; `bootSurface`; `refreshRuntimeState`; scroll and follow helpers | Persist independent conversation and log offsets plus follow flags, then hydrate validated records. | Reload restores manual offsets and enabled bottom-follow state. | — |
| T2 | code | Make conversation follow own incoming notes | thread panel, note renderer, slice refresh, selection, close, jump, pin, and responsive thread files | panel, note, refresh, selection, close, jump, pin, and mobile lifecycle functions | Default unseen threads to follow, preserve bottom across note rerenders, and persist intentional upward scrolling on desktop and mobile. | Transcriptions and agent replies remain visible while following; manual state survives reopen and restart. | T1 |
| T3 | code | Give Codex Log independent follow behavior | thread panel, log renderer, scroll, follow, and run-log binding files | `setThreadPanelTab`; `renderThreadCodexLog`; state helpers; `bindThreadCodexRunLog` | Default first open to bottom, follow streamed events, and persist explicit upward scrolling independently. | Existing logs open at the latest event; manual position survives navigation and restart. | T1 |
| T4 | test | Verify desktop and mobile transitions | existing runtime, unit, and browser thread, voice, refresh, responsive, and Codex tests | persistence, refresh, responsive, and served-surface cases | Cover first open, follow, offsets, transcription, agent refresh, streaming, tab changes, reopen, and reload with browser scroll input. | Automated checks pass and served desktop plus mobile-viewport behavior is observed. | T2, T3 |

---

## E. Open Questions

1. **None.** The existing persisted canvas-state contract provides the verified storage boundary.

---

## F. Readiness

1. **READY_FOR_TASK_DEPENDENCY**

---

## G. Subtasks

1. [Persist and hydrate per-thread scroll state](card:card-2fcc5879-1550-408a-ba5f-c339fdcddb1f)
2. [Make conversation follow state own incoming-note behavior](card:card-d63311fe-b12d-46de-88e2-a9684f5f1649)
3. [Give Codex Log independent persistent bottom-follow behavior](card:card-7bbb39e1-d361-4b5e-87b7-19378f3d8032)
4. [Verify desktop and mobile scroll-follow transitions](card:card-f84dc7c6-9a25-46bc-875c-4e60e28cf29c)
