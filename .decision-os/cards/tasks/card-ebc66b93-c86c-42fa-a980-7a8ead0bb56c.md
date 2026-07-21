#task #task-active

## A. Checks

1. Run the focused automated tests under the phone workload budget.
2. Verify the existing server process and project-scoped route without restarting it.
3. Record the limit if browser interaction cannot be exercised.

---

## C. Contradicted Success RCA

1. **Operator evidence:** Brave on Android showed the bottom `FILE` and `TEXT` controls after opening the card thread; `FILE` rendered with the project violet.
2. **Reproduced route:** `/p/ZGVjaXNpb24tb3M/ledgers/specs/zones/zone-c59bdce6-9611-408a-8211-cb89eda8aad5/cards/card-2164c008-359f-40ac-8abf-505ee5b5fe38` returned HTTP `200`.
3. **First incorrect transition:** `.terminal-button--attach` mapped `--thread-accent: #4f36e0` into its foreground and glow variables. `.terminal-button--thread-text` already owned fixed `#b58cff`; `.terminal-button--record` owned fixed `#ff6f91`.
4. **Request sequence:** the page loaded `/decision-os/projects`, the project-scoped `/decision-os/state`, then the project-scoped `/decision-os/specs`; no mutation request is involved in this visual state.

---

## D. Regression Evidence

1. `FILE` now owns fixed `#69d7ff` and a fixed blue glow with no `--thread-accent` reference.
2. Focused regression and frontend typecheck pass.
3. Mobile Chromium opened the thread on the reproduced route and measured `FILE #69d7ff`, `TEXT #b58cff`, and `REC #ff6f91` while the thread accent remained `#4f36e0`.
4. All three controls retained the same neutral surface, uppercase label, `0 0 24 24` SVG structure, and `125×66` dimensions.