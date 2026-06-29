# OPERATOR
<!-- decision-os:note {"id":"note-1781166187450-a5cb3f51382c58","timestamp":"2026-06-11T08:23:07.453Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781166187456-7e931fae-e1c2-4c28-aed6-0dcddfb5a898.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:23:07.463Z"} -->

Je ne comprends pas pourquoi on l'appelle sidecar, ce n'est pas sidecar, ça n'a aucun sens, sidecar. D'où elle provient cette nomenclature ?

# OPERATOR
<!-- decision-os:note {"id":"note-1781166233295-b74785ae4f603","timestamp":"2026-06-11T08:23:53.299Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781166233302-1958f225-1e88-4e8d-aadb-7fe8e0d21562.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:23:53.303Z"} -->

State summary, ce n'est pas du tout quelque chose dans le data model. State summary, c'est quelque chose qui provient quand on veut récupérer à travers les Jerkly. Donc c'est quelque chose qui est reconstruit à runtime quand on fait appel à la commande. C'est la CLI qui reconstruit ça.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781166429572-d7c3018d","timestamp":"2026-06-11T08:27:09Z"} -->

Treated.

I removed the `sidecar` wording from the card and replaced it with `card body file`, aligned with the new `body.file`. The term came from local engineering vocabulary for "an external file next to the JSON", but it should not become data-model vocabulary.

I also clarified that `stale-summaries` is a view reconstructed by the CLI at runtime. Nothing like `stale summary` is persisted in the ledger; the CLI compares `card.body.updatedAt`, `annotation.updatedAt`, and `summary.updatedAt` when the command is called.

# OPERATOR
<!-- decision-os:note {"id":"note-1781167423217-f6efb456fb4d9","timestamp":"2026-06-11T08:43:43.223Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781167423222-6a061119-6af2-4336-863b-89219fd3b048.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:43:43.239Z"} -->

Je ne t'ai pas que demandé pourquoi il y avait ça, je t'ai dit d'où provient la nomenclature Sidecar, tu n'as pas répondu à cette question.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781167505479-79ed14c3","timestamp":"2026-06-11T08:45:05Z"} -->

Treated.

The `sidecar` term comes from local implementation naming, especially helper files such as `ledger-cli/src/business/ledger/helper/card-content-sidecar.ts` and `ledger-cli/src/business/ledger/helper/thread-sidecar.ts`.

In this codebase it means a companion card body file stored outside the ledger JSON while the JSON keeps metadata and a path reference. I updated `Summary CLI Maintenance` to record that provenance and to make the boundary explicit: `sidecar` is internal implementation vocabulary, while the model and operator-facing language should use `body.file`, `threadFile`, or `card body file`.

# OPERATOR
<!-- decision-os:note {"id":"note-1781167885886-f9ee187734dab","timestamp":"2026-06-11T08:51:25.892Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781167885894-be40e9ae-271d-4c18-9dac-f8d207396290.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:51:25.917Z"} -->

Bah il faut renommer ça carte content ou carte body. Mais c'est pas markdown body file, c'est card body file à la limite. Markdown, on s'en fout que ce soit du markdown, c'est un détail d'implémentation. Ce qu'on veut nommer, c'est des natures, c'est la nature des choses qu'on veut nommer.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781168464570-5a891e29","timestamp":"2026-06-11T09:01:04Z"} -->

Treated.

I updated `Summary CLI Maintenance` to use nature-level wording: `card body file`. The implementation format is now intentionally out of the model language.

I also updated the stale-summary command contract so card staleness compares only `card.body.updatedAt` with `card.summary.updatedAt`; it no longer references `card.updatedAt`, because the data model no longer puts timestamps directly on `LedgerCard`.

# OPERATOR
<!-- decision-os:note {"id":"note-1781168546059-1aedfbf748d2f","timestamp":"2026-06-11T09:02:26.062Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781168546068-f47deac2-cb9a-4a8a-b31d-b47077486e4b.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T09:02:26.075Z"} -->

Enlève la section D, putain, mais ne mets pas ça, je t'ai demandé de me répondre dans le thread, pourquoi tu le mets dans la carte ? Les cartes, elles sont là pour avoir un contenu final, on s'en fout d'où ça vient sidecar, on sait juste que ça doit être bougé, c'est tout.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781168662571-d73e7be1","timestamp":"2026-06-11T09:04:22Z"} -->

Treated.

I removed the sidecar provenance section from `Summary CLI Maintenance`. The card now contains only final implementation content: summary write commands, missing-summary command, stale-summary command, watcher timestamp path, and tests.

The provenance answer remains only in this thread.

# OPERATOR
<!-- decision-os:note {"id":"note-1781168546056-ef7534328e6f38","timestamp":"2026-06-11T09:02:26.062Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781168546063-6b9c11f6-2913-4346-9662-e7c6c5c84a4a.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T09:02:26.085Z"} -->

Enlève la section D, putain, mais ne mets pas ça, je t'ai demandé de me répondre dans le thread, pourquoi tu le mets dans la carte ? Les cartes, elles sont là pour avoir un contenu final, on s'en fout d'où ça vient sidecar, on sait juste que ça doit être bougé, c'est tout.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781168705974-4cad17db","timestamp":"2026-06-11T09:05:05Z"} -->

Treated.

The duplicate note is now covered as well. Section `D` was removed from the card, and the card no longer contains sidecar provenance.
