# Low Detail Performance Post-Mortem

This post-mortem covers the low-detail zoom work that regressed normal-to-low unzoom performance, the failed hypotheses, the measurements that corrected the direction, and the final architectural simplification.

## Incident Summary

The user-visible failure was severe jank when unzooming from normal detail to low detail. The app could enter low detail but the frame rate was hammered during consecutive unzooms. Earlier explanations focused too much on accumulated counters and staged reveal scheduling, which obscured the frame-local problem the operator actually cared about.

The final measured root cause was not JavaScript doing large card loops on the normal-to-low path. It was a broad CSS rendering invalidation at the `.canvas.low-detail` edge. A single ancestor class flip changed many descendant styles at once, then Chrome paid style, raster, and commit costs while wheel transforms were still arriving.

## Timeline

1. Initial performance analysis over-weighted accumulated times.
2. The operator rejected accumulated totals as irrelevant because the only useful unit is frame-local time.
3. Staged reveal work improved `low-detail -> normal` but introduced confusion around scheduler scope and animation behavior.
4. The normal-to-low path remained slow during consecutive unzooms.
5. Measurements showed no reveal scheduler work on normal-to-low: no `data-detail-reveal` mutations, no staged class, and tiny JS dispatch/RAF times.
6. Chrome traces showed `ProxyMain::BeginMainFrame`, commit waits, style recalculation, and raster work as the actual slow frame cost.
7. The fix direction changed from more scheduling to simplifying the card rendering model.
8. Commit `02018a6 Simplify low detail card layer switching` removed the long tasks by shrinking the CSS edge.

## Bad Assumptions

### Accumulated Timing Was Misleading

Accumulated timing made small repeated costs look important and made real frame stalls harder to isolate. The operator was correct: accumulated counters are not useful for judging drag or zoom smoothness unless they are tied back to a frame window.

Correct frame-local questions:

```text
Which frame exceeded 16.7ms?
What code/event overlapped that frame?
Was the frame blocked by JS, style/layout, paint, raster, or commit?
Did the work happen during input or after input settled?
```

### The Scheduler Was Blamed Too Broadly

The staged reveal scheduler matters for `low-detail -> normal`, but it was not the measured offender for `normal -> low`.

Normal-to-low proof:

```text
data-detail-reveal mutations: 0
detail-reveal-staged active: false
JS wheel dispatch max: about 0.2ms
RAF callback duration max: about 0.2ms
telemetry: canvas-wheel, derive-gesture-intent, calculate-viewport-transform
```

That invalidated the idea that the normal-to-low regression was caused by a reveal queue doing extra card work.

### Moving Thresholds Was The Wrong Direction

Changing the threshold can make a benchmark look better by moving when the expensive transition occurs. It does not reduce the transition cost. This was correctly rejected because it changes the measurement condition instead of fixing the measured mechanism.

## Measured Failure

Route:

```text
http://127.0.0.1:4174/ses
56 cards
13 zones
```

Before the final simplification, corrected probes showed:

```text
normal -> low single edge:
  max frame: about 20ms
  long tasks: none

normal -> low burst, 6 unzooms:
  max frame: about 99.9ms
  long task: about 96ms

normal -> low burst repeat:
  max frame: about 116.7ms
  long tasks: about 104ms and 76ms

steady low-detail burst:
  max frame: about 17.9ms
  long tasks: none
```

Trace attribution for the bad burst:

```text
ProxyMain::BeginMainFrame: about 105ms
LayerTreeHost::WaitForCommitCompletion: about 103ms
Document::recalcStyle: about 25ms
raster tasks: 288
JS dispatch: about 0.2ms
RAF callback body: about 0.2ms
```

This proved the bottleneck was browser rendering work created by the mode edge, not application JavaScript loops.

## Root Cause

The runtime mode edge is small in TypeScript:

```text
frontend/src/runtime/canvas/effect/update-detail-mode.ts
  canvas.classList.toggle('low-detail', shouldUseLowDetail)
```

But the CSS blast radius was large. The ancestor class activated rules for:

```text
.canvas.low-detail .card
.canvas.low-detail .zone
.canvas.low-detail .ledger-card-detail-layer
.canvas.low-detail .card-actions
.canvas.low-detail .zone p
.canvas.low-detail .relationships text
.canvas.low-detail .ledger-card-overview-layer
.canvas.low-detail .ledger-card-overview-title
.canvas.low-detail .ledger-card-overview-status
.canvas.low-detail .relationships path
```

