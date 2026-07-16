# OPERATOR
<!-- decision-os:note {"id":"note-1783937446733-df173449d4ccd8","timestamp":"2026-07-13T10:10:47.349Z"} -->

![Screenshot_20260713_171034_Brave.jpg](/.decision-os/thread-files/thread-card-840ff2e0-739b-4721-8f3a-af9d543aabbe/file-1783937447313-ebf1d3abd5baa-Screenshot_20260713_171034_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1783937480278-5ef164ade04498","timestamp":"2026-07-13T10:11:20.500Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783937480443-12e77bb8-d60e-498f-85bb-d98a61abb2bd.wav","status":"transcribed","transcriptionStartedAt":"2026-07-13T10:11:20.505Z","uploadReceivedAt":"2026-07-13T10:11:20.442Z","audioPersistedAt":"2026-07-13T10:11:20.449Z","acceptedAt":"2026-07-13T10:11:20.449Z","providerStartedAt":"2026-07-13T10:11:20.505Z","providerSettledAt":"2026-07-13T10:11:24.392Z","completedAt":"2026-07-13T10:11:24.418Z","revision":4} -->

Quand on lance du codec exec en headless et qu'on reçoit ce type d'erreur en plein milieu de la session, il faut être capable de résumer la session après un timeout mettons de 5 secondes de manière automatique parce que c'est une erreur transiente et en plus il ne faut pas suivre le message d'erreur qui dit de sélectionner un autre modèle. Non, non, il faut garder le même modèle, garder le même effort qui était déjà et il faut juste faire un résumé de la session. Donc euh bah fais une analyse et implémente ça directement.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783938108365-15330f57","timestamp":"2026-07-13T10:21:48.365Z"} -->

Implemented and merged in `151086e`.

The headless card-thread runner now recognizes the exact capacity error as transient, keeps the original run active, waits `5,000ms`, and invokes `codex exec resume` with the captured session id. The resume command explicitly reuses the interrupted run's model and `model_reasoning_effort`; it does not follow the error message's recommendation to select a different model. Detection is scoped to the current process segment, so unrelated non-zero exits remain terminal failures and repeated capacity interruptions can retry again.

Verification: backend TypeScript checking passed. The focused regression passed with the real delay and verified the session id, identical model, identical effort, and final `complete` run status. The broader controller file still contains a pre-existing `toolCallCount` assertion mismatch, independently reproduced on the unchanged checkout.

The master task and zone are renamed `Auto-Resume Capacity-Interrupted Codex Threads`; both linked subtasks are ledger-`done`. The master remains `#task-active` and ledger `todo` because the operator did not authorize master-card completion.
