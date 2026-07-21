# OPERATOR
<!-- decision-os:note {"id":"note-1784043924952-6d7f6802b8432","timestamp":"2026-07-14T15:45:25.516Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784043925479-6d9b0c19-9e36-4c91-b93e-ac73544acd17.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T15:45:25.521Z"} -->

Dans les tabs qui sont dans le control room, la troisième tab, c'est ceux qui sont done, D-O-N-E, en fait, c'est celles qui ont été terminées. Je veux qu'on enlève cette tab et qu'on la remplace par une tab delayed. Donc c'est les tâches qu'on a créées, mais qu'on ne veut pas traiter tout de suite. Et du coup, il nous faut un système dans les mastercards pour pouvoir parquer les tâches et les déparker, évidemment. Et donc ça change un statut, parce que du coup, on avait le statut done, le statut doing, to do, le statut processing. Je ne sais pas si ça avait été correctement utilisé pour faire les statuts des cartes dans active et dans queu. Mais il faut essayer de factoriser pour ne pas rajouter un système à l'existant, mais réutiliser les systèmes existants. Et voilà, avec ce bouton, avec les règles serveurs qui vont bien.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784044504313-b0adb9ea","timestamp":"2026-07-14T15:55:04.314Z"} -->

Implemented and committed the delayed-task workflow. The Control Room now serves `Delayed` instead of `Done`; master-task detail has `Park task` and `Restore to queue`; the existing card `status` field now accepts `delayed`, and unsupported statuses return HTTP 400. Focused tests and both TypeScript checks pass. Live Chromium verified the Delayed tab at `http://127.0.0.1:50150/?tab=delayed` with no runtime error. One validation remains: the existing server process predates the backend change, and I did not restart it because server restarts require explicit operator authorization. Please authorize one restart so I can verify Park → Delayed → Restore persistence on the served target.

# OPERATOR
<!-- decision-os:note {"id":"note-1784045528077-8d8ecf61251dc","timestamp":"2026-07-14T16:12:08.263Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784045528234-c5e01d69-7368-49e5-abd0-6a53390f8237.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T16:12:08.271Z"} -->

Le bouton, il ne doit pas s'appeler « Park task », il doit s'appeler « Move to backlog ».

# AGENT
<!-- decision-os:note {"id":"note-agent-1784045654937-d418ca7f","timestamp":"2026-07-14T16:14:14.938Z"} -->

Updated as requested: the button now reads `Move to backlog`, with `Moving to backlog…` while the request is pending. `Restore to queue` is unchanged. All 40 focused Control Room tests pass, and Chromium verified the served master-task route returns HTTP 200, displays `Move to backlog`, contains no `Park task` text, and has no runtime error. Committed in `c105660` and merged to `main` as `15fe805`.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784046682972-3e0d5268","timestamp":"2026-07-14T16:31:22.973Z"} -->

## A. Closeout evidence

1. **Implementation:** `8068b37` added authoritative `todo | delayed | done` validation, `todo → delayed → todo` endpoint coverage, Delayed routing/grouping/counts/empty state, and backlog/restore mutation payloads. `c105660` changed the operator-facing label to `Move to backlog`. Merge commits are `29b38c9` and `15fe805`.
2. **Verification:** 40 mobile Control Room tests passed, 8 desktop status tests passed, the focused authoritative-server mutation test passed, and frontend/backend TypeScript checks passed. Chromium observed `http://127.0.0.1:50150/?tab=delayed` and the master-task route at HTTP `200`, with Delayed selected, no Done tab, `Move to backlog`, and no runtime error.
3. **Acceptance decision:** every stated master criterion has concrete evidence. The full served Move → reload → Restore gesture was not run because the backend process predated the server commit; this is recorded as a verification limit rather than an acceptance blocker because persistence and rejection are explicitly covered by the authoritative endpoint test.

---

## B. Errors and corrections

1. Initial isolated-worktree backend test launches failed because `tsx` and `typescript` were not resolvable from the worktree root. Running the focused test from the backend package context corrected resolution and passed.
2. The initial `Park task` copy contradicted the operator’s wording. Commit `c105660` corrected the idle and pending labels to `Move to backlog` and `Moving to backlog…`; 40 focused tests and served Chromium inspection passed afterward.

---

## C. Saved lessons

1. **Memory 13:** validate persisted workflow state at the authoritative mutation boundary and derive transient processing state from active runs.
2. **Memory 14:** verify served frontend assets and backend mutation behavior independently when a long-lived server may predate a commit.
