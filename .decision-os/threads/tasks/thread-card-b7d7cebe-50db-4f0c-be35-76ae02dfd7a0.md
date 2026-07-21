# OPERATOR
<!-- decision-os:note {"id":"note-1783853102996-06827f0d4bafa","timestamp":"2026-07-12T10:45:03.293Z"} -->

![Screenshot_20260712_174451_Brave.jpg](/.decision-os/thread-files/thread-card-b7d7cebe-50db-4f0c-be35-76ae02dfd7a0/file-1783853103245-fda10d7fa2b65-Screenshot_20260712_174451_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1783853141001-5addacac51f85","timestamp":"2026-07-12T10:45:41.081Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783853141064-056dffc9-6e98-44e7-aa9d-cfd5d7a6b823.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T10:45:41.075Z"} -->

Dans les tâches actives, je veux une stopwatch avec le chrono exact de la session codex en MMSS, donc formater minute-seconde. Je ne veux pas voir les Jer, je ne veux pas voir l'ID, je ne veux pas voir le actionable subtask. Je veux un truc très simple. Et quand je clique dessus, au lieu de faire un expand, je veux que ça m'amène directement sur la master card.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783853364789-12037db1","timestamp":"2026-07-12T10:49:21.283Z"} -->

Implemented and committed the compact active-task rows.

1. **Active row:** It now shows only the master-task title and a live `MM:SS` Codex-session stopwatch.
2. **Removed details:** Ledger name, Codex run ID, progress, actionable-subtask text, and the disclosure chevron are absent from active rows.
3. **Navigation:** Clicking an active row opens its master card directly instead of expanding it.
4. **Timing:** The stopwatch refreshes every second from the canonical `Active since` timestamp and continues beyond 59 minutes.
5. **Verification:** All `24` mobile tests and both frontend and backend TypeScript checks pass.
6. **Commit:** `00c48ce` (`Merge compact active task session timer`).

# OPERATOR
<!-- decision-os:note {"id":"note-1783857810969-6013ae06a134d","timestamp":"2026-07-12T12:03:31.048Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783857811028-faa7a5e8-df9d-4b3d-b313-5d32c2700d9d.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T12:03:31.035Z"} -->

Dans la même lancée que ce qu'on a fait sur les tabs actives, je veux que dans la queue, quand on clique sur une carte, ça nous emmène directement sur la task, au lieu d'avoir le state de collapse avec les boutons à l'intérieur, c'est superflu.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783857950076-3d1dd192","timestamp":"2026-07-12T12:05:50.062Z"} -->

Implemented and committed direct queue navigation.

1. **Queued row:** Clicking it now opens the master card directly.
2. **Removed disclosure:** Queue rows no longer create the collapsed subtask list, inline action buttons, or disclosure chevron.
3. **Queue ordering:** The dedicated reorder handle retains touch and drag behavior independently from row navigation.
4. **Verification:** All `27` mobile tests and both frontend and backend TypeScript checks pass.
5. **Commit:** `a4de1b3` (`Merge direct queue task navigation`).

# OPERATOR
<!-- decision-os:note {"id":"note-1783858234566-0d5e69d2b70568","timestamp":"2026-07-12T12:10:34.615Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783858234599-69000017-f000-4aa7-b240-07a1b93d8fb2.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T12:10:34.602Z"} -->

Oui, mais enlève aussi le subtitle dans les cartes de « no active subtask », ça ne sert à rien.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783858330452-593a94ea","timestamp":"2026-07-12T12:12:10.428Z"} -->

Implemented and committed the empty-subtask subtitle removal.

1. **No empty subtitle:** Task rows without an actionable subtask no longer render `No actionable subtask` or an empty subtitle element.
2. **Useful subtitle retained:** Rows with a real next subtask still display `Next: <title>`.
3. **Verification:** All `32` mobile tests and both frontend and backend TypeScript checks pass.
4. **Commit:** `933e5f2` (`Merge empty subtask subtitle removal`).

# OPERATOR
<!-- decision-os:note {"id":"note-1783858813228-a6991096a47f18","timestamp":"2026-07-12T12:20:13.294Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783858813266-9648d3a7-a60b-47c3-8240-dd778e089c16.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T12:20:13.270Z"} -->

Tant qu'à faire, enlève le nombre de tâches complétées aussi dans le sous-titre, ça ne sert à rien.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783858920812-6fff4c1d","timestamp":"2026-07-12T12:22:00.803Z"} -->

Implemented and committed the task-progress subtitle removal.

1. **Removed progress:** Task rows no longer display the `<complete>/<total> complete` fraction.
2. **Remaining metadata:** Non-active rows retain only ledger and age/status context, plus `Next: <title>` when a real next subtask exists.
3. **Verification:** All `33` mobile tests and both frontend and backend TypeScript checks pass.
4. **Commit:** `df678be` (`Merge task progress subtitle removal`).
