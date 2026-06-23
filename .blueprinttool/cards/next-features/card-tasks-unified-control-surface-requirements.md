## A. Target Capability

1. **Unified task cockpit:** Build one operator surface that lists every active and queued task across selected workspaces, repositories, cards, issues, and pipelines.
2. **Queue control:** Let the operator queue single tasks, ordered task chains, and longer pipeline runs instead of repeatedly driving each increment from chat.
3. **Agent pipeline visibility:** Show the current stage, assigned role or agent, prompt source, active session, elapsed time, last heartbeat, last meaningful event, and next expected transition.
4. **Operator action inbox:** Surface all tasks waiting for operator review, approval, clarification, file selection, design choice, or manual input in one place.
5. **Review dashboard:** For every operator gate, generate a review view that can include summary, changed files, unified diffs, commits, test results, screenshots, generated HTML, artifacts, risks, and exact decision buttons.

---

## B. Task Record Contract

1. **Identity:** Store a stable `taskId`, source workspace, source ledger/card or GitLab issue, pipeline id, stage id, role id, and parent/child task links.
2. **Execution:** Store runner command, agent runtime, model, prompt file, resolved prompt text hash, worktree path, process id, session id, started/finished timestamps, heartbeat, status, and retry count.
3. **Evidence:** Store commit hash, branch, merge request, changed file list, diff refs, generated files, screenshots, HTML preview refs, logs, test summary paths, and artifact directory.
4. **Operator gate:** Store gate type, required decision, display payload, answer schema, deadline if any, operator response, response timestamp, and the pipeline transition produced by that response.
5. **Durability:** Persist the record under `.blueprinttool/tasks/` or another workspace-local store before UI rendering, so the cockpit can recover after server restart.

---

## C. Review Surface Requirements

1. **Diff-first layout:** The review view must make changed files and diffs immediately visible, not buried in chat logs or separate file panels.
2. **Artifact slots:** The review payload must support Markdown summary, code snippets, file refs, image refs, video/audio refs, HTML preview refs, and arbitrary generated report files.
3. **Decision controls:** The operator must be able to approve, request changes, ask a question, attach evidence, or route the task back to a named stage.
4. **Context compression:** The view should include the minimum summary needed to decide, plus expandable raw logs and full conversation details for audit.
5. **Cross-project filtering:** The cockpit needs filters for workspace, project, pipeline, status, waiting-on-operator, running, failed, completed, and stale.

---

## D. Pipeline Requirements

1. **Stage DAG:** Represent each pipeline as a typed DAG of stages where each stage has an input contract, prompt, runner, exit criteria, and allowed next states.
2. **Operator stage:** Support first-class operator stages that pause execution and render a review dashboard instead of relying on ad hoc chat messages.
3. **Long task chains:** Allow a pipeline to enqueue `task A -> task B -> task C` and continue only when each stage produces accepted evidence.
4. **Parallel task management:** Allow 3 to 5 active tasks to be monitored without forcing the operator to remember which chat, card, or diff belongs to which task.
5. **Failure recovery:** Every failed task should show failed command, last log line, artifacts, likely owner, retry options, and whether a fresh session or resumed session is required.

---

## E. Integration Requirements

1. **Reuse existing pieces:** Reuse CoreV2 cards/threads for planning, DroidFleet git diff routes for diff display, operator MCP file refs for artifacts, and `.droidmaster/test-mcp` style run records for execution telemetry.
2. **Do not hide provenance:** Every UI element must link back to the source card/issue, source workspace, worktree, branch, commit, diff, prompt, logs, and generated artifacts.
3. **Incremental path:** First implement the durable task record and review dashboard for CoreV2 card-triggered tasks, then add GitLab issue pipeline import, then add cross-project aggregation.
4. **No chat-only state:** Chat can narrate the run, but the task cockpit must be reconstructable from durable task records and artifact files.
5. **Acceptance:** The operator can open one page and answer: what is running, what is blocked on me, what changed, which diffs need review, what evidence exists, and what action is required next.
