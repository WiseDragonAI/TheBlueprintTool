#master-task

Ledger: Specs

## A. Operator outcome

1. Replace the defective browser-owned picker with an app-owned replica explicitly authorized by the operator.
2. Match the Brave reference: rounded dark sheet, three thick HSV gradient tracks, oversized blue handles, chosen-color swatch, Cancel, and Set.
3. Hydrate saved project colors before interaction and initialize unset colors with generated hue, saturation `0.7`, and value `0.8`.

---

## B. Interaction implementation

1. Selected noUiSlider `15.8.1`, MIT, framework-free, zero dependencies, vendored under `frontend-mobile/assets/vendor`.
2. noUiSlider owns touch normalization, pointer cancellation, keyboard input, ARIA slider state, responsive positioning, and cleanup.
3. Decision OS owns RGB↔HSV conversion, dependent gradients, hydrated draft state, chosen-color rendering, Set/Cancel, and project persistence.
4. Opening converts persisted `#5d5bcf` to approximately hue `241`, saturation `56`, and value `81` before showing the sheet.
5. An untouched Set preserves the original exact hex. Touch movement updates draft HSV and the swatch without mutating the settings form. Cancel discards the draft. Set commits it to the settings form.

---

## C. Reference fidelity

1. Surface: `#27282b`, `24px` radius, dark backdrop, no substituted Coloris field.
2. Tracks: three `42px` dependent gradients with bordered inset surfaces.
3. Handles: `42×50px`, blue gradient, house-shaped top matching the Brave screenshots.
4. Hierarchy: `Select color`, Hue, Saturation, Value, Chosen color swatch, Cancel, Set.

---

## D. Verification evidence

1. Focused color and mobile integration checks pass: **49 tests passed**.
2. The complete frontend-mobile suite passes: **83 tests passed**.
3. Live route `http://127.0.0.1:50150/projects/ZGVjaXNpb24tb3M` returned HTTP `200`; the pinned noUiSlider asset returned HTTP `200`; the server was not restarted.
4. Mobile Chromium initialized persisted `#5d5bcf` as `H=241`, `S=56`, `V=81` with the chosen swatch rendered purple.
5. Android touch-drag changed Saturation to `35`, updated the swatch to `rgb(135, 134, 207)` before Set, kept the form value at `#5d5bcf` during the draft, and committed `#8786cf` on Set.
6. A separate Cancel path retained exact form value `#5d5bcf`.
7. **Brave Android device interaction is not yet verified.**

---

## E. Recorded lessons

1. **Behavior-only component changes preserve the validated component unless the operator explicitly authorizes replacement.**
2. **Default state is part of the component contract:** unset visual controls must initialize to usable values.
3. **Persisted editors require visible hydration:** verify the editing controls, not only the backing value.
4. **Interaction claims require target-surface gestures:** source checks cannot prove touch behavior.

---

## F. Commits

1. Implementation commit: `c057e1a`.
2. Merge commit: `0e89ece`.

---
