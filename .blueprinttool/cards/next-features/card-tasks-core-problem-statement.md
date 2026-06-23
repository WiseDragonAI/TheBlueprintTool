## A. Problem

1. **Current task management does not scale past a few parallel tasks.** After 3 to 5 concurrent tasks, the operator must remember which card, chat, worktree, diff, log, artifact, and decision belongs to each task.
2. **The critical review evidence is fragmented.** Diffs live in git/file panels, execution state lives in logs or run records, requirements live in cards/issues, and operator discussion lives in threads or chat.
3. **The system lacks an authoritative next-action surface.** There is no unified place that says which task needs operator input, what exactly changed, why it matters, and which decision unblocks the pipeline.
4. **Longer autonomous pipelines are risky without review checkpoints.** If agents run longer task chains without a durable review dashboard, the operator loses visibility into intermediate outputs, diffs, and quality gates.
5. **Chat is being used as an orchestration memory.** That makes the workflow fragile because task state, evidence, and decisions should be stored as durable task records, not inferred from conversation history.

---

## B. Why It Matters

1. **Operator throughput is capped:** The operator wants to launch more work, but the cognitive load of finding diffs and reconstructing task state blocks parallelism.
2. **Review quality drops:** If the changed files, test evidence, and artifacts are not one click away from the review request, approvals become slower and less reliable.
3. **Pipeline confidence drops:** A task chain can only be trusted when every stage has explicit inputs, outputs, evidence, and visible gates.
4. **Existing investments stay underused:** DroidFactory stages, operator MCP UI events, git diff routes, test runner records, and CoreV2 cards are valuable but currently disconnected.

---

## C. Corrective Principle

1. **Make the task the primary object.** A task must own its pipeline state, agent run, worktree, diff set, artifacts, review gates, and operator decisions.
2. **Make review evidence first-class.** Every operator gate must render a dashboard where diffs, files, screenshots, HTML previews, logs, tests, and decision controls are part of the contract.
3. **Make queue state durable.** Running, blocked, failed, stale, and completed tasks must be loaded from durable records after restart.
4. **Make cross-project work scannable.** The operator should see all active tasks across projects with the same mental model: status, owner, evidence, next action.
5. **Make long pipelines composable.** Longer queues are acceptable only when each stage produces inspectable evidence and can pause for operator input without losing context.

---

## D. First Implementation Cut

1. **Task record store:** Add `.blueprinttool/tasks/<taskId>.json` records with source card, status, runner metadata, worktree, artifacts, changed files, diff refs, and operator gate fields.
2. **Tasks cockpit route:** Add a CoreV2 route or panel that lists active task records and highlights `waiting_on_operator`, `running`, `failed`, and `stale`.
3. **Review dashboard:** Add a detail view for one task that shows summary, diff list, selected diff content, test evidence, artifacts, logs, and decision controls.
4. **Queue trigger integration:** Connect the existing Processing Queue work to task record creation instead of only launching a headless Codex run.
5. **Evidence adapters:** Reuse existing git diff commands/routes and file refs rather than inventing a new diff or artifact transport.

---

## E. Acceptance Criteria

1. **One task:** A queued CoreV2 card creates a durable task record, launches an agent, records logs/artifacts, and exposes changed files plus diff content in the review dashboard.
2. **Many tasks:** At least 5 task records across 2 workspaces can be listed and filtered without opening individual chats.
3. **Operator gate:** A task can pause on `waiting_on_operator`, show a review payload, accept an operator decision, and continue or reroute according to the selected action.
4. **Recovery:** Restarting the CoreV2 server preserves the task list, latest status, review payload, and artifact links.
5. **Traceability:** From the task detail view, the operator can reach the source card/issue, prompt, agent session id, worktree, branch/commit, changed files, diffs, tests, and logs.
