# Canvas pan/zoom performance study - 2026-05-29

## Scope

Investigate why pan and zoom degrade when a ledger has many cards, including the case where the cards have no relationships.

Primary workspace sampled:

- `/home/jbb/dev/MOH/.blueprinttool/ses.json`: 25 ledger cards, 0 ledger relationships, 8 annotations, image references.
- `/home/jbb/dev/MOH/.blueprinttool/s3.json`: 21 ledger cards, 20 ledger relationships, 1 annotation.

The live browser sample was collected from `http://127.0.0.1:4174/ses` with a headless Chromium CDP session. Treat the numbers as directional, not final device-grade paint/compositor metrics, because headless Chromium is not the same as the operator's interactive browser GPU path.

## Correction after burst testing

The first sample understated the user-visible lag because it measured isolated synthetic events with frame waits between them. That is not representative of wheel/trackpad zoom. A real wheel burst can queue many events before the browser has painted the previous updates.

Corrected burst sample on the same MOH workspace:

- `ses`, 80 wheel zoom-out events: `2395 ms` synchronous event handling.
- `ses`, 80 wheel zoom-out events: average `30 ms`, p95 `40 ms`, max `50 ms` per event.
- `s3`, 80 wheel zoom-out events: `1172 ms` synchronous event handling.
- `s3`, 80 wheel zoom-out events: average `15 ms`, p95 `19 ms`, max `20 ms` per event.

This matches the reported "hundreds of ms" feel. The relevant metric is cumulative queued input work, not a single p95 event.

The deeper split points to a read/write layout feedback loop and zoom-detail CSS invalidation:

- `ses`, 80 low-detail `applyViewportTransform()` calls: `1253 ms`.
- `ses`, 80 low-detail `applyViewportTransform()` calls plus `canvas.getBoundingClientRect()` after each write: `2975 ms`.
- `s3`, 80 low-detail `applyViewportTransform()` calls: `538 ms`.
- `s3`, 80 low-detail `applyViewportTransform()` calls plus `canvas.getBoundingClientRect()` after each write: `1299 ms`.

The wheel path reads `canvas.getBoundingClientRect()` through `point(event)` on every event, then writes viewport CSS variables and transform. The next wheel event can force style/layout flush from the previous write. This is a much stronger explanation for multi-hundred-millisecond zoom lag than relationship routing.

Additional playground-shaped sample requested by the operator:

- Synthetic `15 zones x 5 cards`: 15 zones, 75 ledger cards, no ledger relationships.
- Initial full render: `99 ms`.
- One `renderCardZoneColors()` pass: `66 ms`.
- One `renderZoneLabelOverlay()` pass: `3 ms`.
- 10 wheel zoom-out events from `0.72`: `283 ms` sync work, p95 `48 ms`.
- 15 wheel zoom-out events from `0.72`: `457 ms` sync work, p95 `40 ms`.
- 15 wheel zoom-in events from `0.18`: `389 ms` sync work, p95 `45 ms`.
- 15 pan pointermove events: `0.7 ms` total.
- Pan `pointerup`: `84 ms`.

This confirms two separate lag sources for the playground shape:

- Zoom: 10-15 wheel events are already enough to create hundreds of milliseconds of queued work.
- Pan release: full surface rerender is expensive because `renderCardZoneColors()` scans zones and cards with layout/style reads.

## Main finding

The pan movement path is already cheap in JavaScript. The measurable hitch is the gesture release path and zoom/detail-mode path.

Initial isolated-event sample:

- `ses` pan `pointermove`: average handler cost about `0.03 ms`.
- `ses` pan `pointerup`: average handler cost about `64 ms`.
- `s3` pan `pointerup`: average handler cost about `25 ms`.
- `ses` zoom-in wheel: handler p95 about `13 ms`.
- `ses` zoom-out wheel: handler p95 about `42 ms`.
- `synthetic60` simple cards, no relationships: full render sync about `19 ms`; zoom-out handler p95 about `18 ms`.

Updated interpretation:

- Plain pan movement is still cheap in JavaScript.
- The visible hitch after a pan is likely caused by a full rerender on `pointerup`.
- Zoom lag is primarily queued synchronous work during wheel bursts.
- The strongest measured zoom cause is low-detail viewport style invalidation plus forced layout reads between events.

## High-confidence bottleneck candidates

### 1. Full surface rerender on every pointer release

