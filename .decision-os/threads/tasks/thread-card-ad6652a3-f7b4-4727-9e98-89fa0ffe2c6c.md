# OPERATOR
<!-- decision-os:note {"id":"note-1784015684042-9ffc3ddaeb9298","timestamp":"2026-07-14T07:54:44.155Z"} -->

http://127.0.0.1:50150/p/ZGVjaXNpb24tb3M/ledgers/specs/zones/zone-dcf3cd03-6efb-4d87-8439-38574ab8bfba/cards/card-89546a8b-0056-4957-892e-e82acaf94cbf

# OPERATOR
<!-- decision-os:note {"id":"note-1784015689726-eb67178c0e71e","timestamp":"2026-07-14T07:54:49.915Z"} -->

![Screenshot_20260714_145115_Brave.jpg](/.decision-os/thread-files/thread-card-ad6652a3-f7b4-4727-9e98-89fa0ffe2c6c/file-1784015689889-a2a2245d69006-Screenshot_20260714_145115_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1784015737102-56d899669760d8","timestamp":"2026-07-14T07:55:37.305Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784015737283-8ff2aefd-bc77-4d75-a278-2afa4c00fbd8.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T07:55:37.309Z"} -->

Parfois, quand je vais sur une carte depuis la liste des cartes actives et que j'ouvre le thread, je ne vois pas le CodexLog actif et je vois cette erreur « Project ID is required in the URL ». Pourtant, si je refresh la carte avec un refresh du browser de la page, je vois bien que le Codex process est actif et qu'il est en train de tourner avec l'animation autour de CodexLog. Donc en fait, il y a un espèce de discrepancy de state, je ne sais pas d'où ça provient. Est-ce que ça provient de l'URL qui est mal formée quand on vient des cartes actives ? Faites une recherche pour essayer d'expliquer ce comportement.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784016188296-623a19de","timestamp":"2026-07-14T08:03:08.297Z"} -->

Finding: the Active Cards link is correctly formed. The defect is a stale background Codex poller, not the card URL produced by the Active list.

1. The first card visit uses the scoped route `/p/ZGVjaXNpb24tb3M/...` and the run-status request returns HTTP `200` with `status: running`.
2. After the thread is closed and navigation returns to the global Control Room at `/`, the thread consumer remains registered. Its next poll derives scope from the current URL and sends unscoped `/api/codex/skills/runs/<runId>`.
3. The server correctly returns HTTP `400`: `Project id is required in the URL.` The frontend then stores this transport failure in `terminalSummaries` and stops polling.
4. Revisiting the card produces the correct `/p/ZGVjaXNpb24tb3M/...` URL, but the Codex Log replays the cached `unavailable` summary without a new recovery poll. A browser refresh clears that in-memory cache, and the scoped request again returns the active run.

I reproduced the complete sequence on `http://127.0.0.1:50150/?tab=active` with mobile Chromium: scoped HTTP `200`, then unscoped HTTP `400` on `/`, then cached `unavailable` on the correctly scoped card route.

Recommended implementation: carry immutable `projectId` in the run poller identity and every run-status request, then unregister the thread consumer when the mobile thread closes. Add the regression sequence `scoped card -> running thread -> Control Room -> poll tick -> same scoped card`.

The diagnostic subtask is done and the master-task gate is ready. No implementation files were changed; master completion remains pending explicit operator authorization.

# OPERATOR
<!-- decision-os:note {"id":"note-1784016933998-f6382d316515d","timestamp":"2026-07-14T08:15:34.276Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784016934252-a85183ab-b2f4-4589-9d73-c1c74ef01381.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T08:15:34.281Z"} -->

Qu'est-ce qui fait que dans les instructions pour créer les mastercards, tu ne me mets pas les findings ? C'est-à-dire que la tâche, on n'a pas le résumé de ce qu'il y a eu, et au lieu de ça, on a trois sections qui ne servent à rien. Je veux dire, une seule section pour dire l'objectif de la tâche, ça suffit. Et ensuite, une autre section pour expliquer le résultat ou l'état dans lequel on est. J'arrive pas à comprendre pourquoi les mastercards, elles sont aussi mauvaises. Ça ne sert à rien l'information qu'il y a dedans. Le scope, ça sert, mais après, acceptance criteria et ça, on s'en fout de ça. Donc comment ça se fait qu'elles ne sont pas bien les mastercards ? Quelle est l'instruction qui fait que ce n'est pas bon ?

# AGENT
<!-- decision-os:note {"id":"note-agent-1784017011714-97bb118e","timestamp":"2026-07-14T08:16:51.715Z"} -->

You are right. The master card is poor because I treated a formatting example as a mandatory content template, then left the master card as an intake plan after the investigation finished.

1. **Direct instruction responsible:** `AGENTS.md:55` says: `use H2 card sections with uppercase letters: ## A. Scope, ## B. Contract, ## C. Acceptance Criteria`. That rule was intended to specify heading format, but the named examples strongly imply a standard three-section template. I copied that template instead of selecting sections based on the useful result.
2. **Secondary pressure:** `AGENTS.md:16` includes `acceptance criteria` in its example of useful PRD content. This reinforces the habit of adding an Acceptance Criteria section even when the operator asked for research and the useful output is a finding.
3. **Not required by Decision OS:** `build-thread-codex-prompt.ts:25` requires only lettered headings, dividers, numbered lists, bold labels, and backticks. It does not require Scope, Contract, Evidence, or Acceptance Criteria.
4. **Not required by the ledger:** `validate-master-tasks.ts` requires the lifecycle label, ledger name, and timestamps. `master-task-apply` accepts arbitrary master Markdown. `master-task-gate` reads Acceptance Criteria when present, but an absent section does not block the gate.
5. **My specific failure:** after finding the root cause, I wrote the useful findings into the subtask and thread reply but only changed the master subtask status. I should have replaced the planning content in the master card with the verified result. No instruction told me to keep findings out of the master card.

The correct master-card content contract is:

1. `## A. Objective`: one concise statement of what the operator asked to achieve or determine.
2. `## B. Result / Current State`: the verified finding, decision, implementation state, blocker, and next operator action that currently matter.
3. `## C. Subtasks`: only the canonical linked-card statuses required by Decision OS.

The instruction should explicitly say: `The heading names shown in the formatting contract are syntax examples, not required sections. Do not add Acceptance Criteria, Contract, Evidence, or Scope sections by default. Every master card must be updated after execution so its Result / Current State section contains the useful operator-facing outcome.`

# OPERATOR
<!-- decision-os:note {"id":"note-1784017372078-cefa44d1697cc","timestamp":"2026-07-14T08:22:52.500Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784017372452-ba90ecef-5356-4ef1-8b46-b7a5047cea30.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T08:22:52.506Z"} -->

Bon, modifie la Mastercard, parce que... déjà qu'on puisse avoir un format correct sur celle-là.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784030712158-ea40922e","timestamp":"2026-07-14T12:05:12.159Z"} -->

Updated the master card to the corrected operator-facing format:

1. `## A. Objective` contains one concise description of the investigation.
2. `## B. Findings and Current State` contains the verified root cause, stale-cache mechanism, refresh explanation, runtime reproduction, recommended correction, and current implementation status.
3. `## C. Subtasks` retains only the canonical linked-subtask projection required by Decision OS.

The previous `Evidence` and `Acceptance Criteria` sections were removed. The card remains `#task-active`; diagnosis is complete, implementation has not started, and the master-task gate reports `ready: true` with no discrepancies.

# OPERATOR
<!-- decision-os:note {"id":"note-1784031334451-fb12606af376b8","timestamp":"2026-07-14T12:15:34.710Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784031334646-433ea0c8-997e-4917-b71e-2e60ff17776f.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T12:15:34.717Z"} -->

Exécute le plan qui est dans la mastercard afin de régler ce problème et n'oublie pas d'écrire une leçon dans le thread about ce qu'on aurait dû faire pour éviter d'avoir le problème qu'on a trouvé. Qu'est-ce qu'on aurait pu faire comme vérification en amont pour éviter de se retrouver dans la situation où on a un bug comme ça ?

# AGENT
<!-- decision-os:note {"id":"note-agent-1784032243722-683abc8a","timestamp":"2026-07-14T12:30:43.723Z"} -->

**Lesson — verify ownership across SPA lifecycle boundaries.**

1. A long-lived timer or subscription must capture its complete immutable ownership tuple when it is created. For this poller, that tuple is `projectId`, `ledgerId`, `cardId`, and `runId`; a later poll must never recover project ownership from `location.pathname`.
2. Every panel lifecycle test must verify teardown, not only rendering: close the thread, advance beyond one poll interval, and assert that the consumer is absent and no thread-owned request is emitted.
3. Route regression coverage must use a multi-project catalog and the real SPA sequence `scoped card -> open running thread -> Control Room -> same active card`. It must inspect every run-status URL and status code. Testing only a direct deep link or a browser refresh cannot expose stale in-memory consumers and caches.
4. Transport and scope failures must be reviewed separately from terminal run states. A request failure is not evidence that a Codex run is terminal, so it must not become an unrecoverable cached domain result.
5. The upstream release check that would have caught this bug is concrete: keep a run active, leave its project route without reloading, wait for the next timer tick, reopen it from Active Cards, and require a scoped HTTP `200` plus a still-running Codex Log.