The costly part was not "hiding bodies" in isolation. It was switching from a rich card representation to a different overview representation while also changing descendant layout, wrapping, transforms, text shadows, content visibility, shadows, relationship styles, and viewport transforms in the same interaction burst.

Live fan-out on `/ses`:

```text
cards: 56
detail layers: 53
overview layers: 53
overview titles: 53
overview statuses: 53
zones: 13
relationship paths/text: 4 each
```

So Chrome had to restyle and reraster a broad subtree. Later low-detail frames were cheap because the expensive representation switch had already been paid.

## Final Fix Direction

The correct direction was architectural simplification:

1. Keep both card representations stable in the DOM.
2. Move overview title/status geometry into the base card object CSS.
3. Remove low-detail-only descendant layout rules.
4. Remove low-detail/staged `content-visibility: hidden`.
5. Remove low-detail/staged shadow and backdrop toggles.
6. Add stronger paint containment to card/detail layers.
7. Mark the two card layers as opacity-changing layers.

The low-detail edge now does much less:

```text
hide detail layer
show overview layer
keep overview child layout stable
keep card paint bounded
avoid waking a separate low-detail layout model at threshold time
```

Implemented by:

```text
02018a6 Simplify low detail card layer switching
```

Key files:

```text
frontend/assets/canvas/canvas-layer.css
frontend/assets/canvas/objects.css
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts
frontend/test/runtime/input-controller-routing.integration.test.ts
frontend/test/runtime/card-label-chips-style.integration.test.ts
```

## Result

After `02018a6`:

```text
normal -> low burst:
  max frame: 31.8ms
  long tasks: none

normal -> low burst repeat:
  max frame: 34.7ms
  long tasks: none

steady low-detail burst:
  max frame: 30.0ms
  long tasks: none
```

Compared to the bad state:

```text
normal -> low burst max frame:
  before: about 99.9ms to 116.7ms
  after:  about 31.8ms to 34.7ms

normal -> low long tasks:
  before: 96ms to 104ms
  after:  none
```

This is not perfect 60fps yet, but it removes the catastrophic failure mode. The remaining cost is still browser rendering, not JS.

## Verification

Automated checks:

```text
npm run typecheck:frontend
npm test --prefix frontend
```

Result:

```text
frontend tests: 192 passed
```

Visual checks:

```text
/tmp/corev2-normal-detail-check.png
/tmp/corev2-low-detail-check.png
```

Normal detail did not leak overview labels. Low detail still showed overview labels.

## Lessons

### Measure Frame-Local Work

Performance decisions must start from frame-local evidence. Aggregates can be recorded, but they are not the decision unit for drag or zoom jank.

Required report shape:

```text
interaction path
exact frame window
max frame duration
long tasks in that window
JS dispatch and RAF callback duration
style/layout/paint/raster/commit attribution
DOM mutation counts
source lines linked to the mechanism
```

### Do Not Fix A Rendering Architecture Problem With More Scheduling

Scheduling can protect a necessary expensive operation, but it is not a substitute for reducing the operation. Here, the final improvement came from reducing the CSS model complexity, not from adding another runtime coordinator.

### Keep Mode Edges Narrow

A mode edge should not reshape the entire descendant model. A mode edge should select between stable representations.

Bad shape:

```text
ancestor class changes many descendants' layout, paint, effects, transforms, and visibility
```

Better shape:

```text
stable detail layer
stable overview layer
cheap layer switch
bounded paint containment
```

### Avoid Benchmark Theater

Moving thresholds, changing the measured scale range, or reporting accumulated totals can make results look better without solving the operator-visible problem. Measurement must keep the user-visible path fixed.

## Follow-Up Direction

The catastrophic normal-to-low regression is addressed. Future performance work should continue the same simplification direction:

1. Further reduce CSS variable fan-out from `--viewport-scale` and `--inverse-viewport-scale`.
2. Keep hidden overview/detail layers from participating in unnecessary style work during steady zoom.
3. Continue replacing broad ancestor descendant selectors with stable layer semantics.
4. Apply the same frame-local measurement discipline to card drag and low-to-normal reveal.

Acceptance for future zoom work:

```text
normal -> low burst max frame <= 16.7ms on representative ledgers
no long task during threshold crossing
JS dispatch remains below 1ms
RAF callback body remains below 1ms
no broad descendant layout restyle introduced at mode edges
```