`handlePointerUp` always calls `renderCanvasSurface()` after finishing the pointer, including plain canvas pan gestures.

Relevant code:

- `frontend/src/runtime/gesture/controller/handle-pointer-up.ts`: unconditional `renderCanvasSurface()` at the end of the controller.
- `frontend/src/runtime/canvas/effect/render-canvas-surface.ts`: render pipeline calls ledger render, viewport transform, selection state, card zone colors, zone labels, relationship overlay, label visibility, telemetry, and thread panel.

Why it matters:

- A pan does not change card content, card geometry, relationships, zone color, labels, or threads.
- For active ledger tabs, `renderCanvasSurface()` calls `renderLedgerSurface()`.
- `renderLedgerSurface()` loops through every annotation and every card.
- `patchLedgerCard()` rebuilds each card with `replaceChildren(...)`, reparses markdown, recreates buttons, labels, media shells, and resize handles.

Expected symptom:

- Pan is smooth while dragging, then stutters when the pointer is released.
- Larger cards and image-heavy cards increase the release hitch.

How to measure precisely:

1. Wrap `handlePointerUp` in a `performance.mark/measure` block split by intent.
2. Record:
   - `pointer.intent`
   - active tab
   - visible card count
   - relationship count
   - sync handler duration
   - time to next 2 animation frames
3. Add nested measures around `renderCanvasSurface`, `renderLedgerSurface`, and `patchLedgerCard` aggregate cost.

Target budget:

- Plain pan `pointerup`: under `4 ms` sync work.
- Drag/resize `pointerup` with server commit: can exceed that, but should distinguish network/commit from local rerender.

Optimization direction:

- Do not call full `renderCanvasSurface()` for plain pan release.
- For pan release, persist viewport only and clear pointer state.
- For drag/resize release, patch only affected geometry plus relationship paths attached to moved cards.

### 2. Zoom calls relationship redraw and detail-mode work per wheel event

`handleWheel()` calls `applyViewportTransform()` and `renderRelationshipOverlay()` on every wheel event.

Relevant code:

- `frontend/src/runtime/gesture/controller/handle-wheel.ts`
- `frontend/src/runtime/canvas/effect/apply-viewport-transform.ts`
- `frontend/src/runtime/canvas/effect/update-detail-mode.ts`
- `frontend/src/runtime/relationship/effect/render-relationship-overlay.ts`

Why it matters:

- Wheel events can arrive faster than the display refresh rate.
- The handler is not coalesced through `requestAnimationFrame`.
- Relationship redraw is called even during pure zoom, even though card-local relationship coordinates do not change when the whole world layer is scaled.
- `updateDetailMode()` scans all cards and, when entering low detail, measures `offsetWidth` and `offsetHeight`, forcing layout.
- `point(event)` reads `canvas.getBoundingClientRect()` on every wheel event.
- `applyViewportTransform()` writes CSS variables and transform on every wheel event.
- During a burst, this creates a read-after-write layout flush pattern.
- In low-detail mode, `--viewport-scale` and `--inverse-viewport-scale` are consumed by card titles/status/zone labels, so changing those variables invalidates style/layout across many card descendants.

Expected symptom:

- Zoom stutters, especially when zooming out past `scale < 0.35`.
- The first transition into low-detail mode is worse than subsequent same-mode wheel ticks.

Live evidence:

- `ses` zoom-out handler p95 was about `42 ms`.
- `ses` zoom-in handler p95 was about `13 ms`.
- The zoom-out case crosses low-detail thresholds and has many larger markdown/image cards.
- `ses` 80-event zoom-out burst took about `2.4 seconds` of synchronous work.
- `s3` 80-event zoom-out burst took about `1.17 seconds` of synchronous work.
- `ses` low-detail viewport writes alone took about `1.25 seconds` for 80 updates.
- `ses` low-detail viewport write plus layout read took about `2.97 seconds` for 80 updates.

How to measure precisely:

1. Instrument `handleWheel` with sub-measures:
   - math only
   - `scheduleViewportPersistence`
   - `applyViewportTransform`
   - `updateDetailMode`
   - `renderRelationshipOverlay`
2. Separately record whether the wheel event crossed:
   - normal -> low detail
   - low detail -> overview
   - low detail -> normal
3. Capture p50/p95/max for 100 wheel events per scenario.
4. Record dropped frames with CDP tracing categories:
   - `devtools.timeline`
   - `disabled-by-default-devtools.timeline`
   - `cc`
   - `blink`
   - `gpu`

