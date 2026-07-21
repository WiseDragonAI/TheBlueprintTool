# OPERATOR
<!-- decision-os:note {"id":"note-1784031837034-d3248d10c1c0a","timestamp":"2026-07-14T12:23:57.365Z"} -->

![Screenshot_20260714_192337_Brave.jpg](/.decision-os/thread-files/thread-card-53faf998-2066-4a03-b4f6-d529fcb89ad6/file-1784031837326-f2933548db1288-Screenshot_20260714_192337_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1784031946061-78f578a3d235f","timestamp":"2026-07-14T12:25:46.426Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784031946379-9663c81b-53c9-496c-8222-601fd1ae5b18.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T12:25:46.437Z"} -->

Quand j'essaie de lancer un skill, il me dit, donc il y a l'erreur que tu vois qu'il y a déjà un pipeline qui est actif. Le problème de ça, c'est que moi je veux quand même le mettre, je veux quand même faire la queue, je veux le mettre dans la queue. J'ai pas de problème à ce qu'il ne soit pas actif tout de suite et d'avoir un seul pipeline qui tourne à la fois. Et encore, ça veut dire que des cartes, des dépendances, effectivement, il faut que ce soit géré. Après, il faudrait pouvoir set un nombre maximum de codex process qui tournent en même temps, mais il faudrait que ça puisse rentrer dans la queue en fait et ce sera process plus tard. Et ça doit rentrer dans la queue, dans les actives, et au lieu d'avoir le stopwatch chronomètre, je dois voir que c'est waiting ou queued, mais avec sa place dans la queue. Mais je ne peux pas avoir une erreur comme ça qui me dit « c'est mort », qui me dit que ce n'est pas possible de le faire. Donc ça, c'est une erreur, c'est une erreur de design du UX. En plus de ça, c'est que quand j'appuie sur le bouton, je ne vois même pas l'erreur, parce que l'erreur, elle est dans la modal de sélection des skills, alors que le bouton, il est dans la modal du skill en particulier. Donc c'est complètement raté en fait. En plus de ça, quand je le lance, ça reste dans cette modal de skill alors que ça devrait retourner dans la vue de la master task. Donc ça fait beaucoup d'erreurs là-dessus, en termes d'UX.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784033822138-24c9ab44","timestamp":"2026-07-14T12:57:02.139Z"} -->

Implemented and merged the durable FIFO Codex run queue. The workspace limit is configured with maxConcurrentCodexProcesses in .decision-os/.settings.json (default 1, range 1–32). Mobile now closes the skill detail after a successful submission, returns to the source master task, and shows queued runs in Active as “Queued · position N” without a stopwatch. Focused backend queue/recovery tests and all 53 focused mobile tests pass; the served mobile route also passed the touch launch/navigation flow with a mocked 202 queue response. One verification remains: the running server process loaded the pre-merge backend, and I did not restart it because restart ownership requires explicit operator authorization. Please authorize one server restart; I will then verify a real launch at full capacity, FIFO promotion, and persistence after reload. The master task remains active until that check.

# OPERATOR
<!-- decision-os:note {"id":"note-1784036637848-2cd9236e847c8","timestamp":"2026-07-14T13:43:58.056Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784036638015-d138ff25-e39f-4e25-8323-678bcfdac114.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T13:43:58.064Z"} -->

Il y a un truc qui manque dans le scope parce que c'est aussi au niveau des codex run en fait. Et ce qu'on veut en plus de ça évidemment, c'est de faire un écran de settings qui est accessible depuis le burger menu pour pouvoir configurer ce nombre maximum de process codex qu'on peut lancer.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784037694328-98735e5c","timestamp":"2026-07-14T14:01:34.329Z"} -->

Implemented and merged the expanded scope in `3904e1c`. Pipeline skills, direct skills, thread starts, and continuations now share one durable project FIFO queue and one `maxConcurrentCodexProcesses` limit. The burger menu now opens `/settings`, where the operator selects a project and configures an integer limit from `1` through `32`; the backend preserves unrelated settings and fills newly available capacity immediately.

Verification: focused backend scheduling/settings/recovery tests pass, the full mobile suite passes `75/75`, and Android Chromium verified burger → Settings navigation on the served route. The running server still has the pre-merge backend loaded, so real settings persistence and cross-kind queue promotion cannot yet be verified. Please authorize one server restart so I can execute the final real save/reload, full-capacity thread enqueue, FIFO promotion, and recovery checks. The master task and its three subtasks remain active until that evidence is recorded.

# OPERATOR
<!-- decision-os:note {"id":"note-1784038440427-c7ba78efc9549","timestamp":"2026-07-14T14:14:01.197Z"} -->

![Screenshot_20260714_211215_Brave.jpg](/.decision-os/thread-files/thread-card-53faf998-2066-4a03-b4f6-d529fcb89ad6/file-1784038441118-ad668a249d6458-Screenshot_20260714_211215_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1784040403343-acd4ea6d63b4d8","timestamp":"2026-07-14T14:46:43.651Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784040403606-50732522-7730-49bb-9168-f1c696cb06e9.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T14:46:43.666Z"} -->

Ce screen il ne va pas, je ne comprends même pas pourquoi on devrait sélectionner le projet, ça ne sert à rien. Et en plus de ça, on ne veut pas du tout un input avec du texte pour mettre le maximum concurrent en codex process. Il faut que ce soit un sélecteur avec du haut-bas, un bouton vers le haut, un bouton vers le bas. Il y a déjà des sélecteurs, il y a déjà des UX absolument faites pour sélectionner un numéro.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784042159709-98f5b032","timestamp":"2026-07-14T15:15:59.710Z"} -->

Corrected and merged. `/settings` now configures one server-wide `maxConcurrentCodexProcesses` value, with no project selector and no editable input. The value is displayed between `↑` and `↓` buttons using the existing `codex-icon` control, including disabled states at `1` and `32`.

Android Chromium verified the served route at HTTP `200`: burger → Settings, zero selectors, zero inputs, `1 → 2 → 1`, both bounds, and matching `44 × 44` reference styling. Focused Settings tests pass `3/3`; the full mobile suite remains `75/75`. The corrections are merged in `2a32780` and `4ecff1a`.

The running server still has the pre-merge backend loaded, and I did not restart it. Please authorize one server restart to verify real save/reload, full-capacity enqueue, FIFO promotion, and recovery. The master task remains active until that backend evidence is recorded.

# OPERATOR
<!-- decision-os:note {"id":"note-1784046382251-287c24ace685e8","timestamp":"2026-07-14T16:26:22.887Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784046382842-45ba59da-0198-4216-8948-d3172263b998.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T16:26:22.898Z"} -->

Il y a un problème ici puisque quand la queue elle est pleine et qu'on essaye de lancer le codex run, au lieu de nous montrer que ça a été queued et que ça va être process bientôt, ça fait ça le met en start et ensuite ça le remet comme s'il était posé et qu'il ne se passait rien et du coup on ne comprend pas ce qui se passe. Donc ça, ça fera une leçon à se rappeler qu'il faut vraiment se poser la question de qu'est-ce que ça implique comme changement en termes d'UX vis-à-vis des UX qui étaient déjà existantes.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784047441712-ec6782ba","timestamp":"2026-07-14T16:44:01.714Z"} -->

The queued-launch UX is corrected and merged in `6eb67bc`.

Root cause: the backend correctly returned `status: "pending"` and `queuePosition`, but the mobile status normalizer discarded the position and reduced every non-running state to idle. That re-exposed the Run controls and rendered `RESUME/START` after an accepted HTTP `202`.

Queued is now a first-class occupied state. The Run row stays hidden, Codex Log shows `Queued · position N`, no elapsed timer, and `CANCEL`; promotion changes the same run to running without exposing a duplicate launch. Android Chromium verified the canonical card route at HTTP `200`: a touch launch queued at position `2`, the state survived reload, and launch controls remained hidden. The real continuation for this card also persisted in the queue for `103` seconds before scheduler promotion.

Verification: frontend typecheck passed, focused queue-state coverage passed, and the full mobile suite passed `78/78`. The full frontend run still has three unrelated existing stale-test failures: image-viewer project scoping, a Codex preference fixture expecting `high` while receiving `medium`, and the removed `codexNoteClass` source assertion. The master task and all three subtasks are now complete.
