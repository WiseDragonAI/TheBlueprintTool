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

## 2026-05-12: Relationship Ports Merge On Card Borders

Problem:
- Multiple relationship lines targeting the same card side can visually merge before reaching the marker.
- The user reported this after previous arrow fixes focused on detached endpoints and clearance dents.

Failed assumption:
- I routed each relationship independently and used the target card center for horizontal target ports.
- That violates the spread-port spec because two or more routes on the same card side can choose the same border coordinate.

Previous work:
- Relationship arrows were moved into the same canvas-world coordinate system as cards.
- Non-direct routes were forced through clearance lanes to avoid border dents merging with card outlines.

Current corrective attempt:
- Resolve all visible relationship endpoints as one overlay-level batch.
- Group endpoints by card id and border side.
- Assign deterministic evenly spaced slots before routing each path.
- Extend live verification to report port spread failures, not only endpoint attachment.

## 2026-05-12: Dense Relationship Lanes Explode Across Ledger Canvas

Problem:
- Dense ledger tabs show very large rectangular arrow paths that visually dominate and crop the canvas.
- Low zoom still shows oversized labels and titles over tiny cards.

Failed assumption:
- I treated endpoint spacing as enough to validate the arrow fix.
- The route helper still multiplied the global relationship index by lane spacing, so dense ledgers created huge deterministic detours.
- Low-detail mode hid descriptions and controls but not card titles or inverse-scaled zone labels.

Previous work:
- Relationship endpoints were spread by card side.
- Overview mode hid labels at the deepest zoom level only.

Current corrective attempt:
- Hide card titles and zone labels in low-detail mode, not only overview mode.
- Bound relationship lane offsets to a small deterministic lane band instead of using the global relationship index as distance.
