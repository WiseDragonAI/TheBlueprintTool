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

# OPERATOR
<!-- corev2:note {"id":"note-1780643951234-1a2bdba1f74968","timestamp":"2026-06-05T07:19:11.239Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780643951239-c66aca7b-1aec-43bb-8d1e-45229a5c7cf7.wav","status":"transcribed","transcriptionStartedAt":"2026-06-05T07:19:11.267Z"} -->

Quand tu dis qu'il faudrait stage, ça voudrait dire qu'on voudrait faire les cartes petit à petit, c'est ça ? Pas toutes sur la même frame ?

# OPERATOR
<!-- corev2:note {"id":"note-1780643989309-b23330e6f790f","timestamp":"2026-06-05T07:19:49.312Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780643989314-0da1e61e-7a7a-488e-a044-03cda7bcfb73.wav","status":"transcribed","transcriptionStartedAt":"2026-06-05T07:19:49.316Z"} -->

Bah oui, c'est vrai aussi qu'on n'a pas besoin de révéler les cartes qui ne sont pas dans la window, on pourrait le faire après. Et en fait, ce que tu dis, c'est qu'on fait le zoom et une fois que le zoom il est settled et qu'il est terminé, là, on vient reveal les cartes petit à petit, les unes après les autres peut-être, une sur chaque frame.

# AGENT
<!-- corev2:note {"id":"note-agent-1780644047000-zoom-staged-reveal","timestamp":"2026-06-05T07:20:47Z"} -->

Yes. "Stage reveal" means: do not let crossing `0.35` make every `.ledger-card-detail-layer` render-relevant in the same frame.

The intended sequence is:

```text
wheel crosses 0.35 upward
  -> apply the zoom transform immediately
  -> keep most detail layers hidden for that crossing frame
  -> after zoom settles, compute visible and near-viewport cards
  -> reveal those details in small requestAnimationFrame chunks
  -> keep offscreen details hidden
  -> hydrate offscreen details later, during idle/background chunks
```

So yes, conceptually it is "cards progressively," but not necessarily exactly one card per frame. The scheduler should be budget-based, for example `1-4` cards or `<= 4ms` of reveal work per frame, then tuned from the trace. The important invariant is that offscreen cards do not join the urgent frame.

I updated the card with this concrete model. The key implementation distinction is:

```text
bad:
  remove .low-detail globally
  -> every detail layer wakes up together

target:
  leave zoom interaction cheaply
  -> visible/near-viewport cards reveal first
  -> offscreen details stay hidden until scheduled
```

This means the fix probably needs per-card detail readiness state, not only the current global `.canvas.low-detail` switch.

# OPERATOR
<!-- corev2:note {"id":"note-1780645588278-0033f27902503","timestamp":"2026-06-05T07:46:28.282Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780645588286-308fbb27-ac46-4e7b-8166-9c3fc67bb2df.wav","status":"transcribed","transcriptionStartedAt":"2026-06-05T07:46:28.288Z"} -->

Moi, j'aimerais bien mettre en place un système parce qu'en fait, en fonction du système de l'utilisateur, on va avoir des valeurs qui vont être différentes. Donc on ne veut pas hardcoder un nombre de cards. Par contre, ce qu'on veut faire, c'est qu'on veut faire un bench. Ça veut dire qu'il faut qu'on adapte le nombre de cards qu'on peut reveal en fonction des précédentes mesures qu'on a faites. Effectivement, il faut que ce soit en dessous de 4000 secondes. Donc ce qu'on peut faire, c'est on peut en reveal une par frame et on voit quel est le coût de ce reveal-là quand on fait une transition. Puis au prochain zoom, on pourra adapter le nombre par frame et en fait faire une quantité de cartes qui sont reveal adaptative en fonction des précédentes mesures. Et ça, ça me paraît être bien.

