# OPERATOR
<!-- corev2:note {"id":"note-1781161981713-37747fe09d2308","timestamp":"2026-06-11T07:13:01.722Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781161981724-fa3a7a30-7904-4529-a398-85c056855dcd.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T07:13:01.732Z"} -->

Ici, je veux une analyse de comment le data model, il est fait au niveau des zones et des cartes dans le ledger directement. Et en fait, l'objectif, c'est d'ajouter un système de résumé où le modèle, il est capable d'avec le ledger CLI d'aller poster un résumé sur une zone et sur une carte. Le résumé, c'est une, deux, trois phrases maximum, juste pour parler de ce qu'il y a en règle générale dans cette carte ou dans cette zone, de quoi ça traite. Je ne sais pas, fais-moi des propositions sur comment on pourrait structurer le résumé, quels sont les points importants qu'on veut voir dans un summary. Et donc le data model, voilà.

# AGENT
<!-- corev2:note {"id":"note-agent-1781162060453-a413d0c1","timestamp":"2026-06-11T07:14:20Z"} -->

Treated.

I replaced the placeholder card with a source-grounded analysis of the current card and zone ledger model.

The card now covers:

1. cards in `ledger.cards[]`;
2. zones in `ledger.annotations[]`;
3. card bodies in `comment.contentFile` sidecars;
4. geometry-based zone attribution;
5. proposed `summary?: string` fields on cards and zones;
6. one to three sentence summary rules;
7. `ledger-cli` update paths for writing card and zone summaries;
8. watcher context usage for zone summary and sibling card summaries.
