# Failed Fixes

This document records recurrent defects when a reported problem survives a prior fix attempt. Each entry states the failed assumption, the previous work, and the current corrective attempt.

## 2026-05-12: Honeycomb Background Shifts During Zoom

Problem:
- The honeycomb background still visibly refreshes or shifts during wheel zoom.
- The user reported this again after an earlier fix claimed the tiling scale was stable.

Failed assumption:
- I treated "background stays stable during zoom" as only `background-size` stability.
- The runtime still updated `--canvas-bg-x` and `--canvas-bg-y` from `state.viewport.x/y`.
- Cursor-anchored zoom changes viewport translation, so the grid's `background-position` changed even though tile size did not.
- The follow-up fix went too far in the other direction: it made the honeycomb viewport-locked, but the intended model is canvas-world material that scales and pans with the canvas content.

Previous work:
- The canvas content was transformed through `.canvas-content`.
- `.grid` was kept outside the transformed content.
- Live verification only compared `background-size` before and after zoom.

Current corrective attempt:
- Move the honeycomb grid inside `.canvas-content` so it shares the same transform as cards, zones, groups, and relationships.
- Keep pointer handling on `.canvas` so the full viewport still pans and zooms.
- Extend live verification to check that the grid's rendered rectangle changes scale after wheel zoom, proving it follows canvas-world zoom instead of staying viewport-locked.

## 2026-05-12: Ledger Relationship Arrows Detach From Cards

Problem:
- Relationship arrows still appear detached from cards on ledger views, especially when zoomed out.
- Repeated visual feedback showed arrows as isolated line fragments or lines terminating away from card borders.

Failed assumption:
- I focused on port and route math while leaving the generated ledger SVG overlay with its own custom `viewBox`.
- That viewBox introduced a second coordinate system, scaling route coordinates independently from card layout coordinates.
- The live verifier checked the static surface relationships, so it did not catch the ledger-tab overlay coordinate mismatch.

Previous work:
- Relationship ports were derived from card canvas rectangles.
- Routes were changed to square orthogonal paths with visible endpoint standoff.
- Endpoints were checked against static card borders.

Current corrective attempt:
- Make ledger relationship SVG overlays use the same canvas-world pixel coordinate system as cards by removing the independent `viewBox`.
- Set relationship SVG overflow visible so routes outside the nominal 5200x2600 viewport are still rendered in canvas-world coordinates.
- Extend live verification to check relationship endpoints on ledger tabs, not only the static surface.

## 2026-05-12: Relationship Dent Merges With Card Border

Problem:
- Relationship arrows are attached again, but the clearance dent can still sit too close to the card border.
- The route can draw a long segment on the standoff line next to the card, making the arrow visually merge with the card border before the marker.

Failed assumption:
- Endpoint distance checks were not enough; they proved the marker was outside the card, but not that the previous route segment had enough clearance from the card side.
- The route helper still allowed simple elbow routes that skip the source/target clearance lane.

Previous work:
- Relationship arrows were moved to the same canvas-world coordinate system as cards.
- Static and ledger endpoint checks were added to live verification.

Current corrective attempt:
- Remove the simple elbow shortcut for non-direct routes.
- Force non-direct routes through clearance points before the final short connector into the card side.
- Extend live verification endpoint checks so the point before a non-direct target endpoint also has clearance from the target card.

## 2026-05-12: Ledger Group Selection Does Not Expand To Zones

Problem:
- Selecting a group in a ledger tab still does not visibly select intersecting zones and cards.
- The user reported this after previous work only verified static surface groups.

Failed assumption:
- I assumed the group selection controller path covered ledger-rendered groups.
- Ledger annotations with `variant: "group"` were rendered with `group-zone` styling but still received `data-zone-id`, so pointer targeting entered the zone branch instead of the group branch.
- The live verifier only checked `group-core` on the static surface.

Previous work:
- `select-target` computed group membership for elements addressed by `data-group-id`.
- Static group tests verified unselected group pan and selected group movement.

Current corrective attempt:
- Render ledger group annotations with `data-group-id` and regular ledger zones with `data-zone-id`.
- Move group membership calculation into a dedicated one-function file.
- Extend live verification with a reusable summary command that selects a ledger-tab group and reports selected groups, zones, and cards.

## 2026-05-12: Deep Zoom Overview Collapses Into Overlapping Text

Problem:
- After the zoom/background fixes, deep zoom-out can destroy the canvas visually: cards and zones shrink while labels and titles remain readable-size and overlap into dense columns.

Failed assumption:
- I treated constant-size zone labels as absolute at every zoom level.
- That conflicts with overview-detail mode, where the canvas is too compressed for readable labels to remain spatially meaningful.

Previous work:
- Low-detail and overview-detail classes were added based on viewport scale.
- Low-detail hid card bodies, controls, and relationship labels, but left card titles and inverse-scaled zone labels visible.

Current corrective attempt:
- Clamp inverse-scaled zone label width to the visible zone width.
- Hide card titles and zone labels in overview-detail mode.
- Extend live verification to report overview text suppression explicitly.
