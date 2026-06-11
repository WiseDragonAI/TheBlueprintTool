# OPERATOR
<!-- corev2:note {"id":"note-1781166187450-a5cb3f51382c58","timestamp":"2026-06-11T08:23:07.453Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781166187456-7e931fae-e1c2-4c28-aed6-0dcddfb5a898.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:23:07.463Z"} -->

Je ne comprends pas pourquoi on l'appelle sidecar, ce n'est pas sidecar, ça n'a aucun sens, sidecar. D'où elle provient cette nomenclature ?

# OPERATOR
<!-- corev2:note {"id":"note-1781166233295-b74785ae4f603","timestamp":"2026-06-11T08:23:53.299Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781166233302-1958f225-1e88-4e8d-aadb-7fe8e0d21562.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:23:53.303Z"} -->

State summary, ce n'est pas du tout quelque chose dans le data model. State summary, c'est quelque chose qui provient quand on veut récupérer à travers les Jerkly. Donc c'est quelque chose qui est reconstruit à runtime quand on fait appel à la commande. C'est la CLI qui reconstruit ça.

# AGENT
<!-- corev2:note {"id":"note-agent-1781166429572-d7c3018d","timestamp":"2026-06-11T08:27:09Z"} -->

Treated.

I removed the `sidecar` wording from the card and replaced it with `Markdown body file`, aligned with the new `body.file`. The term came from local engineering vocabulary for "an external file next to the JSON", but it should not become data-model vocabulary.

I also clarified that `stale-summaries` is a view reconstructed by the CLI at runtime. Nothing like `stale summary` is persisted in the ledger; the CLI compares `card.updatedAt`, `card.body.updatedAt`, `annotation.updatedAt`, and `summary.updatedAt` when the command is called.

# OPERATOR
<!-- corev2:note {"id":"note-1781167423217-f6efb456fb4d9","timestamp":"2026-06-11T08:43:43.223Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781167423222-6a061119-6af2-4336-863b-89219fd3b048.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:43:43.239Z"} -->

Je ne t'ai pas que demandé pourquoi il y avait ça, je t'ai dit d'où provient la nomenclature Sidecar, tu n'as pas répondu à cette question.

# AGENT
<!-- corev2:note {"id":"note-agent-1781167505479-79ed14c3","timestamp":"2026-06-11T08:45:05Z"} -->

Treated.

The `sidecar` term comes from local implementation naming, especially helper files such as `ledger-cli/src/business/ledger/helper/card-content-sidecar.ts` and `ledger-cli/src/business/ledger/helper/thread-sidecar.ts`.

In this codebase it means a companion Markdown file stored outside the ledger JSON while the JSON keeps metadata and a path reference. I updated `Summary CLI Maintenance` to record that provenance and to make the boundary explicit: `sidecar` is internal implementation vocabulary, while the model and operator-facing language should use `body.file`, `threadFile`, or `Markdown body file`.
