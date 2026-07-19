# OPERATOR
<!-- decision-os:note {"id":"note-1784287287143-8b190e56b41608","timestamp":"2026-07-17T11:21:27.152Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-50cbfca8-47c3-460e-acad-bd4bd3c7062c/paste-1784287287145-bcc968c872f4e.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784287320387-b089408cc343a","timestamp":"2026-07-17T11:22:00.430Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784287320427-0d09a71e-2d1d-48d2-bd2e-3c5961e8ad2f.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T11:22:00.433Z","uploadReceivedAt":"2026-07-17T11:22:00.427Z","audioPersistedAt":"2026-07-17T11:22:00.428Z","acceptedAt":"2026-07-17T11:22:00.428Z","providerStartedAt":"2026-07-17T11:22:00.433Z","providerSettledAt":"2026-07-17T11:22:02.703Z","completedAt":"2026-07-17T11:22:02.707Z","revision":4} -->

Dans la view des skills library, je ne comprends pas pourquoi les favoris, ils ne sont pas tout en haut, ça devrait être tout en haut. En plus de ça, quand je clique sur un skill, je veux avoir un markdown formaté pour voir le skill en plus de la description. Toi, tu ne me montres que la description, je veux pouvoir lire le skill. S'il y a des références, je veux que ce soit lié comme des cartes qui sont en relation, et comme ça, je peux pouvoir, je veux pouvoir voir et lire les références aussi.

# OPERATOR
<!-- decision-os:note {"id":"note-1784287326773-87e81afcf04c1","timestamp":"2026-07-17T11:22:06.793Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784287326791-f9d81440-b160-456d-a1e7-b7dd6b71626b.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T11:22:06.796Z","uploadReceivedAt":"2026-07-17T11:22:06.790Z","audioPersistedAt":"2026-07-17T11:22:06.791Z","acceptedAt":"2026-07-17T11:22:06.791Z","providerStartedAt":"2026-07-17T11:22:06.796Z","providerSettledAt":"2026-07-17T11:22:08.070Z","completedAt":"2026-07-17T11:22:08.074Z","revision":4} -->

Donc t'exécutes directement sans utiliser de skill.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784288625545-38f067a2-47b","timestamp":"2026-07-17T11:43:45.545Z"} -->

## A. Implemented

1. Favorite skills now remain first with deterministic ordering.
2. Selecting a skill renders the formatted `SKILL.md` instruction body in addition to its description.
3. Readable files below `references/` appear as connected related cards and expand into formatted content.
4. Reference discovery is path-free and excludes symlinks, binary files, unsupported extensions, and oversized documents.

---

## B. Verified

1. Frontend suite: `440` passed.
2. Backend suite: `182` passed.
3. Browser suite: `172` passed.
4. Change-specific Chromium verification: `3` passed, including favorite-first ordering, formatted skill content, and expandable references.
5. Frontend and backend typechecks passed.
6. The current route returns HTTP `200` and serves the merged frontend module.

---

## C. Delivery

1. Feature commit: `579baac5`.
2. Merge commit: `f37c3253`.
3. The Decision OS server was not restarted, following the server ownership rule.
4. The master task remains open for operator action.

# OPERATOR
<!-- decision-os:note {"id":"note-1784289665421-97ae2245c59078","timestamp":"2026-07-17T12:01:05.456Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784289665451-8fb926a3-2a1a-4502-90cf-1a62f349597b.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T12:01:05.469Z","uploadReceivedAt":"2026-07-17T12:01:05.450Z","audioPersistedAt":"2026-07-17T12:01:05.451Z","acceptedAt":"2026-07-17T12:01:05.451Z","providerStartedAt":"2026-07-17T12:01:05.469Z","providerSettledAt":"2026-07-17T12:01:08.155Z","completedAt":"2026-07-17T12:01:08.161Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-17T12:01:05.451Z","codexQueueRunId":"codex-skill-1784287329181-cc959638","revision":4} -->

C'est pas bon, ça n'utilise pas notre rendering de base de markdown qu'on utilise partout. T'as pas utilisé le bon parser, en tout cas pas le bon display, et en plus de ça, je voudrais que ce soit dans une scroll view, comme ça la modale elle continue de faire 80% ou 70% de la VH, ce qui est ultra important puisque en bas de la modale, on a des boutons pour les mettre en favoris ou je sais pas quoi, et autres donc là ça va pas.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784290676145-6b0800e8-9a9","timestamp":"2026-07-17T12:17:56.145Z"} -->

## A. Root cause corrected

1. The shared Markdown parser was already called, but skill-specific CSS replaced the base Markdown display.
2. The unbounded detail body also pushed tags and favorite controls thousands of pixels below the modal.

