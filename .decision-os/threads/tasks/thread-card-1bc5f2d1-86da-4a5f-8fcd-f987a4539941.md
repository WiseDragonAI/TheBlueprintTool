# OPERATOR
<!-- decision-os:note {"id":"note-1783857951908-22e1c0758f0048","timestamp":"2026-07-12T12:05:51.977Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783857951962-de7dcd51-39c9-4d8d-bbaa-fd41042e530b.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T12:05:51.968Z"} -->

dans la control room, dans les tabs en bas, où on peut voir la queue, celles qui sont actives, je veux voir le nombre de cartes actives et le nombre de cartes dans la queue. Au lieu d'écrire « Active cards » dans le subtitle, je veux que ce soit un nombre dynamique avec écrit le nombre de cartes, ou le nombre de tasks plutôt.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783858147730-3397f13f","timestamp":"2026-07-12T12:09:07.746Z"} -->

Implemented dynamic task totals in the mobile Control Room Queue, Active, and Done tab subtitles. Each subtitle now renders `1 task` for a single task and `<count> tasks` otherwise, and the totals update with the selected ledger filter.

Verification: `node --test frontend-mobile/test/mobile-control-room.test.mjs` passes all `20` tests. The implementation was committed as `3d50268` and merged into `main` by `8d1287e`. The linked implementation subtask is `done`; the master card remains `#task-active` pending explicit operator completion authorization.
