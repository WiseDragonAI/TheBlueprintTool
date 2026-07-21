# OPERATOR
<!-- decision-os:note {"id":"note-1784047734332-cedd265501895","timestamp":"2026-07-14T16:48:54.369Z"} -->

http://127.0.0.1:50150/p/ZGVjaXNpb24tb3M/ledgers/specs/zones/zone-9f2f623e-a34a-49af-b4e7-cd1063fc2120/cards/card-79fefde6-99a4-4c0d-a3cb-78d5877b0f63

# OPERATOR
<!-- decision-os:note {"id":"note-1784047788071-06a8d2b8081cd","timestamp":"2026-07-14T16:49:48.325Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784047788279-839cb86f-1462-474a-a1b6-95880b4db7a0.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T16:49:48.334Z"} -->

Ce run là, il montre deux différents timers, un timer dans le codex log qui montre le correct timer, qui est le timer du pipeline, et un autre timer dans les tabs actifs qui montre un timer qui est complètement différent, qui n'est pas le bon timer, je ne sais pas ce que c'est, mais ça montre cinq minutes et quelques. Donc à mon avis, le actif, il ne prend pas le dernier lancement de pipeline ou de codex exec, mais il a l'air de faire autre chose. Il a l'air de montrer, je ne sais pas, un temps depuis la première fois où on a lancé le codex exec, je ne sais pas, il faut trouver.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784048178956-db447dfb","timestamp":"2026-07-14T16:56:18.958Z"} -->

Fixed and verified.

1. RCA: the Control Room stopwatch used the card Markdown `Active since` timestamp, which represented the first task activation. The Codex log used the current run segment's server-owned `startedAt` timestamp. On the referenced card those values differed by 5 minutes 7.595 seconds.
2. The Control Room now carries the current direct-run or active pipeline-skill `startedAt` value into task parsing and uses it for the Active stopwatch and age.
3. Regression coverage proves a current run timestamp replaces an older persisted activation timestamp.
4. The focused 41-test Control Room suite and full 79-test mobile suite pass.
5. Mobile Chromium loaded `http://127.0.0.1:50150/?tab=active` with HTTP 200 and no runtime errors. Both visible stopwatch anchors exactly matched their run-status API timestamps.
6. The implementation is committed in `9367924` and merged to `main` in `1852d73`. No server restart was performed.
7. Both subtasks are done and the master-task gate reports `ready: true`. The master remains active pending explicit completion authorization.

# OPERATOR
<!-- decision-os:note {"id":"note-1784056680307-bd418b6fc0a9c8","timestamp":"2026-07-14T19:18:01.609Z"} -->

![Screenshot_20260715_021749_Brave.jpg](/.decision-os/thread-files/thread-card-d18c1157-d5cd-4a53-b743-9a6aa278dbd3/file-1784056681544-3ee77b025d04e8-Screenshot_20260715_021749_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1784056690572-7f9d5238262d7","timestamp":"2026-07-14T19:18:11.373Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784056691315-329913eb-4fcf-4c4a-bba1-78c4dc8619b2.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T19:18:11.384Z"} -->

Il y a un problème fondamental au niveau des timers, là je sais pas, t'as fait une régression terrible, c'est impossible qu'ils soient tous lancés en même temps.

# OPERATOR
<!-- decision-os:note {"id":"note-1784056700234-0a3ca5f8e20aa","timestamp":"2026-07-14T19:18:20.515Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784056700478-5e8cf692-9ba7-40ba-8d41-42b8695a43f4.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T19:18:20.523Z"} -->

Donc tu fais une analyse de ce qui est en train de se passer au niveau des timers, au niveau du state, et tu corriges le problème.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784057527424-ebccf984","timestamp":"2026-07-14T19:32:07.426Z"} -->

Corrected after reopening the previous success claim.

1. RCA: my previous fix used the status API's process-segment `startedAt` for every Active timer. Server recovery creates a new segment timestamp. With the configured concurrency limit of `5`, five queued continuations were dispatched within `679 ms`, so the screenshot showed five unrelated logical runs at `00:29`.
2. The first incorrect transition was `process recovery → new segment startedAt → Control Room clock anchor`.
3. Direct Codex tasks now keep the persisted logical launch timestamp in `Active since`.
4. Pipeline tasks now use the durable pipeline attempt `resumedAt`, falling back to `createdAt`.
5. The focused 42-test Control Room suite and full 80-test mobile suite pass.
6. Mobile Chromium loaded `http://127.0.0.1:50150/?tab=active` with HTTP 200 and no runtime error. The served rows showed distinct `02:18` and `04:30` timers, and both DOM anchors exactly matched their cards' persisted logical launch timestamps.
7. The correction is committed in `2549f01` and merged to `main` in `dc81ac9`. No server restart was needed.
8. Both reopened subtasks are done and the master-task gate reports `ready: true`. The master remains active pending explicit completion authorization.
