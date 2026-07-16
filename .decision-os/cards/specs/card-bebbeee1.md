## A. Objective

1. **Implement two-stage filtering.** Organize and filter tasks first by project and then by ledger.

---

## B. Implementation

1. **Project filter.** Selecting a project shows that project's tasks.
2. **Ledger filter.** After project selection, show only ledgers belonging to that project and filter its tasks by the selected ledger.
3. **Cross-project view.** Preserve the unfiltered global task overview across projects.
4. **State transitions.** Clear an incompatible ledger selection when the selected project changes.

---

## C. Verification

1. **Filter coverage.** Test global tasks, project-only tasks, project-plus-ledger tasks, project switching, and project-scoped ledger options.

---

## D. Implementation Evidence

1. **Two stages.** Control Room renders project filters first. It renders ledger filters only after a project is selected and uses only that project's ledgers.
2. **State correction.** Changing the project filter resets the ledger filter to `All`; task counts and rows use both filters.
3. **Automated checks.** Frontend-mobile source-contract and task tests pass.
4. **Live route.** The project catalog and mobile filter bundle are served from `http://127.0.0.1:50150/` with HTTP `200`.
5. **Interaction gate.** Project and ledger filter behavior still requires one observed touch pass in the Android browser because browser automation is unavailable in this Termux environment.

---

## E. Contradicted Interaction RCA

1. **Evidence.** The operator's Brave Android screenshot from `http://127.0.0.1:50150/` shows the project chips and ledger chips stacked simultaneously after project selection.
2. **Root cause.** The first incorrect transition was in `renderControlRoom()`: the code conditionally exposed `#control-filters` after project selection but never conditionally hid or emptied `#control-project-filters`.
3. **Required interaction.** The filter is now a drill-down. The initial row displays `All projects` and full-color project controls. A project click replaces that row with the selected project's ledger tags. The horizontally scrollable ledger row ends with `Clear`, which resets `state.projectFilter` and `state.controlFilter` to `All` and returns to project selection.
4. **Visual contract.** Project controls use their configured project colors, a non-generic filled treatment, `34px` minimum height, and reduced vertical padding. Ledger tags remain visually distinct from project controls.
5. **Regression.** All `45` frontend-mobile tests pass, including the mutually exclusive row and reverse-transition contract. Merge commit: `b07e4dc`.
6. **Live delivery.** The active server serves the corrected bundle with HTTP `200`; the Android route was reopened. Final ledger completion remains gated on a fresh operator observation of the corrected click sequence.
