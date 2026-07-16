## A. Answer

1. **Feasibility:** Implementing TanStack Virtual for the thread window is possible in this repo.
2. **Correct package:** The frontend is a plain DOM and TypeScript runtime, not React, so the implementation should use `@tanstack/virtual-core`, not `@tanstack/react-virtual`.
3. **Version check:** `npm view @tanstack/virtual-core version` returned `3.17.3` on `2026-07-10`.
4. **Expected impact:** Virtualization will reduce the mounted thread-note DOM from every note to the visible notes plus overscan. It will not reduce the size of `ux.json`, the thread Markdown files, the fetched note array, and the Markdown/media render cost for the currently visible notes.
5. **Persistence boundary:** The backend routes, ledger schema, thread Markdown format, card status, and ledger JSON structure do not need to change.

---

## B. Repo Evidence

1. **Current renderer:** `frontend/src/runtime/thread/effect/render-thread-notes.ts` creates `.thread-note-list`, calls `list.replaceChildren()`, loops through every note in `state.activeLedger.notes[state.threadId]`, creates one `.thread-note` element per note, and calls `renderLedgerCardMarkdown(...)` for every note.
2. **Lag source:** A very long thread therefore mounts every rendered Markdown block, code block, image shell, delete button, retry button, and Codex tool-call disclosure into the inspector at once.
3. **Scroll owner:** `.thread-panel .chat` is the thread viewport. `frontend/src/runtime/thread/effect/persist-thread-scroll.ts`, `frontend/src/runtime/thread/effect/pin-thread-feed-to-last-message.ts`, and `frontend/src/runtime/thread/effect/render-thread-jump-button.ts` all read the same scroll element.
4. **Refresh path:** `frontend/src/runtime/thread/effect/load-active-thread-slice.ts` refreshes only the active thread notes and then calls `renderThreadNotes()`. That data flow can remain unchanged.
5. **Existing optimization:** `threadNotesSignature(...)` prevents rerendering when the note data is unchanged, but it does not solve the initial mount cost for a huge thread.
6. **Dependency state:** `frontend/package.json` currently depends on `highlight.js` and has no `@tanstack/*` dependency.

---

## C. Implementation Contract

1. **Dependency:** Add `@tanstack/virtual-core@^3.17.3` to `frontend/package.json` and update `frontend/package-lock.json`.
2. **Virtual renderer:** Add `frontend/src/runtime/thread/effect/render-virtual-thread-notes.ts` to own the `Virtualizer` instance for the active `threadId` and `.thread-panel .chat` element.
3. **DOM host:** Keep `.thread-feed` as the mounted feed host and keep `.thread-note-list` as the `ol` element so existing selectors and media-resize code still find `.thread-note-list`.
4. **Virtual layout:** In virtual mode, set `.thread-note-list` to `position: relative` with `height: ${virtualizer.getTotalSize()}px`, then render only `virtualizer.getVirtualItems()` as absolutely positioned `.thread-note` rows using `transform: translateY(${virtualItem.start}px)`.
5. **Stable keys:** Use `getItemKey(index) => String(notes[index]?.id ?? `${threadId}:${index}`)` so refreshed notes keep measurement identity.
6. **Dynamic measurement:** Call `virtualizer.measureElement(item)` for each mounted note and set `data-index` on that element. Use larger estimates for agent answers, Codex tool calls, and image notes than for short operator notes.
7. **Chat anchoring:** Configure `anchorTo: 'end'`, `followOnAppend: true`, `scrollEndThreshold: 80`, and `overscan: 6` for the thread feed.
8. **Pin behavior:** Replace the direct `chat.scrollTop = chat.scrollHeight` path in `pin-thread-feed-to-last-message.ts` with `virtualizer.scrollToEnd(...)` when a thread virtualizer exists.
9. **Jump button:** Replace raw `scrollHeight - clientHeight - scrollTop` math in `render-thread-jump-button.ts` with `virtualizer.isAtEnd(72)` and `virtualizer.getDistanceFromEnd()` when a thread virtualizer exists.
10. **Scroll restoration:** Extend the session-only thread scroll state with `virtualizer.takeSnapshot()` plus the current offset, then pass the saved measurements through `initialMeasurementsCache` and `initialOffset` when recreating the virtualizer for a thread.
11. **CSS:** Add virtual-mode selectors in `frontend/assets/canvas/thread.css` so `.thread-note-list.is-virtual` uses full-width relative layout, `.thread-note.is-operator` is positioned on the right edge, and `.thread-note.is-agent` plus Codex rows are positioned on the left edge.
12. **Renderer boundary:** Keep `renderThreadPanel()` calling `renderThreadNotes()`. Change `renderThreadNotes()` into the note filtering, stale-voice expiry, signature, and virtual-render dispatch boundary.

---

## D. Risks

1. **Native find:** Browser page search will only find mounted visible notes after virtualization. The repo has no current full-thread search contract, so this is an acceptable first implementation tradeoff.
2. **Media heights:** Thread images can change row height after load and after manual resize. `measureElement` and the existing image-size persistence path must remeasure rows after those changes.
3. **Deletion and retry controls:** `.thread-note-delete`, `.thread-note-retry`, and `data-action` event delegation must continue to work for mounted rows.
4. **Accessibility:** Recycled rows need `aria-setsize` and `aria-posinset` so visible `li` items still expose their position in the full thread.
5. **Test fixtures:** Existing fake DOM fixtures in `frontend/test/runtime/thread-selection-runtime.integration.test.ts`, `frontend/test/unit/thread/effect/render-thread-panel.test.ts`, and `frontend/test/runtime/voice-transcription-runtime.integration.test.ts` assume direct `.thread-note-list.append(...)` behavior and will need virtual-list support.

---

## E. Verification

1. **DOM count test:** Add a runtime test with at least `1000` thread notes and assert the mounted `.thread-note` count stays bounded by the visible range plus `overscan`.
2. **Order test:** Assert visible virtual rows preserve note order, `data-index`, `aria-posinset`, delete metadata, retry metadata, role classes, and Codex tool-call summaries.
3. **Pin test:** Assert `pinThreadFeedToLastMessage()` calls the virtualizer end-scroll path and lands on the newest note.
4. **Unpinned append test:** Assert a new note append does not pull the viewport down when `virtualizer.isAtEnd(80)` is false.
5. **Image resize test:** Assert thread image resizing still resolves `.thread-note-list`, persists `imageSizes`, and remeasures the row.
6. **Commands:** Run `cd frontend && TSX_TSCONFIG_PATH=tsconfig.json node --test --import tsx test/runtime/thread-selection-runtime.integration.test.ts test/unit/thread/effect/render-thread-panel.test.ts test/runtime/voice-transcription-runtime.integration.test.ts`.
7. **Typecheck:** Run `npm run typecheck:frontend`.

---

## F. Sources

1. **TanStack installation:** `https://tanstack.com/virtual/latest/docs/installation` lists `@tanstack/virtual-core` for no-framework usage.
2. **Virtualizer API:** `https://tanstack.com/virtual/latest/docs/api/virtualizer` documents `count`, `getScrollElement`, `estimateSize`, `measureElement`, `scrollToEnd`, `getDistanceFromEnd`, and `isAtEnd`.
3. **Chat guide:** `https://tanstack.com/virtual/latest/docs/chat` recommends stable item keys, `anchorTo: 'end'`, `followOnAppend`, `scrollEndThreshold`, `overscan`, and dynamic measurement for chat and log feeds.
