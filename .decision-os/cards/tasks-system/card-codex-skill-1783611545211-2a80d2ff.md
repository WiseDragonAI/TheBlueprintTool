## A. Engineering Completeness Findings

1. **Source audited:** `card-codex-skill-1783595913386-e48acfb6` from `/home/jbb/dev/EditorBP/decision-os/.decision-os/tasks-system.json`; upstream evidence checked includes `card-codex-skill-1783591708289-5fd90c7c`, `card-codex-skill-1783590897494-9dd2d021`, `card-codex-skill-1783496502245-a5e66232`, `card-codex-skill-1783495869207-759e2295`, and `card-codex-skill-1783502837104-b19e9e59`.
2. **Architecture finding:** the group split is coherent. `G01` owns the shared schema, `.decision-os/codex-pipelines.json` store, and library routes before `G02` moves process ownership into the pipeline runner. This matches current code evidence: `backend/src/business/codex/controller/start-card-skill-process-controller.ts` owns output-card creation, process spawn, JSONL/log paths, and `runtime.codexSkillRuns`; `backend/src/business/codex/controller/read-card-skill-run-controller.ts` derives status from run files and writes thread notes.
3. **Data finding:** `T01` and `T02` cover the durable objects needed for saved pipelines, saved reusable steps, ordered skills, generated step cards, per-skill run ids, pending steps, failed skills, cancelled runs, and resumed runs. The absent-store normalization in `T02` is enough for migration because no existing `.decision-os/codex-pipelines.json` store needs conversion.
4. **API finding:** `T03`, `T04`, `T05`, `T10`, `T11`, and `T12` cover list, save, start, direct-skill compatibility, read, cancel, restart, resume, and frontend request contracts. The existing active step-skill continue route remains usable through `frontend/src/runtime/codex/effect/request-card-skill-run-continue.ts`; `T11` then reassesses the pipeline after that continued run settles.
5. **UI finding:** `G04` correctly keeps `T13`, `T14`, `T15`, `T16`, `T22`, and `T24` together because `frontend/index.html`, `frontend/src/runtime/dom.ts`, `frontend/src/runtime/input/controller/handle-action-click.ts`, `frontend/src/runtime/codex/effect/render-skill-modal.ts`, and `frontend/assets/canvas/dialogs.css` are shared by the Process card modal, Pipelines modal, Edit pipeline modal, direct skill path, and runbook text.
6. **Runtime-state finding:** `G05` waits for `G02` and `G04`, which is necessary because the step-skill widget and SSE refresh need persisted run detail, generated step cards, modal start flows, and backend events from `backend/src/business/server/helper/create-http-server.ts` plus `frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts`.
7. **Verification finding:** the plan names the right evidence channels: backend store and route tests in `T19`, backend fake-Codex lifecycle tests in `T20` and `T21`, frontend request and modal tests in `T22`, and browser workflow coverage in `T23`.

---

## B. Fundamental Missing Tasks

1. **None found:** no missing architecture, data model, state transition, API contract, UI behavior, config change, migration, fixture, test strategy, or handoff task was found that would make implementation fail after the stated gates.
2. **Continue-path audit:** the only precision risk is the word `continue` in `T10`. The required implementation path is already covered without a new task: reuse the existing active run continuation surface for the current step-skill run, then use `T11` settled callbacks and `T08` reassessment to advance the pipeline.
3. **Deletion and duplication audit:** older screen planning mentioned duplicate and delete controls, but the final visual source narrows the UI to `Process card`, `Pipelines`, and `Edit pipeline`. The current tasks cover the durable create, edit, save, insert, reorder, and invalid-reference behavior required by the reduced scope.

---

## C. Input Card Edits Applied

1. **Edits applied:** none.
2. **Reason:** no fundamental implementation task gap was found, so the input dependency card did not need repair.
3. **Source-card safety:** `card-codex-skill-1783595913386-e48acfb6` was not edited, and `/home/jbb/dev/EditorBP/decision-os/.decision-os/tasks-system.json` was not edited manually.

