# OPERATOR
<!-- decision-os:note {"id":"note-1783852311594-3093b2ef43dc28","timestamp":"2026-07-12T10:31:51.919Z"} -->

![Screenshot_20260712_173136_Brave.jpg](/.decision-os/thread-files/thread-card-b5623e76-e319-4abe-bde1-08139a0b040f/file-1783852311887-be342a16780f18-Screenshot_20260712_173136_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1783852348936-8c8b032680cc58","timestamp":"2026-07-12T10:32:29.046Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783852349034-1ff5fbd0-6f1b-4710-be87-8230a2bc9921.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T10:32:29.039Z"} -->

Le header de ma carte, là, il est trop confus. Il y a deux lignes avec le bouton « back », ça devrait juste être un bouton « back », il n'y a pas besoin d'écrire « back to control room ». Le process et le thread devraient être en fait sur la même ligne, donc les trois boutons. Et ensuite, le « Polish mobile thread codec header » qui est le title de la carte, il devrait être dans une fonte qui est plus petite pour le mobile et du coup évidemment prendre l'entièreté de la largeur.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783852577157-06e7eefc","timestamp":"2026-07-12T10:36:17.120Z"} -->

Implemented and merged the mobile card-detail header update into `main`.

1. `Back`, `Process card`, and `Thread` now share one equal-width row.
2. The navigation label is now `← Back`; its existing destination behavior is unchanged.
3. The card title now sits below the controls, uses the full width, and has a smaller mobile font.
4. `node --test frontend-mobile/test/mobile-codex.test.mjs` passes all `8` tests.
5. The implementation subtask is `done`; the master card remains `#task-active` because master completion was not explicitly authorized.
