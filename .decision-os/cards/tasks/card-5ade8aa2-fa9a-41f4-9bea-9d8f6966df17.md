## A. Corrected outcome

1. The **Done** destination now renders one vertical task column at every viewport width.
2. Filters follow the Control Room drill-down: projects are shown first; selecting a project hides projects and reveals only that project's labels plus `Clear`.
3. Each task receives its canonical `Completed at` timestamp from card Markdown.
4. Completion-date sorting supports `Newest first` and `Oldest first`; `Newest first` is the default.

---

## B. Contradicted-success root cause

1. Reproduction at `http://127.0.0.1:50151/done` showed the first two cards at the same Y position, proving the desktop CSS forced two columns.
2. The initial DOM exposed both project and label groups before any selection, unlike `renderControlRoom`, which hides the secondary filter until a project is selected.
3. The v13 task projection exposed labels but never parsed the canonical `Completed at` field, so the UI had no completion date to display or sort.
4. The first incorrect transition was `renderDone` bypassing the existing project-first disclosure model; the independent two-column CSS and missing projection field compounded the mismatch.

---

## C. Implementation

1. Added projection contract `control-room-v14-completion-time` with normalized `completedAt` and numeric `completedTime`.
2. Added stable date sorting that keeps tasks without a verified completion timestamp after dated tasks in both directions.
3. Added visible completion dates, a completion-order selector, project-first label disclosure, and single-column desktop styling.
4. Added a served Playwright regression covering direct `/done`, geometry, dates, both sort directions, project selection, label filtering, and page errors.

---

## D. Verification evidence

1. Focused frontend regressions passed `55/55`; focused backend regressions passed `13/13`.
2. Frontend and backend typechecks passed.
3. Repository frontend tests passed `511/511`; repository backend tests passed `263/263`.
4. The focused served-browser regression passed.
5. The operator server now renders one column, project-first disclosure, `41` project-scoped label controls, and default `desc` ordering without page errors.

---

## E. Runtime state

1. The correction is merged and pushed to `main` at `9083c9f8`.
2. The operator server still runs projection v13 because repository policy forbids an unrequested restart.
3. Its frontend therefore shows `Completion date unavailable`; restarting onto v14 is the remaining operator-surface gate for populated dates and live date-order verification.

---