---

## D. Dispatch-Ready Groups

1. **`G01` with `T01`, `T02`, `T03`, and `T19` is ready first.** Target files include `shared/schemas/core-types.ts`, `shared/schemas/codex-pipeline-types.ts`, `backend/src/business/codex/helper/codex-pipeline-store.ts`, `backend/src/business/codex/controller/list-codex-pipelines-controller.ts`, `backend/src/business/codex/controller/save-codex-pipeline-controller.ts`, and backend store/library tests. Verification must cover absent store, saved pipeline round-trip, saved step reuse, duplicate ids, invalid references, and route responses.
2. **`G02` with `T04`, `T05`, `T06`, `T07`, `T08`, `T09`, `T10`, `T11`, `T20`, and `T21` is ready after `G01`.** Target files include `start-codex-pipeline-run-controller.ts`, `start-card-skill-process-controller.ts`, `codex-pipeline-runner.ts`, `build-pipeline-skill-prompt.ts`, `read-codex-pipeline-run-controller.ts`, `cancel-codex-pipeline-run-controller.ts`, `restart-codex-pipeline-run-controller.ts`, `resume-codex-pipeline-runs.ts`, `create-http-server.ts`, and backend Codex lifecycle tests. Verification must use a fake Codex fixture with `S = 3` and `K = 5`, then cover ordered starts, distinct run files, stage input handoff, active lock release, cancel, restart clearing, and resume without duplicate runs.
3. **`G03` with `T12` is ready after backend contracts stabilize.** Target files include `load-codex-pipelines.ts`, `request-codex-pipeline-save.ts`, `request-codex-pipeline-run.ts`, and `request-codex-pipeline-run-status.ts`. Verification must assert typed request bodies, URLs, error-return behavior, status parsing, cancel parsing, and restart parsing.
4. **`G04` with `T13`, `T14`, `T15`, `T16`, `T22`, and `T24` is ready after `G03`.** Target files include modal hosts, action routing, `render-card-process-modal.ts`, `render-pipelines-modal.ts`, `render-pipeline-editor-modal.ts`, `skill-category.ts`, `dialogs.css`, request integration tests, routing tests, modal tests, and runbook text. Verification must cover Process card tabs, direct skill processing, saved pipeline selection, empty and expanded libraries, editor save payloads, per-skill model/effort, insertion position, and runbook wording.
5. **`G05` with `T17`, `T18`, and `T23` is ready after `G02` and `G04`.** Target files include `render-card-skill-run-widget.ts`, `poll-card-skill-run.ts`, `subscribe-ledger-content-events.ts`, `resize-selected-cards-to-content.ts`, `objects.css`, `create-http-server.ts`, and `tests/browser/codex/reusable-step-pipelines.spec.ts`. Verification must cover pending widgets, running widgets, failed state, cancelled state, continue action, restart action, SSE refresh, completed-card resize, and the browser scenario from pipeline creation to visible generated step cards.

---

## E. Blocking Questions

1. **None:** repo evidence and source-card evidence are sufficient for implementation dispatch.
2. **Config needs:** no new environment variable, settings file, server port, or API-key behavior is required by this grouping plan.
3. **Fixture needs:** all required fixtures are implementation-test fixtures, not planning blockers: normalized store fixtures for `G01`, fake Codex process fixtures for `G02`, fetch fixtures for `G03`, DOM modal fixtures for `G04`, and browser workspace fixtures for `G05`.

---

## F. Dispatch Readiness

1. **Final status:** `ready`.
2. **Dispatch rule:** run groups through the gates in this order: `G01`, `G02`, `G03`, `G04`, then `G05`.
3. **Residual risk:** `backend/src/business/server/helper/create-http-server.ts` is shared by backend library routes, run routes, settled callbacks, and SSE refresh, so implementation should land route changes in gate order and keep tests focused on that file.
4. **Audit boundary:** no product code was implemented and no implementation tests were run during this audit.
---

Codex run completed: exit code 0
