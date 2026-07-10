## A. Scope

1. **Pipeline run:** `codex-pipeline-1783693845820-12a529f3`; quality step `codex-step-7ba49949`.
2. **Input:** `card-codex-skill-1783677425436-5b265c7f`, covering the reusable Codex pipeline implementation batch.
3. **Iteration boundary:** Reviewed and corrected only product and test files listed in the implementation Worker Results. Unrelated Decision OS state, cards, threads, run artifacts, and operator changes were left unchanged.
4. **Primary evidence:** `start-codex-pipeline-run-controller.ts` was `376` lines and owned manifest derivation, filesystem path derivation, ledger writes, validation, persistence, event publication, and process launch.

---

## B. Corrections

1. **Controller ownership:** Reduced `backend/src/business/codex/controller/start-codex-pipeline-run-controller.ts` from `376` to `251` lines. The controller now owns the single pipeline-start lifecycle: validate, prepare durable state, publish startup, and launch the first skill.
2. **Manifest helper:** Added `backend/src/business/codex/helper/create-codex-pipeline-run-manifest.ts` as the pure owner of pipeline and skill run IDs, resolved model and effort snapshots, output card IDs, timestamps, and artifact paths.
3. **Ledger effect:** Added `backend/src/business/codex/effect/create-codex-pipeline-step-cards.ts` as the single owner of generated card creation, relationship chaining, hydrated-note stripping, and final ledger persistence.
4. **Path helper:** Added `backend/src/business/codex/helper/resolve-codex-pipeline-run-directory.ts`; removed path derivation from `codex-pipeline-runner.ts` so manifest construction no longer imports process-spawning behavior for a filesystem calculation.
5. **Authoritative option catalog:** Moved `codexModelOptions` and `codexEffortOptions` to `shared/schemas/codex-pipeline-types.ts`. Backend command resolution and frontend controls now import the same runtime values and derived types.
6. **Type safety:** Strengthened `isAllowedCodexModel` and `isAllowedCodexEffort` into type guards. Temporary pipeline construction now accepts `CodexModel` and `CodexEffort` directly and contains no `any` casts.
7. **Branch intent:** Added concrete `WHAT` and `WHY` comments around pipeline lock, reference, shape, persistence, callback, and launch branches touched by the refactor.
8. **Contract test alignment:** Updated `frontend/test/runtime/input-controller-routing.integration.test.ts` to assert the shared option-catalog import and re-export instead of requiring duplicated frontend literals.

---

## C. Behavior Preserved

1. **Compatibility IDs:** Temporary direct-skill runs retain the `codex-skill-*` run ID and `card-codex-skill-*` output card contract. Saved pipelines retain `codex-pipeline-*` IDs and ordered `-step-*` output cards.
2. **Option precedence:** Explicit run settings still precede skill-library defaults, followed by the existing workspace, environment, and built-in fallback selection.
3. **Durability order:** The complete generated card chain is still written before the run manifest, workspace lock, startup event, and first Codex process launch.
4. **Failure contract:** Existing `400`, `404`, `409`, and `500` start responses remain owned by the controller and runner boundaries that produced them.
5. **Artifact layout:** JSONL and stderr artifacts remain under `.decision-os/runs/codex-skills/<ledger-stem>/` with the existing run-derived filenames.

---

## D. Changed Files

1. **Backend controllers:** `backend/src/business/codex/controller/start-codex-pipeline-run-controller.ts`, `backend/src/business/codex/controller/start-card-skill-process-controller.ts`.
2. **Backend helpers and effects:** `backend/src/business/codex/helper/create-codex-pipeline-run-manifest.ts`, `backend/src/business/codex/helper/resolve-codex-pipeline-run-directory.ts`, `backend/src/business/codex/effect/create-codex-pipeline-step-cards.ts`, `backend/src/business/codex/helper/codex-pipeline-runner.ts`, `backend/src/business/codex/helper/resolve-codex-command.ts`.
3. **Shared and frontend:** `shared/schemas/codex-pipeline-types.ts`, `frontend/src/runtime/codex/helper/codex-run-options.ts`, `frontend/test/runtime/input-controller-routing.integration.test.ts`.

---

## E. Verification Boundary

1. **Not run:** No test, typecheck, build, browser scenario, formatting command, or commit was executed. This is required by the `code-quality-improver` execution boundary.
2. **No green claim:** The implementation workers' pre-quality results remain historical evidence; they do not verify the refactored source.
3. **Required next action:** Run `npm run test:front-back` from `/home/jbb/dev/EditorBP/decision-os`. Attribute and correct every failure before delivery.

---

## F. Remaining Quality Debt

1. **Frontend polling concentration:** `frontend/src/runtime/codex/effect/poll-card-skill-run.ts` remains `1133` lines and owns both direct-skill polling and pipeline-step polling. A dedicated follow-up should separate those two lifecycles while retaining the current cached state, continuation, cancellation, restart, timer, and SSE-resume contracts.
2. **Modal concentration:** `render-card-process-modal.ts` and `render-pipeline-editor-modal.ts` remain above `700` lines. Their state transitions and rendering helpers need dedicated component extraction after the post-refactor test baseline is green.
3. **Decision:** These broader frontend splits were not mixed into this correction because the selected backend extraction and shared-catalog repair were the smallest structural changes with direct evidence and bounded behavior impact.
---

Codex run completed: exit code 0
