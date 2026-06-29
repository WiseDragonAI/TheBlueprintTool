# OPERATOR
<!-- decision-os:note {"id":"note-1780336423413-60ea0be4b8cf58","timestamp":"2026-06-01T17:53:43.419Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1780336423427-eebab2f8-9153-46d5-8b5d-415f76e4cd71.wav","status":"transcribed","transcriptionStartedAt":"2026-06-01T17:53:43.431Z"} -->

Voilà, fais un tableau pour me présenter la data, ne le fais pas dans un bloc de code, ce n'est pas lisible. En plus, c'est pareil, en fait, t'expliques pas les mécanismes. On ne comprend pas quels sont les mécanismes. Là, t'as une carte qui s'appelle Drag Move Cold Chain, qui est intéressante, mais on ne comprend pas qu'est-ce qui prend du temps. T'as pas fait de décomposition de la frame là-dedans. On a juste Spy, on a... Tu vois, t'as fait des worst during drag frame pour certaines cartes, mais on n'a pas la chain pour comprendre quel est le problème. Et du coup après, tu nous fais un structural refactor direction, mais euh le problème c'est que si tu n'expliques pas quel est le mécanisme, on ne peut pas valider que c'est bon. Il faut faire des mesures par fonction dans la cold chain pour comprendre exactement d'où vient le problème, sinon ce n'est pas possible.

# AGENT
<!-- decision-os:note {"id":"note-agent-20260601-175652-commit-raster","timestamp":"2026-06-01T17:56:52Z"} -->

Treated.

I replaced the raw data block in `Commit And Raster Mechanism` with a readable table, then added a `Mechanism / Why it matters` table.

I also expanded `Drag Move Call Chain` with a function/phase table: `handlePointerMove`, `moveSelected`, `renderZoneLabelOverlay`, `renderRelationshipOverlay`, `renderCanvasControlOverlay`, then browser commit/raster. The goal is to make explicit which part takes time in the JS event, which part triggers browser commit, and why the proposed structural direction is tied to the measured mechanism.

Finally, `Measurement Matrix` now contains a frame decomposition that connects the CDP numbers to the real phases: input event, DOM reads, overlays, relationship routing, commit, and raster/composite.
