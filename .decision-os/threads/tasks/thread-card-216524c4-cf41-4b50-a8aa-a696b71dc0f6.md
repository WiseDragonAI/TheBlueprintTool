# OPERATOR
<!-- decision-os:note {"id":"note-1784286693809-67ed1a6f89a5f8","timestamp":"2026-07-17T11:11:33.878Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784286693874-d49a11dd-fb06-4b5a-8176-7d7582bf023b.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T11:11:33.881Z","uploadReceivedAt":"2026-07-17T11:11:33.874Z","audioPersistedAt":"2026-07-17T11:11:33.876Z","acceptedAt":"2026-07-17T11:11:33.876Z","providerStartedAt":"2026-07-17T11:11:33.881Z","providerSettledAt":"2026-07-17T11:11:39.094Z","completedAt":"2026-07-17T11:11:39.098Z","revision":4} -->

Je voudrais qu'on ait un raccourci clavier qui soit Ctrl X, qui est en plus du Shift X, qui permet de lancer un pipeline directement et ce pipeline, il doit être configuré dans la fenêtre de settings. Et sur mobile, ce qu'il faudra faire, c'est ajouter un deuxième bouton au lieu du send, même un troisième bouton parce que le Shift X, ça doit être send and launch codex et le Ctrl X, ça doit être send and launch et queue pipeline. Shift X, ça doit s'appeler send and run ou run directement en fait. Et Ctrl X, ça doit s'appeler pipeline. Le pipeline, du coup, il est configurable dans les settings. La configuration, elle est propre à la fédération, donc pas aux nœuds, mais vraiment à la fédération, donc c'est euh, il doit y avoir aussi un système de synchronisation des settings. Tous les settings ne sont pas synchronisés, par exemple le nombre max de workers, ce n'est pas synchronisé. Les connexions, ce n'est pas synchronisé. Non, vas-y, oublie cette feature, oublie cette feature de synchronisation du pipeline, ça sert à rien, on s'en fiche. Et quand on fait un shift X, donc ça veut dire que c'est juste un transcribe and run. Il faut changer le système prompt pour dire explicitement de ne pas utiliser de skill. Donc ce que tu vas faire là, c'est que tu vas faire cette implémentation sans utiliser de skill.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784288208195-5041a0ca-eec","timestamp":"2026-07-17T11:36:48.195Z"} -->

## A. Implemented

1. **Added `Ctrl+X` Pipeline and `Shift+X` no-skill Run launch modes while preserving plain `X` Send.**
2. **Added a local Settings selector for the voice pipeline; federation synchronization is excluded.**
3. **Added mobile `SEND`, `RUN`, and `PIPELINE` controls.**
4. **Merged the implementation in commit `bbcaddd7` without using a skill.**

---

## B. Verification

1. **Both typechecks passed.**
2. **All frontend tests, all `185` backend tests, and all `172` browser checks passed.**
3. **`http://127.0.0.1:50151/settings` returned HTTP `200` and served the new selector and shortcut help.**

---

## C. Operator Validation Required

1. **The running backend predates the merge and was not restarted because no restart was requested.**
2. **After the next server restart, exercise `Shift+X`, `Ctrl+X`, and the three mobile actions on the served surface. The subtasks remain open until this interaction evidence is recorded.**

# OPERATOR
<!-- decision-os:note {"id":"note-1784363760140-e6afbc1a1e7398","timestamp":"2026-07-18T08:36:00.229Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784363760225-7c95aea7-dbe6-4d2b-b294-afc404897213.wav","status":"transcribed","transcriptionStartedAt":"2026-07-18T08:36:00.248Z","uploadReceivedAt":"2026-07-18T08:36:00.225Z","audioPersistedAt":"2026-07-18T08:36:00.226Z","acceptedAt":"2026-07-18T08:36:00.226Z","providerStartedAt":"2026-07-18T08:36:00.248Z","providerSettledAt":"2026-07-18T08:36:02.908Z","completedAt":"2026-07-18T08:36:02.913Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-18T08:36:00.226Z","codexQueueRunId":"codex-skill-1784286699883-9da72cbf","revision":4} -->

En plus, ce qu'il faut, c'est que quand je suis en train d'enregistrer et que je maintiens shift ou que je maintiens control, il faut que le bouton send sur desktop, il faut qu'il change dans le sens où il faut que je vois le modifier et il faut que le bouton, il l'update. En fait, le modifier doit updater le bouton en temps réel pour que je puisse savoir ce qui se passe quand j'appuierai sur X. Et j'ai pas besoin de voir le contrôle shortcut desktop qui change. J'ai juste besoin de voir le bouton, l'icône et l'intitulé qui changent. Et les icônes, on les a déjà sur mobile, donc il faut réutiliser les icônes qu'on a sur mobile.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784364669077-35b5f7d5-72b","timestamp":"2026-07-18T08:51:09.077Z"} -->

## A. Desktop Preview Implemented

1. **During desktop recording, `Shift` updates the Send action to the existing mobile Run icon and `RUN` label.**
2. **`Control` updates it to the existing mobile Pipeline icon and `PIPELINE` label.**
3. **Modifier release restores Send, while the shortcut badge remains `X`.**
4. **The change merged in commit `03caebe8` without using a skill.**

---

## B. Verification

1. **A dedicated Chromium test passed with real Shift and Control keydown and keyup events.**
2. **All `21` focused voice, responsive-thread, and browser checks passed.**
3. **Frontend typechecking passed.**
4. **The running server returns HTTP `200` for the merged preview module.**

---

## C. Repository Baseline

1. **The broad backend suite still has pre-existing pipeline-library failures caused by the auto-seeded `project-synchronization` pipeline; the same focused failures reproduce on unchanged `main`.**
2. **The broad browser suite also has unrelated existing timeout and geometry failures. The new dedicated modifier interaction passes.**
