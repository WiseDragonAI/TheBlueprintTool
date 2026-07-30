## A. Goal and Product Scope

1. **Goal need:** preserve an operator's unsaved pipeline `name` and `purpose` while the operator changes the pipeline's step and skill collections.
2. **Affected product area:** the reusable pipeline editor on the responsive application surface. `frontend/src/runtime/surface-runtime.ts` routes `/pipelines` to `bootApplication()`, which loads `frontend/src/app/responsive/application.js` and `frontend/src/app/responsive/codex.js`.
3. **Affected workflow:** open a new pipeline or an existing pipeline, edit its `Name` and `Purpose`, add, remove, or reorder steps and skills, then save the pipeline.
4. **Affected actor:** a Decision OS operator authoring a project-scoped or server-scoped reusable pipeline.
5. **Relevant context fact:** `clonePipeline()` places the last saved `name` and `purpose` in `state.editor`; `renderEditor()` copies those state values into the form controls.
6. **Current behavior:** the responsive editor does not copy edits from `pipeline-name` and `pipeline-purpose` into `state.editor` until `saveEditor()` runs. Every step addition, step removal, step reorder, skill removal, skill reorder, and skill-picker return calls `renderEditor()` first. That render replaces the unsaved control values with the stale values in `state.editor`.
7. **First incorrect transition:** `frontend/src/app/responsive/codex.js:515-518` rehydrates the form from stale draft metadata after a collection mutation. Step fields do not have this defect because their `input` handlers update their draft objects immediately at `frontend/src/app/responsive/codex.js:524-525`.
8. **Persistence boundary:** `saveEditor()` copies the currently visible form values into `state.editor`, builds the request, and submits them to the project or server pipeline endpoint. The backend accepts and persists `pipeline.name` and `pipeline.purpose`; the loss occurs before the request boundary.
9. **Expected behavior:** pipeline `name` and `purpose` remain equal to the operator's current unsaved values throughout every in-editor step and skill collection edit, then the save request carries those exact trimmed values.
10. **Acceptance signal:** after entering pipeline metadata, each collection action leaves both controls unchanged; the subsequent `POST` or `PUT` body contains the same metadata; reopening the saved pipeline returns the persisted values.

---

## B. Linked Specifications

1. **Spec `cef65c97` — “Playwright for real browser interaction tests”:** the source is `tests/browser/codex/reusable-step-pipelines.spec.ts:359-360`. It **constrains** acceptance evidence to a real browser interaction. Its current pipeline scenario exercises the canvas editor and does not cover the responsive editor's metadata transition.
2. **Spec ID `unknown` — “mobile pipeline editor supports ordered steps, ordered skills, inheritance, and persistence”:** the source is `frontend/test-responsive/mobile-codex.test.mjs:63-73`. It **supports** step and skill mutation plus persistence as responsive product behavior, but its assertions inspect source patterns and do not verify that unsaved pipeline metadata survives those mutations.
3. **No code-owned behavioral spec ID was found** for preservation of unsaved pipeline metadata during responsive editor re-renders. This is a **source gap**, not evidence that the behavior is outside the product contract.

---

## C. Missing Specifications

1. **Implied requirement:** the editor draft must retain all unsaved pipeline-level fields while the same open editor session mutates nested step and skill collections.
2. **Missing acceptance signal:** no responsive interaction check enters `Name` and `Purpose`, performs each collection mutation, and proves the controls still contain the entered values before save.
3. **Missing UX specification:** the inspected source does not define draft-retention behavior while moving between the pipeline editor and the skill picker.
4. **Missing technical specification:** the inspected source does not declare the authoritative draft boundary for pipeline-level form fields during `renderEditor()` calls.
5. **Missing data specification:** no inspected test asserts exact responsive `POST` and `PUT` payload values for pipeline `name` and `purpose` after nested collection edits.
6. **Missing operational specification:** no inspected source defines telemetry or diagnostics for client-local draft loss before a save request. The operational acceptance need is **unknown**.

---

## D. Specification Gaps

1. **Contradiction:** the responsive test title claims pipeline persistence support, while the implemented renderer can discard pipeline metadata before persistence.
2. **Unknown:** the inspected source does not specify whether draft retention ends when the editor closes or extends across a later reopen without saving.
3. **Unverified fact:** this stage establishes the causal source path but did not execute the responsive interaction on a served browser target.
4. **Source gap:** the real-browser pipeline scenario targets the canvas surface; the responsive test uses static source assertions.
5. **Ownership gap:** the responsive editor in `frontend/src/app/responsive/codex.js` and the canvas editor in `frontend/src/runtime/codex/effect/render-pipeline-editor-modal.ts` own separate draft-state transitions. No inspected code contract requires equivalent metadata retention.
6. **Product-boundary decision:** preservation within one open editor session is implied by the stated goal; preservation after leaving the editor remains unspecified.
7. **Technical constraint:** every call to responsive `renderEditor()` writes `state.editor.name` and `state.editor.purpose` into the live controls.
8. **UX constraint:** collection actions visibly refresh the editor, so draft metadata must remain stable through that refresh without requiring an early save.
9. **Data constraint:** the shared `CodexPipeline` contract requires `name` and `purpose`, while the save controller trims both fields before durable persistence.
10. **Dependency constraint:** `closePicker()` returns from skill selection by calling `renderEditor()`, making the skill-picker round trip part of the same draft-retention contract.

---

## E. Behavioral Acceptance Criteria

1. **New pipeline:** typed `Name` and `Purpose` survive adding a step, removing a step, and moving a step.
2. **Existing pipeline:** edited `Name` and `Purpose` survive adding a skill, removing a skill, moving a skill, and returning from the skill picker.
3. **Project scope:** the project pipeline save request contains the retained, trimmed `name` and `purpose`.
4. **Server scope:** the server pipeline save request contains the retained, trimmed `name` and `purpose`.
5. **Durable result:** after a successful save and fresh pipeline load, the saved pipeline exposes the retained metadata together with the edited step order.
6. **Regression boundary:** browser evidence covers the responsive `/pipelines` route and observes the controls before save plus the exact request payload.
---

Codex run completed: exit code 0