Target budget:

- Wheel handler sync work should stay under `3 ms`.
- Detail-mode transition may take longer, but should happen once per threshold crossing, not repeatedly during continuous wheel input.

Optimization direction:

- Coalesce wheel updates with one scheduled animation frame.
- Accumulate wheel deltas and apply only the latest viewport once per frame.
- Avoid `getBoundingClientRect()` inside every wheel event; cache the canvas rect for the gesture/frame or use a stable viewport-relative pointer calculation.
- Do not redraw relationships for zoom-only transforms; the SVG is inside the transformed world.
- Cache low-detail card dimensions at render/resize time, not inside the wheel handler.
- Only toggle detail classes when the detail mode actually changes.
- Consider not updating `--viewport-scale` continuously during wheel; update inverse-scale label affordances after the zoom settles or only when detail mode is active and the value materially changes.

### 3. Large transformed world and huge honeycomb grid can make pan compositor-bound

The pan handler uses a transform-only update through `applyPanViewportTransform()`, which is good. The potential cost is browser rendering, not JavaScript.

Relevant code:

- `frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts`
- `frontend/assets/canvas/canvas-layer.css`
- `.canvas-content` is transformed as one large world layer.
- `.grid` is `200000px x 200000px` with six conic-gradient backgrounds.
- Cards have gradients and box shadows; relationships use SVG strokes and stroked text.

Why it matters:

- Transforming a very large layer can force expensive raster/composite work depending on browser, GPU, and layer promotion.
- The grid is enormous and visually present during every pan.
- If `.canvas-content` is not isolated into stable composited layers, many child cards can contribute paint or raster invalidation.

Expected symptom:

- Pointer handler timings stay low while visible FPS drops.
- Chrome performance trace shows time under Paint, Rasterize, CompositeLayers, or CompositorTileWorker rather than JS.

How to measure precisely:

1. Use Chrome DevTools Performance, or CDP `Tracing.start`, with `cc`, `gpu`, and `devtools.timeline`.
2. Record 5-second manual pans at three scales:
   - `1.0`
   - `0.72`
   - `0.18`
3. Compare:
   - scripting time
   - rendering/layout time
   - paint time
   - raster time
   - GPU/composite time
   - frame count below 50 FPS
4. Run A/B CSS toggles from DevTools:
   - hide `.grid`
   - remove card `box-shadow`
   - hide `.relationships`
   - add/remove `will-change: transform` on `.canvas-content`
   - replace huge grid with viewport-sized fixed background

Target budget:

- During pan, main-thread JS should be below `1 ms/frame`.
- Rendering plus compositor work should stay under `16.7 ms/frame` for 60 FPS, or `8.3 ms/frame` for 120 FPS devices.

Optimization direction:

- Make the honeycomb a viewport-sized fixed background whose background position is derived from viewport transform, instead of a huge world child.
- Consider `will-change: transform` or `translate3d(...)` for `.canvas-content`, measured before keeping it.
- Hide heavy card internals during active pan/zoom, not only at low zoom.

### 4. Relationship overlay scales with relationship count and uses repeated DOM lookups/layout reads

This is not the primary issue for the no-relationship `ses` case, but it is a separate bottleneck for `s3`.

Relevant code:

- `frontend/src/runtime/relationship/effect/render-relationship-overlay.ts`

Potential costs:

- Query all relationship paths each render.
- For every relationship, query source and target cards by selector.
- `calculateRelationshipPorts()` likely reads geometry.
- `relationshipLabelColor()` calls `getComputedStyle()` for each endpoint.
- Labels are patched on every overlay render.

How to measure precisely:

1. Instrument `renderRelationshipOverlay()` with:
   - relationship count
   - endpoint query duration
   - port calculation duration
   - route duration
   - label patch duration
2. Compare `0`, `20`, `100`, and `500` synthetic relationships.
3. Measure redraw on:
   - zoom
   - pan
   - dragging one unrelated card
   - dragging a connected card

Optimization direction:

- Do not redraw relationships on pan/zoom world transforms.
- On drag, redraw only relationships connected to moved cards.
- Cache card element lookup by card ID.
- Cache label colors unless endpoint zone/status changes.

### 5. Card rerender rebuilds too much unchanged DOM

`patchLedgerCard()` always rebuilds a full card subtree.

Relevant code:

