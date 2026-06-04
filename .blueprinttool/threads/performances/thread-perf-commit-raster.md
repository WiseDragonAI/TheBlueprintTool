# OPERATOR
<!-- corev2:note {"id":"note-1780336423413-60ea0be4b8cf58","timestamp":"2026-06-01T17:53:43.419Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780336423427-eebab2f8-9153-46d5-8b5d-415f76e4cd71.wav","status":"transcribed","transcriptionStartedAt":"2026-06-01T17:53:43.431Z"} -->

Voilà, fais un tableau pour me présenter la data, ne le fais pas dans un bloc de code, ce n'est pas lisible. En plus, c'est pareil, en fait, t'expliques pas les mécanismes. On ne comprend pas quels sont les mécanismes. Là, t'as une carte qui s'appelle Drag Move Cold Chain, qui est intéressante, mais on ne comprend pas qu'est-ce qui prend du temps. T'as pas fait de décomposition de la frame là-dedans. On a juste Spy, on a... Tu vois, t'as fait des worst during drag frame pour certaines cartes, mais on n'a pas la chain pour comprendre quel est le problème. Et du coup après, tu nous fais un structural refactor direction, mais euh le problème c'est que si tu n'expliques pas quel est le mécanisme, on ne peut pas valider que c'est bon. Il faut faire des mesures par fonction dans la cold chain pour comprendre exactement d'où vient le problème, sinon ce n'est pas possible.

# AGENT
<!-- corev2:note {"id":"note-agent-20260601-175652-commit-raster","timestamp":"2026-06-01T17:56:52Z"} -->

Traité.

J'ai remplacé le bloc de données brut de `Commit And Raster Mechanism` par un tableau lisible, puis ajouté une table `Mechanism / Why it matters`.

J'ai aussi complété `Drag Move Call Chain` avec une table par fonction / phase: `handlePointerMove`, `moveSelected`, `renderZoneLabelOverlay`, `renderRelationshipOverlay`, `renderCanvasControlOverlay`, puis browser commit/raster. Le but est de rendre explicite quelle partie prend du temps dans l'event JS, quelle partie déclenche le commit navigateur, et pourquoi la direction structurelle proposée est bien liée au mécanisme mesuré.

Enfin, `Measurement Matrix` contient maintenant une décomposition de frame qui relie les chiffres CDP aux phases réelles: input event, DOM reads, overlays, relationship routing, commit et raster/composite.
