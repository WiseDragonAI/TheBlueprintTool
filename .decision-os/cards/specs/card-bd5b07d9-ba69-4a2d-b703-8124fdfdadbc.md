## A. Scope

1. **Objective:** Make active voice notes converge on server truth without reload and expose responsive, honest phase feedback.
2. **Primary files:** `frontend/src/runtime/voice/effect/request-transcription.ts`, `frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts`, `frontend/src/runtime/thread/effect/render-thread-notes.ts`, and a dedicated voice-note reconciliation effect.

---

## B. Reconciliation Contract

1. **Fast path:** Apply scoped voice lifecycle SSE events when their `revision` is newer than the local note revision.
2. **Fallback:** Poll `GET /api/voice-transcription-status` every `2_000ms` for each active non-terminal voice note, stop immediately at a terminal state, and stop after the server-owned `120_000ms` deadline plus one final read.
3. **Recovery triggers:** Perform an immediate status read on EventSource `open`, browser `online`, and `visibilitychange` to visible for every active non-terminal voice note.
4. **Accepted response:** Use the `noteId`, phase, revision, and timestamps returned by `POST /api/voice-upload`; do not create a replacement `transcriptionStartedAt` from the browser clock.
5. **Ordering:** Never apply a response with an older revision and never regress `transcribed` or `transcription failed` to a busy phase.
6. **Timeout removal:** Delete the local `expireStaleVoiceTranscription` status mutation. The browser may announce delayed progress, but only the server may create the terminal deadline failure.

---

## C. Progress Contract

1. **Labels:** Render `Uploading audio`, `Waiting for transcription`, `Transcribing`, `Finalizing transcript`, `Transcribed`, and `Transcription failed` from the server phase.
2. **Elapsed time:** Show elapsed seconds for every non-terminal phase using the corresponding server timestamp.
3. **Recorder independence:** Keep the recorder available for another voice note while each pending note owns its progress indicator.
4. **Retry:** Show `Retry` only for a server-confirmed failure with a retained `voiceFileRef`.
5. **Accessibility:** Announce phase changes through the existing polite thread live region and keep labels readable without relying on spinner animation.
6. **Local clock:** Between server reconciliation calls, update elapsed labels every `1_000ms` from the authoritative phase timestamp. Use one interval for all visible pending notes, resolve current DOM nodes on each tick, and stop when no pending note remains.

---

## D. Acceptance Criteria

1. **Dropped SSE:** A mocked missing completion event still reaches the terminal state through the targeted poll.
2. **Background completion:** A mocked completion while hidden reconciles on the first visible-state event.
3. **Race safety:** A late `transcribing` response cannot overwrite a newer terminal revision.
4. **Progress rendering:** Focused integration tests verify labels, elapsed time, terminal rendering, and retry visibility.
5. **Request efficiency:** Polling reads only one pending note and stops all timers and listeners when that note becomes terminal or is removed.
6. **Responsive elapsed display:** The visible elapsed label advances `0s`, `1s`, `2s` without a server response, follows replacement DOM nodes after rerender, and never creates duplicate intervals.

---

## E. Implementation Evidence

1. **Convergence:** Each pending note receives a targeted `2_000ms` status watcher; EventSource recovery, network recovery, and visible-state recovery trigger immediate authoritative reads.
2. **Ordering:** Revision and terminal-state guards reject late intermediate responses.
3. **Progress:** Note rendering exposes the server phase and elapsed seconds without a fabricated percentage; the browser-only `30_000ms` failure mutation is removed.
4. **Regression:** A dropped terminal SSE converges through the targeted read without refreshing the ledger, a visible-state event triggers an immediate read, and a stale intermediate revision cannot regress the terminal note.
5. **Verification:** Affected frontend checks pass `35/35`; frontend TypeScript checking passes.
6. **Commit:** Implemented in `f4e6e87`, merged by `3a236ac`, with visible-state coverage merged by `e4a5d0a`.
7. **Live clock:** Commit `fa76bf4`, merged by `dd07e71`, adds a timestamp-derived `1_000ms` display clock. Focused frontend tests pass `37/37`, mobile-shell tests pass `5/5`, and frontend TypeScript passes.
8. **Served mobile dependency:** `frontend-mobile/src/mobile-thread.js` imports the shared `/canvas-src` thread renderer. Project-scoped HTTP reads return `200` for that renderer and its live-clock module with `cache-control: no-store`.
