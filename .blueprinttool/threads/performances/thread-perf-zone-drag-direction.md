# OPERATOR
<!-- corev2:note {"id":"note-1780648453318-10c38e5896b758","timestamp":"2026-06-05T08:34:13.324Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1780648453331-3c24a918-6e9b-4f47-b731-df55221d26fc.wav","status":"transcribed","transcriptionStartedAt":"2026-06-05T08:34:13.338Z"} -->

OK, tu peux exécuter le fix autour du zoom et tu penseras bien à faire des mesures avant et après plusieurs fois et d'évaluer en fait comment le threshold du nombre de cartes il évolue au fur et à mesure du temps et tu fais bien des zooms et des dézooms sur des zones différentes du hardaria game design ledger qui est très très dense et très velu.

# AGENT
<!-- corev2:note {"id":"note-agent-1780649593564-a8d4c2f1","timestamp":"2026-06-05T08:53:08Z"} -->

Fix exécuté et mesuré.

Ce qui a changé:

- `updateDetailMode()` ne réveille plus tous les détails au passage `0.34 -> 0.365`. Il entre en `detail-reveal-staged`, retire `low-detail`, puis attend 120ms de stabilité avant de révéler.
- Les cartes visibles/proches sont classées par distance au centre viewport, révélées en chunks adaptatifs avec budget 4ms, puis les cartes hors champ passent en idle/background.
- Le grid honeycomb est supprimé de façon stable sous `scale < 0.45`. J'ai invalidé la version temporaire `is-zooming`: elle ne faisait que déplacer le coût vers la frame de restauration du grid.
- Le trace tool accepte maintenant plusieurs zones et plusieurs runs, et logge `visibleCards`, `urgentCards`, `backgroundCards`, `revealed`, `durationMs`, `nextChunkSize`.

Preuve avant/après:

```text
Avant, fixed viewport, low-to-normal 0.34 -> 0.365:
  worst frame 117.4ms
  raster-composite max 117.3ms
  style-layout max 75.0ms

Après, low-to-normal, 3 runs par zone:
  fixed:  median worst 32.1ms, reveal max chunk 0.3ms
  mining: median worst 60.2ms, reveal max chunk 0.3ms
  runes:  median worst 50.1ms, reveal max chunk 0.3ms
  ui:     median worst 43.1ms, reveal max chunk 0.4ms

Après, normal-to-low, 3 runs par zone:
  fixed:  median worst 33.7ms, reveal none
  mining: median worst 43.1ms, reveal none
  runes:  median worst 37.8ms, reveal none
  ui:     median worst 41.0ms, reveal none
```

Evolution du threshold / nombre de cartes:

```text
fixed low-to-normal:  visible=0 urgent=5  background=102 frames=28 maxRevealChunk=0.3ms
mining low-to-normal: visible=8 urgent=27 background=80  frames=25 maxRevealChunk=0.3ms
runes low-to-normal:  visible=6 urgent=19 background=88  frames=26 maxRevealChunk=0.3ms
ui low-to-normal:     visible=8 urgent=25 background=82  frames=25 maxRevealChunk=0.4ms
```

Conclusion technique:

- Validé: le réveil global des `.ledger-card-detail-layer` n'est plus le coût dominant. Le reveal réel reste sous 0.4ms/chunk dans les runs.
- Validé: le grid est un vrai offender dans les zones denses. A/B staged: `no-grid` fait tomber Mining `239.3ms -> 51.2ms` et UI `155.5ms -> 47.5ms`.
- Invalidé: masquer le grid uniquement pendant un timer de zoom. La restauration recrée une grosse frame raster.
- Restant: les frames 30-60ms viennent encore surtout de compositor/raster commit et style/layout global (`ProxyMain::BeginMainFrame`, `LayerTreeHost::WaitForCommitCompletion`, `WebFrameWidgetImpl::UpdateLifecycle`), pas du code de reveal.

J'ai aussi mis les détails durables dans la carte `perf-zoom-detail-reveal-plan`.
