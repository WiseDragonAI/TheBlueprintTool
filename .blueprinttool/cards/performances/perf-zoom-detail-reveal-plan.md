# Zoom Detail Reveal Implementation Plan

Goal: fix `low-detail -> normal detail` zoom jank without hardcoding a fixed number of cards per frame.

The implementation direction is adaptive staged reveal:

```text
cross 0.35 upward
  -> apply viewport transform immediately
  -> do not reveal every .ledger-card-detail-layer in that frame
  -> wait until zoom settles
  -> rank visible/near-viewport cards by viewport-center distance
  -> reveal a measured chunk
  -> update the next chunk size from observed reveal cost
  -> hydrate offscreen cards later or only when they approach viewport
```

## Code Touch Points

Current source facts:

- `frontend/src/runtime/gesture/controller/handle-wheel.ts:48-57` updates `state.viewport.scale`, `x`, and `y` on wheel zoom.
- `frontend/src/runtime/canvas/effect/apply-viewport-transform.ts:7-14` calls `updateDetailMode()` before applying `.canvas-content` transform.
- `frontend/src/runtime/canvas/effect/update-detail-mode.ts:9-15` toggles `.low-detail` globally at `scale < 0.35`.
- `frontend/assets/canvas/canvas-layer.css:156-167` makes `.canvas.low-detail .ledger-card-detail-layer` hidden and `content-visibility: hidden`.
- `frontend/src/runtime/card/helper/visible-ledger-cards.ts:10-36` already has viewport-world bounds and card intersection helpers.

Planned code shape:

```text
updateDetailMode()
  -> detect upward crossing: previous low-detail true, next low-detail false
  -> enter staged detail reveal mode instead of immediately waking all detail layers

scheduleDetailRevealAfterZoomSettles()
  -> debounce on wheel activity
  -> cancel/restart if another wheel/pan arrives

rankDetailRevealCandidates()
  -> compute viewportWorldBounds(state.viewport, canvas size)
  -> include visible cards plus a near-viewport margin
  -> sort by distance from viewport center
  -> keep offscreen cards hidden unless idle budget is available

runAdaptiveRevealFrame()
  -> reveal current chunk
  -> measure elapsed time with performance.now()
  -> update moving average cost per card
  -> choose next chunk size from target frame budget
```

## State Model

The current global class is not enough:

```text
.canvas.low-detail removed
  -> all detail layers become render-relevant together
```

Target state needs per-card reveal readiness:

```text
data-detail-reveal="hidden|queued|visible"
```

Possible CSS contract:

```css
.card[data-detail-reveal="hidden"] .ledger-card-detail-layer {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  content-visibility: hidden;
}

.card[data-detail-reveal="visible"] .ledger-card-detail-layer {
  visibility: visible;
  opacity: 1;
}
```

The exact selector can change, but the invariant cannot: offscreen card detail must not become render-relevant in the threshold-crossing frame.

## Adaptive Budget

Do not hardcode "N cards per frame" as a constant.

Use an adaptive budget:

```text
targetRevealBudgetMs = 4
initialChunkSize = 1
measuredCostPerCard = lastRevealDurationMs / revealedCardCount
nextChunkSize = clamp(1, maxChunk, floor(targetRevealBudgetMs / measuredCostPerCard))
```

Use a small moving average so one bad frame does not overcorrect:

```text
avgCost = avgCost ? avgCost * 0.75 + currentCost * 0.25 : currentCost
```

The operator note said "4000 seconds"; the technical target is interpreted as `<= 4ms` of reveal work per frame, not seconds.

## Reveal Priority

Priority order:

1. Cards intersecting the current viewport.
2. Cards within a near-viewport margin.
3. Among those, cards closest to the viewport center first.
4. Offscreen cards later, either in idle time or when they become near-viewport.

Distance key:

```text
card center -> viewport center
```

This matches the operator intent: reveal around the visible zone and viewport middle first.

## Cancellation Rules

The reveal scheduler must stop or restart when:

- another wheel zoom event arrives;
- pan starts or viewport changes materially;
- active tab/ledger changes;
- the canvas goes back below `0.35`.

Otherwise background reveal work can create the same jank during continued interaction.

## Verification

Required trace comparison:

```text
baseline low-to-normal transition
no-detail-layer A/B
staged-reveal implementation
```

Acceptance:

```text
0.34 -> 0.365 transition has no single global detail reveal frame
worst crossing frame < 16.7ms, or no blocking frame above the accepted staged budget
visible/near-viewport details become visible first
offscreen details remain hidden during the crossing frame
reveals are chunked by measured cost, not fixed card count
trace logs chunk size, revealed card count, reveal duration, and next budget decision
```

