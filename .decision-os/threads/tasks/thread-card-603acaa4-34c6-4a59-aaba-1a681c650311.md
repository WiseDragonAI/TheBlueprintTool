# OPERATOR
<!-- decision-os:note {"id":"note-1784287086387-42249881da36a","timestamp":"2026-07-17T11:18:06.419Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784287086415-ccd1b89b-fe6a-4133-932c-b82631189f84.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T11:18:06.422Z"} -->

Quand j'ouvre une tâche, le scroll du thread ou du codex log, il devrait par défaut être à la fin, en plus de ça, il devrait être en mode follow. Donc ça veut dire que quand j'envoie un message vocal, ça doit follow et ça doit scroll down. Quand la transcription elle est finie, c'est pareil, ça doit scroll down. Et la seule raison pour laquelle on n'est pas en mode follow, c'est si jamais on a fait un scroll up et ça fait qu'on arrête d'être stick to bottom. Mais quand on reclique sur la flèche, c'est censé nous remettre en mode stick to bottom. Et cet état-là est perdu. Ça a été régressé puisque ça fonctionnait à un moment donné et là, ça ne fonctionne plus.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784287384721-9d59602e-71e","timestamp":"2026-07-17T11:23:04.721Z"} -->

Treated as a frontend interaction regression and converted into the **Restore Thread and Codex Log Follow-Bottom** zone.

1. **Verified conversation cause:** missing follow entries resolve to `false`, while saved scroll positions prevent task opening from pinning to the newest note.
2. **Verified live-update path:** optimistic voice insertion and completed transcription already rerender the active thread, so the corrected follow state can keep both transitions visible.
3. **Verified Codex gap:** `renderThreadCodexLog()` uses only an eight-pixel pre-render heuristic and has no explicit per-surface follow re-entry state.
4. **Plan:** four relationship-backed subtasks cover conversation behavior, independent Codex Log behavior, automated regression coverage, and served browser verification.
5. **Readiness:** `READY_FOR_TASK_DEPENDENCY`. Implementation has not started, all subtasks remain `todo`, and the master task remains open.

# OPERATOR
<!-- decision-os:note {"id":"note-1784292338135-e6dcafdb81d358","timestamp":"2026-07-17T12:45:38.173Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784292338169-8db23e47-3449-4c8d-ace6-76c96fa9880d.wav","status":"transcribed","transcriptionStartedAt":"2026-07-17T12:45:38.195Z"} -->

Bon, il y a deux tâches qui ont été créées pour ça, je veux que tu trouves l'autre tâche, que tu rapatries ce qui doit être rapatrié ici, que tu la fermes, enfin que tu la supprimes carrément, et que tu refasses une analyse pour être sûr qu'il n'y a pas de truc qui manque, et ensuite tu exécutes directement, n'attends pas. Je veux que ce soit exécuté aussi vite que possible, j'en peux plus là.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784294275982-1878233d-c68","timestamp":"2026-07-17T13:17:55.982Z"} -->

Consolidated the duplicate task into this master and removed the duplicate master plus its four subtasks. Implemented persistent, independent follow-bottom state for Thread and Codex Log, including the reload offset guard found during served verification. Focused checks, typecheck, all 460 frontend tests, and the served browser interaction scenario pass. The implementation is committed and all four subtasks are verified; the master remains open.

# OPERATOR
<!-- decision-os:note {"id":"note-1784437258463-35327e070e0d28","timestamp":"2026-07-19T05:00:58.537Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784437258535-29e8785c-5fb0-4366-af16-acfa4a4b05fd.wav","status":"transcribed","transcriptionStartedAt":"2026-07-19T05:00:58.551Z"} -->

Par défaut, ce qu'il faut absolument, c'est que le thread et le codex log, ils soient au bottom. S'il n'y a pas d'information qu'on stick to bottom, par défaut, c'est stick to bottom.

# OPERATOR
<!-- decision-os:note {"id":"note-1784439114559-9c4ed05d37ac38","timestamp":"2026-07-19T05:31:54.564Z"} -->

Par défaut, ce qu'il faut absolument, c'est que le thread et le codex log, ils soient au bottom. S'il n'y a pas d'information qu'on stick to bottom, par défaut, c'est stick to bottom.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784439156335-56d9e36f","timestamp":"2026-07-19T05:32:36.335Z"} -->

Confirmed and enforced: for both Thread and Codex Log, an absent follow record means follow-bottom is active and the viewport opens at its bottom. Only an explicit persisted false value from an upward operator scroll disables follow for that surface. Added the symmetric unseen-Codex-Log regression assertion; all 23 focused thread runtime tests pass. Commit: 91c09fd1, merged by b0269b32.
