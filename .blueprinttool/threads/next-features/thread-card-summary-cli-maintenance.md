# OPERATOR
<!-- corev2:note {"id":"note-1781166187450-a5cb3f51382c58","timestamp":"2026-06-11T08:23:07.453Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781166187456-7e931fae-e1c2-4c28-aed6-0dcddfb5a898.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:23:07.463Z"} -->

Je ne comprends pas pourquoi on l'appelle sidecar, ce n'est pas sidecar, ça n'a aucun sens, sidecar. D'où elle provient cette nomenclature ?

# OPERATOR
<!-- corev2:note {"id":"note-1781166233295-b74785ae4f603","timestamp":"2026-06-11T08:23:53.299Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781166233302-1958f225-1e88-4e8d-aadb-7fe8e0d21562.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T08:23:53.303Z"} -->

State summary, ce n'est pas du tout quelque chose dans le data model. State summary, c'est quelque chose qui provient quand on veut récupérer à travers les Jerkly. Donc c'est quelque chose qui est reconstruit à runtime quand on fait appel à la commande. C'est la CLI qui reconstruit ça.

# AGENT
<!-- corev2:note {"id":"note-agent-1781166429572-d7c3018d","timestamp":"2026-06-11T08:27:09Z"} -->

Traité.

J'ai retiré la nomenclature `sidecar` de la carte et remplacé ça par `Markdown body file`, aligné sur le nouveau `body.file`. Le terme venait du vocabulaire technique local pour dire "fichier externe à côté du JSON", mais il ne doit pas devenir le vocabulaire du data model.

J'ai aussi clarifié que `stale-summaries` est une vue reconstruite par la CLI à runtime. Rien de type `stale summary` n'est persisté dans le ledger; la CLI compare `card.updatedAt`, `card.body.updatedAt`, `annotation.updatedAt` et `summary.updatedAt` au moment où la commande est appelée.
