## A. Scope

1. **Library:** Vendor `Embla Carousel 8.6.0`, MIT licensed, with no transitive dependencies and no runtime CDN.
2. **Mobile driver:** Initialize Embla for rendered `frontend-mobile` image carousels and disable the shared custom pointer driver on that surface.
3. **Controls:** Route side arrows and direct selectors through `scrollPrev()`, `scrollNext()`, and `scrollTo(index)`.
4. **Lifecycle:** Destroy Embla instances before replacing a rendered card body and preserve selected-slide persistence.

---

## B. Acceptance Criteria

1. **Snap behavior:** Use `dragFree: false`, `slidesToScroll: 1`, `skipSnaps: false`, `loop: false`, and `duration: 25`.
2. **Self-contained delivery:** Serve the pinned `17,946` byte UMD build from `/assets/vendor/embla-carousel-8.6.0.umd.js` with its MIT license in the repository.
3. **Compatibility:** Preserve the concurrent vendored SortableJS script and load both libraries before `/src/mobile.js`.
4. **Verification:** `29` mobile tests, the focused shared carousel test, and frontend TypeScript check pass.

---

## C. Evidence

1. **Implementation commit:** `4768c62`.
2. **Merge commit:** `3cc66b9`.
3. **Runtime:** Port `50150` returned the pinned Embla asset with `HTTP 200`, `content-type: text/javascript`, and `cache-control: no-store`.