- `frontend/src/runtime/ledger/component/patch-ledger-card.ts`
- `frontend/src/runtime/ledger/component/render-ledger-card-markdown.ts`
- `frontend/src/runtime/ledger/component/render-ledger-card-media.ts`
- `frontend/src/runtime/ledger/component/append-inline-nodes.ts`

Why it matters:

- Each full render reparses markdown and recreates DOM for every card.
- Image/media render creates `ResizeObserver`s.
- Replacing children destroys and recreates existing button/media/body nodes even when only geometry or selection changed.

How to measure precisely:

1. Add aggregate counters:
   - number of `patchLedgerCard()` calls per render
   - total card patch duration
   - markdown parse duration
   - DOM creation duration
   - `replaceChildren` duration
2. Add a card content hash and record whether a card was rebuilt despite unchanged content.
3. Run against:
   - real `ses`
   - real `s3`
   - synthetic 30/60/100 plain cards
   - synthetic 30 image cards

Optimization direction:

- Split card patching into geometry patch and content patch.
- Skip body rebuild when markdown, fields, labels, tab, status, and image sizes are unchanged.
- Use keyed card element maps during render instead of repeated `querySelector`.

## Measurement plan

### Phase 1: Lightweight in-app telemetry

Add a development-only performance collector:

- `perfMeasure(name, fn, attrs)` for synchronous functions.
- `perfMeasureAsync(name, fn, attrs)` for async actions.
- Store a rolling buffer at `window.__corePerf`.
- Include p50/p95 summaries in the existing telemetry panel only when `?perf=1` is present.

Instrumentation points:

- `handlePointerMove`
- `handlePointerUp`
- `handleWheel`
- `applyViewportTransform`
- `updateDetailMode`
- `renderCanvasSurface`
- `renderLedgerSurface`
- `patchLedgerCard`
- `renderRelationshipOverlay`
- `renderZoneLabelOverlay`
- `renderSelectionState`
- `persistState`
- `commitSelectedLedgerGeometry`

Minimum event attributes:

- active tab
- card count
- relationship count
- zone/group count
- viewport scale
- pointer intent
- detail mode before/after
- selected counts

### Phase 2: Repeatable browser benchmark

Create a benchmark command that starts the app from the target workspace and drives Chrome through CDP.

Scenarios:

- Real `ses`: no ledger relationships, many document cards.
- Real `s3`: relationship-heavy.
- Synthetic 30/60/100 cards, no relationships, simple text.
- Synthetic 30/60 cards with image/media markdown.
- Synthetic 30 cards plus 100/500 relationships.

Actions:

- initial tab render
- 5-second pan at `scale=1`
- 5-second pan at `scale=0.72`
- 5-second pan at `scale=0.18`
- wheel zoom in from `0.72` to `2.2`
- wheel zoom out from `2.2` to `0.08`
- drag one unconnected card
- drag one connected card

Metrics:

- handler p50/p95/max
- time to next 2 animation frames
- long tasks over `50 ms`
- dropped-frame percentage
- total layout time
- total paint time
- total raster/composite time
- DOM node count
- card patch count
- relationship route count

### Phase 3: DevTools trace confirmation

Use real Chrome, not headless-only, for the final decision:

1. Open `http://127.0.0.1:4174/ses?perf=1`.
2. Record a Performance trace while panning for 5 seconds.
3. Repeat with `.grid { display: none; }`.
4. Repeat with `.card { box-shadow: none; }`.
5. Repeat with `.relationships { display: none; }`.
6. Repeat with full-render-on-pan-release disabled in a temporary branch.

Decision rule:

- If JS scripting dominates, optimize render/update code first.
- If paint/raster/composite dominates while JS is low, optimize CSS/layering/grid first.
- If `pointerup` dominates but movement is smooth, optimize release rerender first.

## Recommended optimization order

1. Coalesce wheel handling through `requestAnimationFrame` and apply one viewport update per frame.
2. Remove per-wheel `getBoundingClientRect()` layout reads; cache the canvas rect for the frame/gesture.
3. Only run detail-mode cache/toggle when the detail mode changes.
4. Skip relationship redraw for pan/zoom transforms.
5. Remove full `renderCanvasSurface()` from plain pan `pointerup`.
6. Split `patchLedgerCard()` into geometry-only and content rebuild paths.
7. Replace or isolate the huge honeycomb grid if traces show raster/composite cost during pan.
8. Add dirty-set relationship routing for drag/resize.

## Acceptance thresholds

Use these thresholds before and after each optimization:

