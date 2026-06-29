# OPERATOR
<!-- decision-os:note {"id":"note-1780336686148-89d798137e7778","timestamp":"2026-06-01T17:58:06.151Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1780336686152-f9907d6e-d72f-4cc0-8ede-477dd2554c19.wav","status":"transcribed","transcriptionStartedAt":"2026-06-01T17:58:06.154Z"} -->

Il n'y a pas de frame décomposition en fait. Là, t'as fait une décomposition logique, s'il n'y a pas de temps associé à chaque slice, ce n'est pas une décomposition. C'est juste une explication.

# AGENT
<!-- decision-os:note {"id":"note-agent-20260601-180203-measurement-matrix-frame-decomposition","timestamp":"2026-06-01T18:02:03Z"} -->

Treated.

You were right: the previous table was a logical phase explanation, not a measured frame decomposition.

I updated `Measurement Matrix` with measured timings from the fresh CDP drag trace:

| Scope | Added measured value |
| --- | ---: |
| Input bucket | 604.771ms total / 43.620ms max |
| Pointermove dispatch | 102.937ms total / 11.948ms max |
| Pointermove DOM reads | 576 `offsetLeft` reads |
| Worst during-drag frame | 29.1ms |
| During-drag input overlap | 11.948ms |
| During-drag `ProxyMain::BeginMainFrame` overlap | 12.093ms |
| Worst after-release frame | 844.4ms |
| After-release `Document::UpdateStyleAndLayout` | 212.921ms |
| After-release `Blink.Style.UpdateTime` | 152.570ms |

The card now distinguishes measured time slices from interpretation.
