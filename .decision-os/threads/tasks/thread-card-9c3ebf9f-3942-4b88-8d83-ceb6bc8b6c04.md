# OPERATOR
<!-- decision-os:note {"id":"note-1783853076076-626d746a139b","timestamp":"2026-07-12T10:44:36.132Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783853076123-c703fa31-451f-4066-b5fe-19fd3097bc11.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T10:44:36.127Z"} -->

Quand on ouvre un thread, il faut arrêter de mettre l'input de texte en focus avec le keyboard, parce que sinon ça ouvre le keyboard et ça me despace.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783853329847-649aba94","timestamp":"2026-07-12T10:48:49.864Z"} -->

Implemented the thread keyboard-focus fix. Pressing `A` now opens a closed thread panel without focusing `.thread-draft`; pressing `A` while the panel is already open leaves focus unchanged. The obsolete `focus-thread-draft.ts` effect was removed, and focused regression coverage was added.

Verification passed: the focused thread keyboard test and `npm run typecheck:frontend`. The implementation is committed in `fb27625` and merged in `3dd2887`. The master card and zone are named `Stop Thread Draft Autofocus`, the linked subtask is recorded, and master-task validation passes. The card remains `#task-active` pending explicit completion authorization.

# OPERATOR
<!-- decision-os:note {"id":"note-1783853949509-be9e5a904f0c78","timestamp":"2026-07-12T10:59:09.603Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783853949591-a87bbf15-1e76-4971-a237-49bc564fd5d5.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T10:59:09.597Z"} -->

Mais tu l'as pas fait pour le mobile, puisque sur le mobile, quand j'appuie sur thread dans mobile, ça me focus toujours le truc et ça mouve le keyboard. Tu l'as fait que pour euh Non mais t'as fait une erreur, en fait tu l'as fait pour desktop au lieu de le faire pour mobile. Ah oui, je te l'ai pas dit euh. Mais j'ai dit ça ouvre le keyboard. Ouvrir le keyboard, c'est une habitude qui n'est que sur le mobile, c'est pas sur le desktop, donc la la desktop, l'habitude desktop, il ne fallait pas la changer, donc déjà tu me reverte ton comit et tu fais une vraie étude pour voir comment ça fonctionne sur mobile.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783854071695-2b0c3d73","timestamp":"2026-07-12T11:01:11.711Z"} -->

The incorrect desktop change has been reverted in commit `8b362cf`. Desktop behavior is restored: pressing `A` while the thread panel is open calls `focusThreadDraft()` again.

Verified mobile finding: the mobile card `Thread` button is bound in `frontend-mobile/src/mobile-thread.js`. Its click handler calls `openMobileThread()`, which selects the card thread, renders the mobile inspector, then explicitly executes `document.querySelector('.thread-draft')?.focus()`. This final statement opens the mobile software keyboard and shifts the layout.

The correct mobile-specific implementation is to remove that explicit focus statement from `openMobileThread()` while leaving the desktop keyboard router and `focusThreadDraft()` unchanged. I did not apply the mobile change during this investigation. Verification after the revert passed: `node --test frontend-mobile/test/mobile-thread.test.mjs` and `npm run typecheck:frontend`. Master-task validation also passes; the card remains `#task-active` pending the mobile implementation and explicit completion authorization.

# OPERATOR
<!-- decision-os:note {"id":"note-1783854451720-3cb2ef71b749d8","timestamp":"2026-07-12T11:07:31.778Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783854451758-4abf5cd5-380c-4c25-a31a-785367d2db81.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T11:07:31.762Z"} -->

Exécute le correctif.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783854572696-7a9d9b0e","timestamp":"2026-07-12T11:09:32.723Z"} -->

Implemented the mobile-specific fix. `openMobileThread()` no longer focuses `.thread-draft`, so tapping `Thread` renders the inspector without automatically opening the software keyboard. Desktop `A` shortcut behavior remains unchanged.

Added a focused mobile regression test that verifies `openMobileThread()` renders the panel without calling `.focus()`. All three mobile thread tests and `npm run typecheck:frontend` pass. The implementation is committed in `5b598b8` and merged in `c8d8df8`; master-task validation passes. The card remains `#task-active` pending explicit completion authorization.
