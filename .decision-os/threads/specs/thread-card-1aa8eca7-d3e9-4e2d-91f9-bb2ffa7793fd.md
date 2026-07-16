# OPERATOR
<!-- decision-os:note {"id":"note-1783854583722-70e2cd8cca1478","timestamp":"2026-07-12T11:09:43.820Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783854583805-2f3e9f0d-4170-410b-97db-44ac3e536a15.wav","status":"transcribed","transcriptionStartedAt":"2026-07-12T11:09:43.812Z"} -->

Dans le Control Room, le « active tab », ça ne devrait pas juste être quelque chose qui est purement un State.js, mais on devrait aussi avoir le tab dans l'URL et le anchor du scroll dans l'URL, comme ça quand on refresh, ça nous permet de retomber là où on était. Pour mobile uniquement évidemment.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783857982332-01770d94","timestamp":"2026-07-12T12:06:22.355Z"} -->

Implemented mobile-only Control Room URL persistence.

1. **Tab state:** The URL now uses `/?tab=queue`, `/?tab=active`, and `/?tab=done`; tab changes create browser-history entries.
2. **Scroll anchor:** Task rows now expose `#task-<card-id>` anchors. Scrolling updates the current history entry, and refresh restores the anchored task.
3. **Safety:** Invalid tab values fall back to `queue`, invalid anchors are discarded, and desktop routing is unchanged.
4. **Verification:** All `29` mobile tests passed, the frontend TypeScript check passed, and master-task validation passed.
5. **Commits:** Implementation commit `d49170e`; merge commit `20f7882`.

The implementation and verification subtasks are `done`. The master card remains `#task-active` because master completion was not explicitly authorized.