## Implemented Result

Implemented in code:

- `frontend/src/runtime/canvas/effect/update-detail-mode.ts:10-22` now detects `scale < 0.35`, starts staged detail reveal only on upward crossing, cancels it when returning below the threshold, and suppresses the grid while `scale < 0.45`.
- `frontend/src/runtime/canvas/effect/stage-detail-reveal.ts:55-83` ranks visible and near-viewport cards from viewport-world bounds without DOM layout reads.
- `frontend/src/runtime/canvas/effect/stage-detail-reveal.ts:114-145` reveals visible/near cards in `requestAnimationFrame` chunks with a 4ms adaptive budget.
- `frontend/src/runtime/canvas/effect/stage-detail-reveal.ts:148-176` reveals background cards through idle callbacks or delayed timers.
- `frontend/src/runtime/canvas/effect/stage-detail-reveal.ts:130-139` and `:213-220` emit telemetry for queue size, revealed count, reveal duration, remaining cards, average card cost, and next chunk size.
- `frontend/assets/canvas/canvas-layer.css:169-198` keeps staged hidden cards on the overview layer and keeps their detail layer `content-visibility: hidden`.
- `frontend/assets/canvas/canvas-layer.css:303-305` hides the honeycomb grid below the detail-transition scale. The A/B proof showed temporary hide/show of the grid was invalid because the restore frame reintroduced the expensive raster commit.

Trace harness updates:

- `tools/live-verify/zoom-detail-transition-trace.mjs:48-59` accepts named world/viewport targets.
- `tools/live-verify/zoom-detail-transition-trace.mjs:177-201` summarizes reveal queue evolution and chunk durations.
- `tools/live-verify/zoom-detail-transition-trace.mjs:316-375` supports repeated runs per case/target and persists each CDP trace/report.

## Measurement Proof

Baseline before the fix, from `/tmp/corev2-real-offenders-zoom-detail-combo/suite-summary.json`:

```text
fixed low-to-normal 0.34 -> 0.365:
  worst frame 117.4ms
  raster-composite max 117.3ms
  style-layout max 75.0ms

fixed normal-to-low 0.365 -> 0.34:
  worst frame 31.5ms
  raster-composite max 31.5ms
  style-layout max 27.0ms
```

After staged reveal and scale-stable grid suppression:

```text
/tmp/corev2-zoom-detail-final-after
low-to-normal 0.34 -> 0.365, 3 runs per target:
  fixed:  median worst 32.1ms, reveal max chunk 0.3ms
  mining: median worst 60.2ms, reveal max chunk 0.3ms
  runes:  median worst 50.1ms, reveal max chunk 0.3ms
  ui:     median worst 43.1ms, reveal max chunk 0.4ms

/tmp/corev2-zoom-detail-final-normal-to-low-after
normal-to-low 0.365 -> 0.34, 3 runs per target:
  fixed:  median worst 33.7ms, reveal none
  mining: median worst 43.1ms, reveal none
  runes:  median worst 37.8ms, reveal none
  ui:     median worst 41.0ms, reveal none
```

The card-count threshold now evolves from measured queue data instead of a fixed number:

```text
fixed low-to-normal:
  visible=0 urgent=5 background=102 frames=28 maxRevealChunk=0.3ms

mining low-to-normal:
  visible=8 urgent=27 background=80 frames=25 maxRevealChunk=0.3ms

runes low-to-normal:
  visible=6 urgent=19 background=88 frames=26 maxRevealChunk=0.3ms

ui low-to-normal:
  visible=8 urgent=25 background=82 frames=25 maxRevealChunk=0.4ms
```

Validation and invalidation:

- Validated: the old global detail-layer wake-up is no longer the dominant `low-detail -> normal` mechanism. Reveal chunks stay under 0.4ms in the measured dense ledgers, so the staged reveal code is not the remaining long-frame source.
- Validated: permanent/scale-stable grid suppression matters. In the staged A/B run, `no-grid` reduced Mining low-to-normal worst frame from 239.3ms to 51.2ms and UI from 155.5ms to 47.5ms.
- Invalidated: hiding the grid only during an `is-zooming` settle window. That moved the expensive work to the grid restore frame and produced 180ms+ raster frames, so the final implementation does not use a temporary restore timer.
- Remaining offender: dense-region zoom still has 30-60ms worst frames. The trace groups point at compositor/raster commit (`ProxyMain::BeginMainFrame`, `LayerTreeHost::WaitForCommitCompletion`, `WebFrameWidgetImpl::UpdateLifecycle`) plus style/layout on the global class transition, not at reveal-chunk script.