# OPERATOR
<!-- corev2:note {"id":"note-1780645668485-59873b2f1dfbd","timestamp":"2026-06-05T07:47:48.494Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780645668500-f5a08188-5c6a-4b21-9389-973c5531faac.wav","status":"transcribed","transcriptionStartedAt":"2026-06-05T07:47:48.524Z"} -->

Ensuite, il y a un autre truc. L'autre truc, c'est de dire que quand on est en full detail et qu'on commence à vouloir faire bouger une zone, et ben là, on se retrouve avec des repaint time. À mon avis, c'est le repaint time qui est extrêmement lourd. Je pense pas que ce soit un problème sur du JavaScript. Mais donc, c'est pareil, il faut que tu fasses aussi des analyses sur ça pour qu'on puisse comprendre le drag fix dans quelle direction on doit aller. Toi, tu dis qu'il ne faut pas rebuild chaque zone label sur chaque row pointer move, ouais. Mais pourquoi on le rebuild le zone label ? Pourquoi on ne le bouge pas simplement ? J'ai du mal à comprendre. Compute its tile during drag. Et donc, comment est-ce qu'on pourrait faire pour le drag pour l'améliorer ? Parce qu'effectivement, c'est un autre problème qu'il faut absolument qu'on arrive à résoudre, ça. J'ai l'impression que draguer une carte, ça va, c'est bien, mais effectivement, draguer une zone, c'est assez catastrophique. Donc quelles sont les meilleures directions ?

# OPERATOR
<!-- corev2:note {"id":"note-1780645716570-d77deafbb597","timestamp":"2026-06-05T07:48:36.575Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780645716579-5adb4ffd-7dfa-4650-8262-e10722e1bed1.wav","status":"transcribed","transcriptionStartedAt":"2026-06-05T07:48:36.584Z"} -->

Concernant le zoom, tu fais un plan pour l'instant, tu me mets un plan dans une autre carte pour savoir exactement comment tu vas modifier le code. Est-ce que tu vas modifier dans quelle direction on va avec ce nombre de cartes à render qui est adaptatif avec une mesure qui permet de savoir combien on en reveal à chaque fois et de faire évidemment le reveal de le delay après que le zoom est settled. Et de faire de pas reaviller toutes les cartes en même temps, mais de reveal en priorité les cartes qui sont autour de la zone visible, autour du milieu du viewport en fait.

# AGENT
<!-- corev2:note {"id":"note-agent-1780645889000-zoom-zone-plan-cards","timestamp":"2026-06-05T07:51:29Z"} -->

Treated.

I added a separate zoom implementation plan card:

```text
Zoom Detail Reveal Plan
.blueprinttool/cards/performances/perf-zoom-detail-reveal-plan.md
```

It specifies the direction you asked for:

- no hardcoded fixed card count;
- reveal delayed until zoom settles;
- initial conservative reveal can start at one card/frame;
- each reveal chunk measures its real cost;
- next chunk size adapts from the measured cost and a target budget;
- visible and near-viewport cards reveal first;
- ordering is by distance from the viewport center;
- offscreen card detail remains hidden until idle/background hydration or until the card approaches the viewport.

I also added a separate drag direction card for the zone-drag concern:

```text
Zone Drag Direction
.blueprinttool/cards/performances/perf-zone-drag-direction.md
```

Answer to the label question: yes, we should not rebuild all zone labels during drag. The current implementation rebuilds them because `renderZoneLabelOverlay()` is a global sync path: it calls `replaceChildren()`, queries every zone, reads offsets/style, and appends new proxy labels. That is the current simple implementation, not a requirement. The better drag path is to create stable label proxies and, during drag, move only the affected proxy from in-flight geometry.

For zone drag specifically, I documented that the repaint/commit hypothesis is plausible but still needs a dedicated zone-drag trace. Zone drag is different from card drag because selecting a zone also selects intersecting cards, so the current path can move the zone plus many cards with `left/top`, rebuild labels, and repaint a large gradient/shadow zone surface. The new card defines the trace variants and acceptance gates before we implement the zone drag fix.
