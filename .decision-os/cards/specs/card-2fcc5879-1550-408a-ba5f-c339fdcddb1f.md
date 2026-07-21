## A. Type

1. **Type:** `data`

---

## B. Targets

1. `frontend/src/runtime/persistence/effect/persist-state.ts` — `persistState`.
2. `frontend/src/runtime/persistence/helper/read-persisted-state.ts` — `readPersistedState`.
3. `frontend/src/runtime/boot/controller/boot-surface.ts` — `bootSurface`.
4. `frontend/src/runtime/refresh/controller/refresh-runtime-state.ts` — `refreshRuntimeState`.
5. `frontend/src/runtime/state.ts` — thread state maps.
6. `frontend/src/runtime/thread/effect/persist-thread-scroll.ts` — scroll accessors.
7. `frontend/src/runtime/thread/helper/thread-follow-bottom.ts` — follow accessors.

---

## C. Action

1. Extend `decision-os.canvas.state` with independent conversation and log offsets plus explicit follow flags.
2. Hydrate validated records during boot and manual refresh.
3. Persist transitions through the existing persistence boundary.
4. Treat missing and malformed legacy values as empty records.

---

## D. Done When

1. Reload restores the saved offset when follow is disabled.
2. Reload restores bottom-follow mode when enabled.
3. Conversation and log state remain independent.

---

## E. Dependencies

1. **None.**
