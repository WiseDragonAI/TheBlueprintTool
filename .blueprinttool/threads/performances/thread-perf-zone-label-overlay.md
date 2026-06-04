# OPERATOR
<!-- corev2:note {"id":"note-1780335741872-64c2a67a9b8af8","timestamp":"2026-06-01T17:42:21.878Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780335741884-4d748fa8-c082-4c85-a1e2-72a229f67e46.wav","status":"transcribed","transcriptionStartedAt":"2026-06-01T17:52:22.090Z"} -->

si je comprends bien, on fait, il y a plusieurs éléments qui font des DOM read à chaque frame, c'est ça ? Pendant qu'on fait un pan ou qu'on fait un zoom. Alors qu'en fait, on pourrait très bien faire un système où on vient, si je comprends bien, c'est toujours la même chose en plus, le title, l'offset du title, l'offset du… En fait, c'est toujours la même chose, c'est-à-dire que à scale 1, on sait qu'il doit être de X pixels, et donc après, il suffirait de modifier par le zoom level, de multiplier par le zoom level, non ? J'ai du mal à comprendre avec ton… c'est pas trop une explication ce que tu fais. C'est un peu une conclusion où tu cites des choses, mais c'est pas assez explicatif.

# AGENT
<!-- corev2:note {"id":"note-agent-20260601-175652-zone-label-overlay","timestamp":"2026-06-01T17:56:52Z"} -->

Traité.

J'ai complété la carte `Zone Label Overlay Reads` avec une explication mécanistique: quels `offset*` / `getComputedStyle` sont lus, pourquoi ils sont lus aujourd'hui, et par quoi ils doivent être remplacés.

La réponse courte: oui, l'intuition est correcte. Pour le pan/zoom, les rectangles canvas des zones/cartes ne changent pas. On devrait projeter la géométrie ledger par `viewport.x/y/scale`, pas redécouvrir les offsets via le DOM. Les DOM reads ne devraient revenir que sur invalidation réelle: edit du label, changement de font/style, resize/move de zone, ou changement de géométrie carte/zone.

# OPERATOR
<!-- corev2:note {"id":"note-1780336636492-4bf0c434fa3f3","timestamp":"2026-06-01T17:57:16.496Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780336636498-8898f775-8ad0-451d-ae10-123ba370952c.wav","status":"transcribed","transcriptionStartedAt":"2026-06-01T17:57:16.499Z"} -->

Et tu me parles en anglais, jamais en français.

# AGENT
<!-- corev2:note {"id":"note-agent-20260601-180020-zone-language","timestamp":"2026-06-01T18:00:20Z"} -->

Acknowledged. I will answer these performance ledger notes in English only.
