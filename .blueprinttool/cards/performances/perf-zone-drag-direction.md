# Zone Drag Performance Direction

Problem: dragging a zone can be worse than dragging a card because it combines selection breadth, label-overlay rebuilds, and browser repaint/commit work for a large zone surface.

This is not yet proven with a dedicated zone-drag trace. The current drag trace was a card drag. The direction below is a code-grounded hypothesis and measurement plan.

## Current Zone Drag Path

Source facts:

- `frontend/src/runtime/gesture/controller/handle-pointer-down.ts:54-75` resolves the pointer target as `card`, `zone`, `group`, or `canvas` and starts drag.
- `frontend/src/runtime/selection/controller/select-target.ts:22-28` adds all cards intersecting a selected zone to `state.selection.cardIds`.
- `frontend/src/runtime/selection/effect/move-selected.ts:41-72` moves selected cards, selected zones, and selected groups by patching ledger geometry and writing `left/top`.
- `frontend/src/runtime/selection/effect/move-selected.ts:33-38` then renders zone labels, relationships, and controls in the same pointermove.
- `frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:30-36` rebuilds labels from layout reads.
- `frontend/assets/canvas/objects.css:13-22` gives regular zones gradient background, border, and inset shadow.

This means a selected zone drag can move more than one visible object:

```text
select zone
  -> select zone id
  -> also select intersecting cards
drag
  -> patch zone left/top
  -> patch each selected card left/top
  -> rebuild all zone label proxies
  -> browser repaints/commits a large zone surface and selected card surfaces
```

## Why Label Rebuild Exists

The visible label is not the real `.zone-title`; `.zone-title` is hidden and counter-scaled. The rendered visible label is a proxy in `.zone-label-overlay`.

Current code rebuilds the proxy list every time:

```text
renderZoneLabelOverlay()
  -> overlay.replaceChildren()
  -> query all zones
  -> for each visible zone:
       read zone/title offsets and width
       read computed title style
       append new .zone-label-proxy
```

That explains the earlier drag proof. It does not mean rebuilding is required. It is just the current implementation.

Better direction:

```text
initial label render
  -> create one proxy per zone
  -> store proxy by zone id

during drag
  -> update only moved zone proxy transform/position from in-flight geometry
  -> do not replaceChildren()
  -> do not read offsetLeft/offsetTop/offsetWidth per pointermove

after title/color/edit changes
  -> update text/style for that one proxy
```

So the answer to "why not just move it?" is: we should. The current rebuild is a simple global sync path, not the desired drag path.

## Zone Repaint Hypothesis

The operator hypothesis is plausible: full-detail zone dragging likely has a browser paint/commit offender beyond JavaScript.

Mechanism:

- Zone DOM uses `left/top` movement, so it is layout-position movement, not transform-only compositor movement.
- Regular zones are large surfaces with gradient background, border, and shadow.
- Selecting a zone also selects intersecting cards, so the drag may move the zone plus many cards.
- In full detail, those card surfaces may include rich detail DOM.

Expected trace signals for a bad zone drag:

```text
EventDispatch:pointermove maybe lower than frame time
ProxyMain::BeginMainFrame high
Paint / PrePaint / UpdateLayerTree high
LayerTreeHost::WaitForCommitCompletion high
RasterTask / DisplayItemList::Raster high
```

That would validate repaint/commit as the dominant zone-drag offender.

## Fix Direction

Do not start by only optimizing JS. Split the fix:

1. Add a dedicated zone-drag trace.
2. Stop global zone-label rebuild during drag.
3. Introduce in-flight drag geometry shared by cards, zones, labels, controls, and relationships.
4. During drag, move selected zone/card visuals with `transform`, not `left/top`.
5. Commit ledger geometry and final `left/top` once on release.
6. For zone drag specifically, avoid moving contained/intersecting cards as independent DOM `left/top` writes during every pointermove; use one drag preview layer or shared transform group when possible.
7. Keep large zone visual effects cheap during active drag, for example disable shadows/expensive paint only under an `.is-dragging-zone` class.

## Required Measurement

Add a trace case:

```text
target kind: zone
scale: full detail, and low/detail threshold cases
variants:
  baseline
  skip-zone-labels
  transform-preview-zone
  cheap-zone-visuals
  no-contained-card-move
```

Frame decomposition must report:

```text
worst during-zone-drag frame
EventDispatch:pointermove
source spans inside moveSelected
label overlay spans
number of moved cards
Paint / PrePaint / UpdateLayerTree
ProxyMain::BeginMainFrame
LayerTreeHost::WaitForCommitCompletion
RasterTask / DisplayItemList::Raster
```

Acceptance for a zone-drag fix:

```text
worst during-zone-drag frame < 16.7ms
label overlay layout reads absent or < 1ms
selected zone/card visuals move with transform during drag
left/top commit happens once on release
no paint/raster/commit event > 8ms during drag
zone label remains visually attached to the moving zone
contained/intersecting cards remain visually correct
```
