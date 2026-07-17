# OPERATOR
<!-- decision-os:note {"id":"note-1784286191212-66d2e3d3430898","timestamp":"2026-07-17T11:03:11.221Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-8b1412c6-9cfb-4501-a39b-3b0b8ee4bdc5/paste-1784286191214-34b6e21bcff8.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784286234834-372cd1aba12e78","timestamp":"2026-07-17T11:04:49.228Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784286289225-f152a388-8817-471c-9778-c540ebde988b.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T11:04:49.231Z","uploadReceivedAt":"2026-07-17T11:04:49.225Z","audioPersistedAt":"2026-07-17T11:04:49.226Z","acceptedAt":"2026-07-17T11:04:49.226Z","providerStartedAt":"2026-07-17T11:04:49.231Z","providerSettledAt":"2026-07-17T11:04:52.351Z","completedAt":"2026-07-17T11:04:52.355Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-17T11:04:49.226Z","codexQueueRunId":"codex-skill-1784286292443-0239c27c","revision":4} -->

ici on a un problème puisque en fait dans un même projet ou même dans des projets différents, les tâches, elles ne sont pas que triées par depuis quand elles attendent, elles sont aussi triées par, par node de la fédération, ce qui ne va pas. Et en plus de ça, on veut reverse l'order on veut celles qui attendent depuis le moins longtemps, on veut les mettre en haut et celles qui attendent depuis le plus longtemps en bas, comme ça, ça nous permet d'avoir une stack qu'on peut dépiler, mais continuer à traiter de manière euh Enfin en soit, tu t'en foutes pourquoi, mais on veut ça.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784286462348-99d9739a-e37","timestamp":"2026-07-17T11:07:42.348Z"} -->

Treated as a `bug` and converted into the **Global Control Room Queue Ordering** zone.

1. **Verified cause:** the local Control Room projector uses an oldest-first timestamp fallback, while the federation merger concatenates node-local Queue arrays without re-sorting them.
2. **Required order:** preserve explicit operator `Queue rank`; otherwise place the most recently waiting task first and the longest-waiting task last across every project and federation node.
3. **Implementation boundary:** correct the server-owned Queue projection and federation merge; leave Exec, Backlog, rendering, ownership metadata, and drag persistence unchanged.
4. **Plan:** three relationship-backed subtasks cover the code correction, local and federated regression coverage, and served mixed-node verification.
5. **Readiness:** `READY_FOR_TASK_DEPENDENCY`. Implementation has not started and all subtasks remain open.

# OPERATOR
<!-- decision-os:note {"id":"note-1784288419746-de8b2e1401783","timestamp":"2026-07-17T11:40:19.854Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784288419850-f7323bff-2e5e-4000-8f00-b742dfb83aa3.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T11:40:19.875Z","uploadReceivedAt":"2026-07-17T11:40:19.850Z","audioPersistedAt":"2026-07-17T11:40:19.850Z","acceptedAt":"2026-07-17T11:40:19.850Z","providerStartedAt":"2026-07-17T11:40:19.875Z","providerSettledAt":"2026-07-17T11:40:21.811Z","completedAt":"2026-07-17T11:40:21.816Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-17T11:40:19.850Z","codexQueueRunId":"codex-skill-1784286292443-0239c27c","revision":4} -->

On va exécute directement.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784288784260-e6fb0053-1c6","timestamp":"2026-07-17T11:46:24.260Z"} -->

Implemented and merged the Queue ordering correction.

1. **Behavior:** explicit `Queue rank` remains authoritative; unranked tasks now sort from the most recent `waitingTime` to the oldest.
2. **Federation:** the merged Queue is re-sorted after task qualification, so local and remote tasks no longer remain grouped by node.
3. **Isolation:** Exec, Backlog, Done, ownership metadata, rendering, and drag persistence were not changed.
4. **Verification:** focused unit checks pass `8/8`, focused HTTP and federation checks pass `5/5`, backend typechecking passes, and the complete backend suite passes `188/188`.
5. **Commits:** feature `21824d70`; merge `c430f41e`.
6. **Remaining gate:** I did not restart the running server. Served `/?tab=queue` verification remains open until the merged backend is loaded and the mixed-node DOM order is exercised.

# OPERATOR
<!-- decision-os:note {"id":"note-1784289495800-c956fa6d7744d8","timestamp":"2026-07-17T11:58:15.819Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-8b1412c6-9cfb-4501-a39b-3b0b8ee4bdc5/paste-1784289495802-2d80606479b46.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784289523208-9bf7fa93273888","timestamp":"2026-07-17T11:58:43.255Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784289523250-56b52963-69b4-4e9c-84d2-c18402fd2ee5.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T11:58:43.282Z","uploadReceivedAt":"2026-07-17T11:58:43.250Z","audioPersistedAt":"2026-07-17T11:58:43.251Z","acceptedAt":"2026-07-17T11:58:43.251Z","providerStartedAt":"2026-07-17T11:58:43.282Z","providerSettledAt":"2026-07-17T11:58:46.881Z","completedAt":"2026-07-17T11:58:46.885Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-17T11:58:43.251Z","codexQueueRunId":"codex-skill-1784286292443-0239c27c","revision":4} -->

Ça ne marche pas correctement. Là, je ne sais pas pourquoi le Today's, il est ordonné avant le one minute. Est-ce que c'est parce que tu as fait avec le 2D qui... Enfin, je ne comprends pas, je ne comprends pas, mais ça ne marche pas en tout cas correctement. Je vois bien que l'ordre a changé, mais ce n'est pas encore bon. Ce n'est pas vraiment ordonné par le waiting synth.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784289918377-4a8842cd-748","timestamp":"2026-07-17T12:05:18.377Z"} -->

The implementation subtask is reopened because the served screenshot contradicts the success claim.

1. **Screenshot:** `Mobile` 2d rows are grouped above `Workstation` 1m and 4m rows.
2. **Workstation API now:** `http://127.0.0.1:50151/api/control-room` is HTTP `200`, all checked Queue ranks are null, and its sequence is correctly newest-first.
3. **State changed:** the three 2d screenshot cards are now Backlog, so the exact screenshot projection is no longer available.
4. **No patch yet:** the unresolved boundary is the client node/cache path between API projection and rendered DOM.
5. **Required evidence:** send the exact URL shown in that screenshot and identify the device plus browser. I will then capture that node response and request sequence before correcting the first wrong transition.