---

## B. Delivered behavior

1. Skill and reference content now retain the canonical `ledger-card-body` presentation.
2. The Skills Library modal stays at `80vh`, capped at `860px`.
3. Markdown scrolls inside its own view while tags, favorite, and status remain visible at the bottom.

---

## C. Verification and delivery

1. Change-specific Chromium geometry and rendering verification passed at `1440×900`.
2. Frontend `448/448`, backend `189/189`, focused responsive `14/14`, and both typechecks passed.
3. The repository browser suite passed `171/174`; the three failures are outside the changed surface and reproduced in isolation.
4. Feature commit: `c1c44786`. Merge commit: `16080769`.
5. The served `/skills` route returns HTTP `200`; the server was not restarted.
6. The master task remains open for operator review.

# OPERATOR
<!-- decision-os:note {"id":"note-1784291197517-80d23b2db0c2d","timestamp":"2026-07-17T12:26:37.634Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-50cbfca8-47c3-460e-acad-bd4bd3c7062c/paste-1784291197627-3802887a80d11.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784291229874-4a5844d169c7e","timestamp":"2026-07-17T12:27:09.922Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784291229917-4c28aebb-3d78-4e7a-822b-d8179ea77fed.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T12:27:09.943Z","uploadReceivedAt":"2026-07-17T12:27:09.917Z","audioPersistedAt":"2026-07-17T12:27:09.918Z","acceptedAt":"2026-07-17T12:27:09.918Z","providerStartedAt":"2026-07-17T12:27:09.943Z","providerSettledAt":"2026-07-17T12:27:13.851Z","completedAt":"2026-07-17T12:27:13.855Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-17T12:27:09.918Z","codexQueueRunId":"codex-skill-1784287329181-cc959638","revision":4} -->

T'as fait une erreur fondamentale là, t'as complètement cassé le design au niveau des skills, au niveau des cartes. Et en plus ça c'est des c'est des cartes, c'est pas des boutons, c'est pas parce que c'est cliquable que ça doit avoir la même tronche qu'un bouton. Donc euh fais-moi un design un peu différent là, parce que sinon je le vois partout ce truc-là, ça commence à me à me saouler, on ne fait plus la différence entre un bouton et le reste, tout se ressemble.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784291781299-007b6956-c3f","timestamp":"2026-07-17T12:36:21.300Z"} -->

## A. Root cause

1. The skill rows were raw buttons, so the global action-control design supplied the inset shadow, raised surface, press animation, and control sizing.
2. At the reported viewport, `105px` of content was compressed into a `64px` row.

---

## B. Corrected design

1. Skill and pipeline results are now flat `ARTICLE` card surfaces with a restrained category rail.
2. Their accessible activation targets are transparent and have no button shadow, background, or press transform.
3. Related-reference cards follow the same card-versus-control separation.
4. Favorite ordering, formatted Markdown, the `80vh` scroll view, and persistent bottom actions remain unchanged.

---

## C. Verification and delivery

1. Served Chromium verification passed at the screenshot viewport `853×550`.
2. Frontend `454/454`, focused responsive `15/15`, the complete change-specific browser file `3/3`, and frontend typecheck passed.
3. Feature commit: `a003f70d`. Merge commit: `faf3cad5`.
4. `/skills` returns HTTP `200`; the server was not restarted.
5. The master task remains open for operator review.

# OPERATOR
<!-- decision-os:note {"id":"note-1784292411561-696124b0de059","timestamp":"2026-07-17T12:46:51.603Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784292411599-2fb27ee1-306a-4c35-886d-c19dfc042a48.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T12:46:51.625Z","uploadReceivedAt":"2026-07-17T12:46:51.599Z","audioPersistedAt":"2026-07-17T12:46:51.599Z","acceptedAt":"2026-07-17T12:46:51.599Z","providerStartedAt":"2026-07-17T12:46:51.625Z","providerSettledAt":"2026-07-17T12:46:54.526Z","completedAt":"2026-07-17T12:46:54.531Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-17T12:46:51.599Z","codexQueueRunId":"codex-skill-1784287329181-cc959638","revision":4} -->

Il y a un problème fondamental, c'est que les labels et le statut de favori ne sont pas persistés. Ça veut dire que je clique dessus, ça met bien saving nanani, et pourtant, une fois que ça a été saved, si je fais un hard reload, je me retrouve avec encore les labels qui ne sont pas set et le statut de favori qui n'est pas set. Donc il y a eu un problème fondamental, tu fais une analyse, tu fixes ça et tu te rappelleras de la leçon de pourquoi ça n'avait pas fonctionné et pourquoi tu ne l'avais pas vu venir.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784293484344-1c58baaa-ae2","timestamp":"2026-07-17T13:04:44.344Z"} -->

