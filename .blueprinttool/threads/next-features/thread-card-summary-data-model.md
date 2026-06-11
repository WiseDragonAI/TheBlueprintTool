# OPERATOR
<!-- corev2:note {"id":"note-1781166068624-a71b8a962d4808","timestamp":"2026-06-11T08:21:08.630Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781166068634-e69127ba-b695-4320-a825-34fe6d817134.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:21:08.636Z"} -->

Et là, en fait, dans le modèle qu'on a, je ne comprends pas pourquoi on a un comment, content file et what. En fait, le what, je pense que c'est un vieux truc qui ne sert plus à rien. Et en fait, ce qu'il faudrait, c'est remplacer comment par body, il faudrait que ça s'appelle body. Il faudrait qu'il y ait file et ensuite, c'est created at, updated at. Et le summary, en fait, bah du coup, c'est un peu pareil, c'est-à-dire que le summary, il faut que ce soit dans un objet, le ledger summary, exactement comme tu l'as fait. ah oui, non, d'accord, mais c'est bon, le summary, c'est bon. C'est juste qu'il faut bouger le created at et le updated at. En fait, c'est le ledger card qu'il faut changer.

# AGENT
<!-- corev2:note {"id":"note-agent-1781166429572-75b15475","timestamp":"2026-06-11T08:27:09Z"} -->

Traité.

J'ai remplacé le contrat proposé `comment.contentFile` / `what` par `body.file`, avec `body.createdAt` et `body.updatedAt` pour la fraîcheur du fichier Markdown de la carte.

J'ai gardé `LedgerSummary` comme objet `text` + `updatedAt`, et j'ai précisé que `comment.contentFile`, `comment.what`, `comment.body` et `comment.description` sont seulement des entrées legacy de lecture/migration, pas des champs à écrire dans le nouveau modèle.
