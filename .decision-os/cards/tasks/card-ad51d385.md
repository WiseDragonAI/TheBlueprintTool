## A. Objective

1. **Add the hierarchy.** Make Control Room project-aware and present `project → ledger → zone → card`.

---

## B. Implementation

1. **Project context.** Load the server project catalog and keep an explicit selected project in Control Room state.
2. **Navigation.** Scope ledger, zone, card, thread, and asset navigation to the selected project.
3. **Overview.** Provide the requested global overview across projects while retaining the existing ledger, zone, and card interactions inside a project.
4. **Visual identity.** Apply each project's configured color where project identity is represented.

---

## C. Verification

1. **Control Room coverage.** Test project switching, project-scoped navigation, global overview rendering, and preservation of the existing hierarchy beneath projects.

---

## D. Implementation Evidence

1. **Project hierarchy.** Mobile Control Room loads `/decision-os/projects`, keeps explicit project state, aggregates every project's ledger documents for the global task view, and selects a project before navigating into its ledger, zone, card, thread, and Codex surfaces.
2. **Visual identity.** Project navigation and task rows use each project's configured color.
3. **Automated checks.** All `41` frontend-mobile tests pass.
4. **Live route.** The merged server is running from `/data/data/com.termux/files/home` on `http://127.0.0.1:50150/`; `/` and `/decision-os/projects` return HTTP `200`, and the served `/src/mobile.js` contains the project hierarchy code.
5. **Interaction gate.** The live URL was opened in the Android browser. Automated touch verification is blocked because Termux Chromium cannot start its network service under Android linker isolation and UI Automator cannot create its Dalvik cache from the Termux UID. Operator observation of project navigation remains required.

---

## E. Android Correction Evidence

1. **Observed failure.** On `http://127.0.0.1:50150/` in Brave on Android, the operator selected a project and captured `Screenshot_20260713_124359_Brave.jpg`; the project row and ledger row remained visible at the same time.
2. **First incorrect transition.** `renderControlRoom()` always populated the project row. Selecting a project changed `state.projectFilter` and revealed the ledger row, but did not hide or clear the project row. This was a local UI-state-to-DOM defect; no request or persisted-state transition is involved in switching these filters.
3. **Correction.** Control Room now mounts exactly one row: the initial project row contains `All projects` followed by compact full-color project buttons; selecting a project replaces it with that project's ledger row; the final `Clear` control resets both filters and restores the project row.
4. **Automated evidence.** JavaScript syntax validation and all `45` combined frontend-mobile tests pass. The regression asserts mutually exclusive row visibility, project-color styling, compact dimensions, scoped ledger buttons, trailing clear placement, and the clear-state transition.
5. **Served target.** The running Termux-home server returns HTTP `200` for `/` and `/decision-os/projects`; its served `/src/mobile.js` and `/assets/mobile.css` contain the correction from merge commit `b07e4dc`.
6. **Remaining gate.** The corrected row replacement requires operator observation in Brave before this interaction card can move to ledger status `done`.
