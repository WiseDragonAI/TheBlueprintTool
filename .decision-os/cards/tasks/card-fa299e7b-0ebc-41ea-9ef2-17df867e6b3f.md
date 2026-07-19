## A. Verified Inventory

1. **Pipeline:** `Full Exec` (`codex-pipeline-b2f78032`).
2. **Ordered stages:** `Tasks` → `Execution` → `Check and commit` → `Report`.
3. **Ordered skills:** `task-list` → `task-dependency` → `task-group-completeness` → `implementation-orchestrator` → `run-test-and-fix` → `code-quality-improver` → `implementation-commit` → `implementation-report`.
4. **Evidence:** `/home/jbb/.decision-os/codex-pipelines.json`, `backend/src/business/codex/helper/create-codex-pipeline-run-manifest.ts`, and `backend/src/business/codex/helper/codex-pipeline-runner.ts`.
