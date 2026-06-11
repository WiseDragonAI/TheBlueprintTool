# OPERATOR
<!-- corev2:note {"id":"note-1781166068624-a71b8a962d4808","timestamp":"2026-06-11T08:21:08.630Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781166068634-e69127ba-b695-4320-a825-34fe6d817134.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:21:08.636Z"} -->

Et là, en fait, dans le modèle qu'on a, je ne comprends pas pourquoi on a un comment, content file et what. En fait, le what, je pense que c'est un vieux truc qui ne sert plus à rien. Et en fait, ce qu'il faudrait, c'est remplacer comment par body, il faudrait que ça s'appelle body. Il faudrait qu'il y ait file et ensuite, c'est created at, updated at. Et le summary, en fait, bah du coup, c'est un peu pareil, c'est-à-dire que le summary, il faut que ce soit dans un objet, le ledger summary, exactement comme tu l'as fait. ah oui, non, d'accord, mais c'est bon, le summary, c'est bon. C'est juste qu'il faut bouger le created at et le updated at. En fait, c'est le ledger card qu'il faut changer.

# AGENT
<!-- corev2:note {"id":"note-agent-1781166429572-75b15475","timestamp":"2026-06-11T08:27:09Z"} -->

Treated.

I replaced the proposed `comment.contentFile` / `what` contract with `body.file`, with `body.updatedAt` for freshness of the card body file.

I kept `LedgerSummary` as a `text` + `updatedAt` object, and clarified that `comment.contentFile`, `comment.what`, `comment.body`, and `comment.description` are only legacy read/migration inputs, not fields to write in the new model.

# OPERATOR
<!-- corev2:note {"id":"note-1781167973587-a58632c2b097f","timestamp":"2026-06-11T08:52:53.591Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781167973593-08fc9fcd-989c-4b03-b941-121309c0d21f.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:52:53.602Z"} -->

C'est quoi le card type string dans LedgerCard ? Je ne comprends pas bien ce que c'est.

# OPERATOR
<!-- corev2:note {"id":"note-1781167994051-1bc9e9207400b","timestamp":"2026-06-11T08:53:14.054Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781167994056-5fade401-2438-4900-a43f-3d47639d9669.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:53:14.058Z"} -->

Là, le Ledger body, étant donné qu'il a le updated hat déjà, déjà on peut enlever le creative hat, ça ne sert à rien. Je ne vois pas pourquoi on garderait le creative hat et le updated hat sur le Ledger card, ça n'a pas trop de sens.

# AGENT
<!-- corev2:note {"id":"note-agent-1781168464570-57ae0898","timestamp":"2026-06-11T09:01:04Z"} -->

Treated.

I updated `Summary Data Model` so `LedgerBody` keeps only `file` and `updatedAt`; `body.createdAt` is removed.

I also removed `createdAt` and `updatedAt` from `LedgerCard`. Card summary staleness now compares `card.body.updatedAt` to `card.summary.updatedAt`, while zone summary staleness still uses `annotation.updatedAt` against `annotation.summary.updatedAt`.

For `cardType?: string`: I added an explanation that it is the current loose ledger classification string used by existing ledgers and exports. Current values include `note`, `spec-brief`, `base-class`, `perf-analysis`, and `perf-plan`; it is display/workflow kind metadata, not freshness data.
