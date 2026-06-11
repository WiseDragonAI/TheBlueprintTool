# Drag Move Call Chain

## A. Current Finding

1. **Previous analysis is rejected.** The earlier card treated a narrow trace as if it explained the user-visible drag failure. It does not.
2. **The failure is during drag.** The observed problem is not mainly an after-release pause. During active drag, frames can degrade into the `40ms`, `50ms`, and `80ms` range, which matches roughly `25 FPS`, `20 FPS`, and `12.5 FPS`.
3. **The card must focus on frame production, not only JS event time.** A `pointermove` handler can look acceptable while the browser still misses frames because style, layout, paint, raster, image work, overlay work, or compositing debt lands before the next presented frame.

---

## B. Invalidated Claims

1. **Do not claim drag is acceptable at `29ms`.** That number already misses a `60 FPS` frame budget, and it does not match the reported worst frames.
2. **Do not frame release jank as the main issue.** Release jank may exist, but it is not the operator-reported blocker for this card.
3. **Do not use the old table as proof.** The old run was too narrow and too hard to read. It did not prove the actual during-drag frame distribution that matters.

---

## C. Required Re-Measurement

1. **Trace real continuous dragging.** Capture a realistic drag long enough to expose the bad frames, not only a short scripted move sequence.
2. **Report frame gaps directly.** The output must list worst during-drag frames, p95 during-drag frame gap, and the count of frames above `33ms`, `50ms`, and `80ms`.
3. **Separate phases.** The trace must split `before drag`, `during drag`, `pointerup`, and `after release` so release work cannot be mistaken for drag work.
4. **Mark code spans.** Add marks around `handlePointerMove`, geometry mutation, DOM patching, zone labels, relationship overlay, controls overlay, and markdown/image/card resizing paths.
5. **Keep the writeup readable.** Use short sections and only the minimum numbers needed to make the decision. Avoid stacked tables.

---

## D. Investigation Direction

1. **Primary hypothesis.** During drag, CoreV2 is doing too much synchronous visual work before the next frame can present.
2. **High-risk paths.** Layout-position writes, zone label reads, overlay rerenders, card markdown/image surfaces, relationship routing, and canvas control overlays all stay on the suspect list until measured in the corrected trace.
3. **Acceptance for the next analysis.** The next version is valid only if it explains the bad during-drag frames themselves and identifies the smallest structurally correcting change to test first.
