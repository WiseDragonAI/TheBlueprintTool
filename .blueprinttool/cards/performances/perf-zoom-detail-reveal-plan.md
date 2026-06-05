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
