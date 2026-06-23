## A. Existing Pipeline Baseline

1. **State model:** DroidFactory already treated `GitLab issues + labels` as the workflow state machine. The documented lifecycle used `status:*` labels such as `status:todo`, `status:awaiting`, `status:needs_review`, `status:accepted`, and `status:done`, plus `proto:*` labels such as `proto:feature_overview`, `proto:research`, `proto:system`, `proto:task`, and `proto:bug`.
2. **Role pipeline:** The intended stage chain was `SALES_REP -> RESEARCH_PLANNER -> RESEARCHER -> RESEARCH_MASTER -> PRODUCT_MANAGER -> SYSTEM_ENGINEER -> CTO -> IMPLEMENTATION -> STABILIZATION`, with each role owning a prompt and producing a durable artifact before the next stage.
3. **Runner concept:** The prior runner contract centered on `agent-runner`, role prompts, repo-local MCP configuration, Codex or Claude full-auto execution, and issue content as the user prompt.
4. **Human gates:** The docs explicitly required visible human blocking points, visible stage transitions, and verification gates before merge readiness.
5. **Durable outputs:** Issues, issue notes, wiki pages, prompts, test artifacts, and worktree evidence were meant to be durable handoff artifacts instead of transient chat context.
6. **Run records:** `.droidmaster/test-mcp/finished/*.json` already stores task execution records with `run_id`, `root_dir`, `cwd`, `domains`, selectors, `scope_summary`, per-domain status, logs, summary paths, artifact directories, queue timestamps, heartbeats, and deadlines.

---

## B. Existing Operator Surfaces

1. **Operator MCP:** DroidFleet already contains operator MCP surfaces for `ui.progress`, `ui.file_ref`, `ui.image_ref`, `ui.url_ref`, approval-style events, and file-refresh events.
2. **Task visibility:** The app already contains conversation/tool-call rendering and a git tree/file panel capable of opening working-tree diffs and commit diffs through backend routes.
3. **Diff infrastructure:** The backend already exposes git diff behavior through routes such as `/git/diff` and `/git/commit-diff`, with parsing support for `git diff-tree` file lists.
4. **Test runner telemetry:** The test MCP scheduler already records queued and finished runs with log paths, last heartbeat, last line, status, and artifact locations.
5. **TUI/reporting idea:** Factory docs already called out KPI and TUI reporting requirements for elapsed time, stage attribution, quality outcomes, event reconciliation, and rollback/evidence metadata.

---

## C. What Was Not Finished

1. **No unified cockpit:** Existing pieces do not converge into one operator-facing task screen that shows all projects, queued work, active agents, required reviews, artifacts, and next decisions.
2. **No first-class task bundle:** A task run is not yet represented as a single durable object that joins issue/card, stage, prompt, agent session, worktree, diff, logs, artifacts, review request, and operator response.
3. **No review dashboard contract:** The previous system had the idea of operator review/input, but no implemented contract for rendering a rich review page with summaries, diffs, evidence, screenshots, HTML previews, and explicit decision controls.
4. **No cross-project queue:** The prior work could run pipeline stages, but it did not become a queue where the operator can launch longer chains, inspect many parallel tasks, and sequence follow-up work across repositories.
5. **No reliable diff-first review:** Diff infrastructure exists in DroidFleet, but the task workflow does not yet force every review gate to expose the exact changed files, unified diffs, commits, generated artifacts, and test evidence in the review surface.

---

## D. Source Evidence

1. **Factory overview:** `/home/jbb/dev/DroidFleet/factory/DROIDFACTORY-OVERVIEW.md`.
2. **Pipeline architecture:** `/home/jbb/dev/DroidFleet/documentation/documentation/factory/pipeline/pipeline-architecture.md`.
3. **Pipeline contract:** `/home/jbb/dev/DroidFleet/documentation/specs/factory/pipeline/pipeline-contract.md`.
4. **Runner contract:** `/home/jbb/dev/DroidFleet/documentation/specs/factory/pipeline/runner-contract.md`.
5. **Factory execution procedure:** `/home/jbb/dev/DroidFleet/documentation/procedure/factory/pipeline/factory-execution.md`.
6. **Issue lifecycle:** `/home/jbb/dev/DroidFleet/documentation/documentation/factory/pipeline/issue-lifecycle.md`.
7. **Operator MCP and diff surfaces:** `/home/jbb/dev/DroidFleet/backend/src/mcp/operator_mapping.ts`, `/home/jbb/dev/DroidFleet/backend/src/http/routes/git_tree.ts`, and `/home/jbb/dev/DroidFleet/app/lib/app/app_file_panel.dart`.
8. **Run ledger:** `/home/jbb/dev/.droidmaster/test-mcp/finished/*.json`.