- Plain pan `pointermove` handler p95: `< 1 ms`.
- Plain pan `pointerup` handler p95: `< 8 ms`.
- Wheel handler p95 outside detail-mode threshold crossing: `< 4 ms`.
- Detail-mode threshold crossing p95: `< 16 ms`.
- Full tab render for 30 cards: `< 50 ms` sync, no long task over `100 ms`.
- No visible dropped-frame bursts during 5-second pan at `scale=0.72`.

## Current provisional conclusion

The first optimization effort should not start with relationship routing. The `ses` case has no ledger relationships and still shows high zoom and pan-release costs.

The highest-value first target is now the wheel zoom backlog: coalesce wheel events, remove per-event layout reads, and avoid continuous low-detail CSS invalidation. The second target is the unnecessary full render after plain panning. The third target depends on trace evidence: if manual panning is still choppy while JS remains cheap, the next bottleneck is likely CSS/compositor cost from transforming the huge grid plus many styled DOM cards.

## Ardaria game-design follow-up

The operator asked to validate the far-away zoom case on the real Ardaria game-design ledger, where cards are already in minimal content mode.

Workspace and route:

- Workspace: `/home/jbb/Ardaria_57`
- Route: `http://127.0.0.1:4173/ardaria-game-design`
- Runtime DOM: 71 rendered cards, 18 zones/groups, 2 stale static relationship paths, 5705 DOM nodes, 7 images.
- Active ledger data: 68 cards, 15 annotations, 0 ledger relationships.

Baseline before the zoom-path fix:

- Scale `0.12`, 10 wheel events zooming out: median `922 ms` sync burst, about `92 ms/event`.
- Scale `0.12`, 15 wheel events zooming out: median `1337 ms` sync burst, about `89 ms/event`.
- Scale `0.08`, 15 wheel events zooming out: median `1336 ms` sync burst, about `89 ms/event`.
- Scale `0.05`, 15 wheel events zooming in to `0.123`: median `1361 ms` sync burst, about `91 ms/event`.
- `updateDetailModeOnly`: about `7-8 ms/event`.
- `applyViewportTransform`: about `36 ms/event`.
- `applyViewportTransformThenCanvasRect`: about `90 ms/event`.

This confirms the user report: even with overview detail already active and zero ledger relationships, 10-15 wheel events can create close to a second of synchronous input backlog.

Root cause confirmed:

- `point(event)` read `canvas.getBoundingClientRect()` for every wheel event.
- `applyViewportTransform()` wrote `--viewport-scale`, `--inverse-viewport-scale`, and the world transform for every wheel event.
- `updateDetailMode()` toggled low/overview classes and scanned card sizes on every scale update even when the mode did not change.
- The next wheel event forced a layout/style flush from the previous write.

Implemented fix:

- Cache canvas pointer bounds and invalidate them on resize, visual viewport resize, and scroll.
- Make detail mode idempotent: card-size measurement only runs after ledger DOM invalidation or low-detail entry; low/overview classes are only toggled when their boolean state changes.
- Invalidate the detail card-size cache from `renderLedgerSurface()` because ledger DOM/card content can change there.

After the fix on the same Ardaria route:

- Scale `0.12`, 10 wheel events zooming out: median `63 ms` sync burst, about `6.3 ms/event`.
- Scale `0.12`, 15 wheel events zooming out: median `90 ms` sync burst, about `6.0 ms/event`.
- Scale `0.08`, 15 wheel events zooming out: median `87 ms` sync burst, about `5.8 ms/event`.
- Scale `0.05`, 10 wheel events zooming in to `0.091`: median `73 ms` sync burst, about `7.3 ms/event`.
- Scale `0.05`, 15 wheel events zooming in to `0.123`: median `86 ms` sync burst, about `5.7 ms/event`.
- `updateDetailModeOnly`: effectively `0 ms/event` while already in the same detail mode.
- `applyViewportTransform`: effectively `0 ms/event` without a forced layout read.
- `applyViewportTransformThenCanvasRect`: still about `17 ms/event`, which proves forced layout after viewport writes remains expensive when explicitly requested.

Remaining optimization direction:

- Coalesce wheel input through `requestAnimationFrame` so the app applies at most one viewport update per frame.
- Keep avoiding layout reads in the hot wheel path.
- Consider updating counter-scaled low-detail labels less frequently during active wheel if compositor/style traces still show frame drops in an interactive browser.