## A. Root cause found and corrected

1. **Global reload and global writes had different owners.** Reload read `/home/jbb/.decision-os/codex-pipelines.json`, while the UI wrote favorite and label metadata into project stores.
2. The live master store was empty, project stores contained the changes, and `/api/codex/server-skills` consequently rehydrated the defaults.
3. The UI now writes one master-owned metadata endpoint, and detail hydration reads that same owner.

---

## B. The missed lesson is now covered

1. A saving indicator and HTTP `200` do not prove persistence.
2. Persistence verification must prove the optimistic transition, inspect the authoritative stored value, hard reload, and verify rejection rollback.
3. The new browser regression exercises all three moments; backend coverage proves no child project replica is mutated.

---

## C. Delivery state

1. Frontend `457/457`, backend `197/197`, focused backend `6/6`, responsive `15/15`, both typechecks, and the focused persistence browser scenario passed.
2. Feature commit: `61137558`. Merge commit: `167f0c17`.
3. I did not restart the Decision OS server because that requires explicit operator authorization. The implementation is merged; live hard-reload validation remains gated on that restart, so the master task stays open.

# OPERATOR
<!-- decision-os:note {"id":"note-1784298966109-938de3132ac098","timestamp":"2026-07-17T14:36:06.133Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-50cbfca8-47c3-460e-acad-bd4bd3c7062c/paste-1784298966111-be5518ea6db67.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784298985697-784f4fc045e6d","timestamp":"2026-07-17T14:36:25.743Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784298985739-4df178a9-76ec-49f9-916d-4212e72858ae.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T14:36:25.746Z","uploadReceivedAt":"2026-07-17T14:36:25.739Z","audioPersistedAt":"2026-07-17T14:36:25.739Z","acceptedAt":"2026-07-17T14:36:25.740Z","providerStartedAt":"2026-07-17T14:36:25.746Z","providerSettledAt":"2026-07-17T14:36:27.951Z","completedAt":"2026-07-17T14:36:27.956Z","revision":4} -->

Il n'y a toujours pas les favoris en top de la liste. Je ne comprends pas comment tu fais pour te tromper et pour pas être capable de les voir dans la skill library. C'est... C'est outrageous.

# OPERATOR
<!-- decision-os:note {"id":"note-1784299026652-adbaa78e0d77f8","timestamp":"2026-07-17T14:37:06.674Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-50cbfca8-47c3-460e-acad-bd4bd3c7062c/paste-1784299026654-63a37fc92364a.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784299041405-d7a3f344b172d","timestamp":"2026-07-17T14:37:21.448Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784299041445-cd0db722-80a4-49dd-8cfc-61a44c92f9f9.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T14:37:21.451Z","uploadReceivedAt":"2026-07-17T14:37:21.445Z","audioPersistedAt":"2026-07-17T14:37:21.446Z","acceptedAt":"2026-07-17T14:37:21.446Z","providerStartedAt":"2026-07-17T14:37:21.451Z","providerSettledAt":"2026-07-17T14:37:23.420Z","completedAt":"2026-07-17T14:37:23.425Z","revision":4} -->

En fait, le state entre ce qu'il y a dans la skill library et ce qu'il y a dans process card, c'est tellement évident que ce n'est pas le même. C'est tellement évident que ça ne cherche pas du tout la même information.

# OPERATOR
<!-- decision-os:note {"id":"note-1784299042839-117fb7cf531268","timestamp":"2026-07-17T14:37:22.862Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-50cbfca8-47c3-460e-acad-bd4bd3c7062c/paste-1784299042841-62813f7eee6d7.png)

# AGENT
<!-- decision-os:note {"id":"note-agent-1784299626777-198077a8-c9d","timestamp":"2026-07-17T14:47:06.777Z"} -->

## A. Root cause corrected

1. **The sorting code was receiving the wrong state.** Skills Library read zero favorites from the server store while Process Card read three favorites from the project store.
2. Favorite and tag metadata now has one server owner used by both views, and existing project selections migrate into it.
3. Project-specific model and effort defaults remain project-scoped.

---

## B. Verification

1. Focused metadata-owner regression passed `4/4`.
2. Backend suite passed `198/198`; backend typecheck passed; favorite-first presentation checks passed `3/3`.
3. Feature commit: `b4239c8e`. Merge commit: `e2ccb5b4`.

---

## C. Remaining live gate

1. I did not restart the running Decision OS server because restart authorization was not provided.
2. The merged implementation passes automated checks, but the operator-route hard-reload interaction still requires that restart.
3. The master task remains open.
