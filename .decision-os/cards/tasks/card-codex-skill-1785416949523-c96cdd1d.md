## A. Correction

1. **This is over-engineered. The simpler anchor is the existing same-ID voice note plus its forward-only lifecycle comparator** `shouldApplyVoiceServerNote()`.
2. **Required behavior:** an active voice note must replace its optimistic `uploading` fields with the durable same-ID `transcribed` fields as soon as live thread hydration receives them, without requiring reload.
3. **Selected correction:** add one voice-specific acceptance branch at the existing same-ID overlay boundary in `mergeLocalThreadNotes()`; do not add state, persistence, transport, polling, component, renderer, cache, manifest, registry, index, route, controller, and schema changes.

---

## B. Verified Authority and Failure

1. **Durable authority already exists:** `finishVoiceUploadOrchestration()` persists the transcript under the original `noteId`, advances status to `transcribed`, writes revision `4`, then emits the scoped `thread-content` notification through `applyNotePatch()` in `backend/src/business/transcription/controller/start-voice-upload-orchestration-controller.ts:96-149` and `backend/src/business/transcription/controller/start-voice-upload-orchestration-controller.ts:300-383`.
2. **Live delivery already exists:** `loadActiveThreadSlice()` reads the active thread document, verifies ownership, passes the server slice through `mergeLocalThreadNotes()`, installs the accepted notes, then rerenders in `frontend/src/runtime/thread/effect/load-active-thread-slice.ts:120-190`.
3. **Lifecycle authority already exists:** `shouldApplyVoiceServerNote()` compares revision plus declared voice status rank and rejects backward transitions in `frontend/src/runtime/voice/helper/voice-transcription-lifecycle.ts:62-84`.
4. **The first incorrect transition is one spread:** when the incoming slice contains the same note ID, `mergeLocalThreadNotes()` lets `optimistic: true` bypass its server-slice guard, then `{ ...incoming, ...localNote }` restores the older message, status, revision, and optimistic flag in `frontend/src/runtime/ledger/helper/merge-local-thread-notes.ts:48-68`.
5. **Reload recovery confirms the boundary:** a fresh page has no older optimistic object to overlay, so the already durable transcript installs unchanged.
6. **The client cleanup identity is already present:** `requestTranscription()` writes `localVoiceUploadId: noteId` before upload, and `submitPendingVoiceUpload()` clears it only after deleting the browser-held audio in `frontend/src/runtime/voice/effect/request-transcription.ts:55-91` and `frontend/src/runtime/voice/effect/submit-pending-voice-upload.ts:16-76`.

---

## C. Patch Shapes Reassessed

1. **Selected — constrained merge guard:** at the same-ID branch in `mergeLocalThreadNotes()`, recognize a live voice upload by non-empty `localVoiceUploadId`, call `shouldApplyVoiceServerNote(localNote, incomingNote)`, retain the incoming server note when accepted, preserve `localVoiceUploadId` plus the already merged `imageSizes`, set `optimistic: false`, then skip the generic local overlay.
2. **Rejected — global comparator insertion:** applying the voice comparator to every same-ID optimistic note broadens behavior to text, image, and file notes. Unknown statuses receive rank `-1`, so that change could accept unrelated server state without domain evidence.
3. **Rejected — targeted reconciliation before slice install:** calling `applyVoiceServerNote()` from `loadActiveThreadSlice()` would mutate global state and trigger rendering before the verified slice installs, creating a second application path at an otherwise atomic notes-only boundary.
4. **Rejected — new state object:** the question “which same-ID voice state is newer?” is already answered by `noteId`, `revision`, status rank, `localVoiceUploadId`, and the durable thread note. A second model would mirror these fields and create synchronization obligations.
5. **Rejected — polling and transport changes:** scoped publication, thread hydration, targeted status polling, and renderer invalidation are already implemented. None owns the demonstrated overwrite.

---

## D. Minimal Patch Contract

1. **Remove:** every proposed change beyond the existing merge boundary and its focused regression.
2. **Use instead:** import `shouldApplyVoiceServerNote()` into `frontend/src/runtime/ledger/helper/merge-local-thread-notes.ts` and add one branch before the current optimistic spread.
3. **Branch admission:** require `incomingIncludesThreadSlice`, `existingIndex >= 0`, `localNote.optimistic === true`, non-empty `localNote.localVoiceUploadId`, and `shouldApplyVoiceServerNote(localNote, merged[existingIndex]) === true`.
4. **Accepted result:** keep the incoming transcript, `voiceFileRef`, lifecycle timestamps, error, status, revision, role, and durable message; carry forward only `localVoiceUploadId` plus locally measured `imageSizes`; force `optimistic: false`.
5. **Rejected result:** when the comparator rejects the incoming note, preserve the current generic optimistic overlay unchanged so a delayed `uploading` snapshot cannot replace a newer local terminal state.
6. **Complexity footprint:** one production file, one existing import, one state-specific branch, one focused integration regression, zero new data objects.
7. **Tradeoff:** no required capability is lost. The patch deliberately leaves non-voice optimistic reconciliation unchanged; any future domain correction needs its own causal evidence.

---

## E. Verification Boundary

1. **Focused regression:** extend `frontend/test/runtime/ledger-content-refresh.integration.test.ts` with `loadActiveThreadSlice()` state containing a same-ID local note at `uploading`, `optimistic: true`, and non-empty `localVoiceUploadId`; return an owned server slice containing transcript text, `voiceFileRef`, `transcribed`, revision `4`, then assert the active note installs the durable fields, `optimistic: false`, the preserved cleanup ID, and preserved `imageSizes`.
2. **Backward-transition protection:** retain the existing regression at `frontend/test/runtime/voice-transcription-runtime.integration.test.ts:805-843`, where a local terminal voice state rejects an incoming older `uploading` snapshot.
3. **Non-voice protection:** the focused regression must also confirm that the branch predicate excludes an optimistic same-ID text note, leaving the generic local overlay intact.
4. **Served-surface proof after implementation:** on the operator route, observe the same note first at optimistic `uploading`, then at live `transcribed` without reload, then unchanged after a fresh reload.
5. **Proof limit:** this stage performed static analysis only. It did not edit source code, run tests, control Chromium, mutate the server, commit, push, complete a subtask, and close the master task.

---

## F. Revised Next Four Actions

1. **Action 1 — `product-analysis`:** verify the actor-visible voice lifecycle, browser-held audio cleanup, terminal reconciliation, and reload acceptance boundary against the selected constrained merge guard.
2. **Action 2 — `task-list`:** map the single production branch and focused regression to exact symbols, assertions, and verification commands.
3. **Action 3 — `task-group-completeness`:** audit the inventory against forward lifecycle ordering, stale snapshot rejection, non-voice optimistic preservation, local audio cleanup, live rendering, and reload persistence.
4. **Action 4 — `executor-precheck`:** confirm the analysis package is implementation-ready while preserving the no-implementation boundary.

---

## G. Gate Handoff

1. **Decision:** the previously proposed generic comparator insertion is too broad; the accepted patch is a constrained same-ID voice branch inside the existing merge.
2. **Remaining uncertainty:** static evidence establishes the wrong transition and the minimal code boundary; real device interaction remains unverified until implementation is authorized.
3. **Next gate input:** reassess this completed result, revise the rolling plan, then select exactly one next skill.
---

Codex run completed: exit code 0
