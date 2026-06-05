# OPERATOR
<!-- corev2:note {"id":"note-1780642617982-d47d16fbbd713","timestamp":"2026-06-05T06:56:57.987Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780642617992-a5d9f0fd-cf27-42c0-b0e7-0e9e1852b02d.wav","status":"transcribed","transcriptionStartedAt":"2026-06-05T06:56:58.001Z"} -->

Non, ça ne va pas vraiment, parce que là, dans tes mécanismes, il n'y a pas de décomposition de la frame. Là, tu dis juste, je vois une seule colonne de mesures de temps de frame, et il n'y a absolument pas de décomposition sur l'ensemble du chemin du pointer move. Il faudrait que chaque fonction, chaque sous-fonction, elle soit mesurée dans la frame et qu'on puisse être capable de recomposer le temps total de la frame avec une précision très importante pour être sûr exactement d'où vient le problème. Là, aujourd'hui, t'as que des espèces de… Il n'y a pas de preuve, en fait. Il n'y a absolument aucune preuve dans ton mécanisme. Les seules preuves que t'as, c'est en désactivant avec des feature flags et en remeurant la frame totale, mais ce n'est pas du tout du bon travail de faire ça.

# AGENT
<!-- corev2:note {"id":"note-agent-1780643112000-frame-decomposition","timestamp":"2026-06-05T07:05:12Z"} -->

Treated. The criticism was correct: A/B frame totals alone were not enough proof.

I added source-level drag spans and reran the trace. The verifier now records nested timings for the real pointermove path and overlays them onto the same frame window:

```text
source hook: frontend/src/runtime/performance/drag-trace-span.ts
trace harness: tools/live-verify/card-drag-trace-suite.mjs
trace output: /tmp/corev2-drag-frame-decomposition-rerun
raw report: /tmp/corev2-drag-frame-decomposition-rerun/prep_development_cheat_menu_ae913a0a-scale0_35-baseline-cold-run1.report.json
```

The new proof card now includes a recomposable pointermove breakdown:

```text
pointermove#2
handlePointerMove: 17.9ms
  moveSelected: 17.7ms
    moveSelectedLedgerGeometry: 0.7ms
      patchNodePosition:card: 0.3ms
    renderZoneLabelOverlay: 16.5ms
      readLayoutAndStyle: 13.8ms exclusive, 22 calls
      replaceChildren: 1.1ms
      appendLabel: 1.1ms exclusive, 22 calls
```

And it ties that same app span to the bad visible frame:

```text
frame #13 during drag: 52.0ms
EventDispatch:pointermove: 18.224ms
ProxyMain::BeginMainFrame: 30.839ms
LayerTreeHost::WaitForCommitCompletion: 29.770ms
renderZoneLabelOverlay:readLayoutAndStyle: 13.8ms exclusive in the frame
```

The mechanism is now backed by source spans, DOM read probes, and Chrome frame overlap, not just feature-flag deltas.
