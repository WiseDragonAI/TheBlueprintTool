# OPERATOR
<!-- decision-os:note {"id":"note-1784273035053-f1e2c8ceece268","timestamp":"2026-07-17T07:23:55.068Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-09063d18-dab2-4ce0-8d1c-e62fdbc97cc7/paste-1784273035055-f6b12c6d933b6.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784273053168-dc135db88675d","timestamp":"2026-07-17T07:24:13.201Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784273053198-e2cd97cf-b171-45d0-b112-5b27f7c5f7b2.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T07:24:13.203Z","uploadReceivedAt":"2026-07-17T07:24:13.198Z","audioPersistedAt":"2026-07-17T07:24:13.198Z","acceptedAt":"2026-07-17T07:24:13.198Z","providerStartedAt":"2026-07-17T07:24:13.203Z","providerSettledAt":"2026-07-17T07:24:15.885Z","completedAt":"2026-07-17T07:24:15.888Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-17T07:24:13.198Z","codexQueueRunId":"codex-skill-1784273055977-5c37167a","revision":4} -->

Je suis capable d'avoir un bug quand je fais du drag and drop qui va complètement corrompre le state de la queue. Ça veut dire que les tâches que j'ai drag and drop, elles peuvent rester comme ça, détachées de la queue.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784273289708-0da535c2-0d2","timestamp":"2026-07-17T07:28:09.708Z"} -->

## A. Intake Result

1. **Categorized:** queue drag-and-drop state corruption is tracked as a `bug` on the Control Room `/` surface.
2. **Verified boundary:** `SortableJS 1.15.7` owns the fallback drag; `onEnd` schedules an optimistic rerender and persistence, while Control Room server events can independently rerender the same list.
3. **Coverage gap:** no existing browser test exercises queue reorder cleanup, successful reload persistence, rejected-request reconciliation, or a live refresh during a drag.

---

## B. Created Work

1. [Reproduce and trace the queue drag corruption](card:card-faeb4dca-6582-47d3-b1f4-5389a089c719)
2. [Make queue reorder teardown and persistence atomic](card:card-9cc50475-421b-4af0-9a83-bcecb1874a63)
3. [Add served-surface queue drag regression coverage](card:card-9cebc924-d3c5-4eff-b37c-60736f27f86a)

---

## C. Status

1. **Intake is complete; implementation remains open.** No subtask was marked `done`.

# OPERATOR
<!-- decision-os:note {"id":"note-1784278099605-d2f42d77d457f8","timestamp":"2026-07-17T08:48:19.610Z"} -->

execute

# AGENT
<!-- decision-os:note {"id":"note-agent-1784278962916-d3419988-e77","timestamp":"2026-07-17T09:02:42.916Z"} -->

## A. Executed

1. **Fixed the Control Room queue drag lifecycle** without replacing SortableJS or changing the validated task component. Live refreshes now wait for gesture settlement, fallback artifacts are removed on every termination path, rank patches are serialized, and rejected persistence forces an authoritative reload.
2. **Added served-surface regression coverage** for pointer reorder, mobile touch reorder, optimistic state, successful reload persistence, rejected reconciliation, pointer cancellation, and a live refresh during an active drag.
3. **Merged:** `4ab6e714` (`6b1c7c10` feature commit).

---

## B. Verification

1. Browser regression passed `1/1`; focused Control Room contracts passed `3/3`; frontend typecheck passed.
2. The repository-wide command stopped on the verified existing frontend static-contract baseline; untouched `main` reproduced the same class with one additional failure.
3. **All three subtasks are verified. The master task remains open for operator closeout.**

# OPERATOR
<!-- decision-os:note {"id":"note-1784279330139-e31a139ec5a95","timestamp":"2026-07-17T09:08:50.143Z"} -->

there is still a corruptiuon. After one successful drag n drop, I cant do it again. Maybe a badly optimized optimistic update? Def something wrong. Analyze and fix

# AGENT
<!-- decision-os:note {"id":"note-agent-1784280700236-de30cd7a-43a","timestamp":"2026-07-17T09:31:40.236Z"} -->

## A. Corrected

1. **Fixed the repeat-drag lockout.** The first optimistic reorder no longer disables Sortable while every queue rank is written; later gestures enqueue ordered rank snapshots and unchanged ranks are skipped.
2. **Expanded the served regression** to complete a second reorder while the first successful rank request is held.
3. **Merged:** `ac4e0450` (`87f033fa` feature commit).

---

## B. Verification

1. Repeated pointer reorder, touch reorder, rejection reconciliation, cancellation, live refresh deferral, focused contracts, and frontend typecheck pass.
2. The repository suite reached `429` passing frontend tests and stopped on `7` unrelated static-contract failures.
3. **The three subtasks are verified. The master task remains open for operator closeout.**
