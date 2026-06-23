## A. Correct Problem

1. **The missing product is a Business OS decision/task cockpit.** The operator needs the commercial `business-os-mock` model translated into CoreV2’s durable ledger system.
2. **The old analysis used the wrong source.** The relevant prior work is not DroidFactory GitLab labels; it is a web mock with a Content MCP data model, task instances, pipeline templates, stage builder, decision ledger, and operator gates.
3. **The current CoreV2 card workflow is too loose for task operations.** Cards and threads can capture discussion, but they do not yet provide the structured `task_instance -> operator decision -> execution -> artifact -> next stage` loop from the commercial mock.
4. **Parallel task handling lacks a task-shaped data model.** When several tasks are active, the operator needs one ledger of task instances, grouped by pipeline/workspace, with the next decision and evidence visible.
5. **Artifacts are not first-class enough.** The commercial mock expects prompt artifacts, script artifacts, generated HTML, summaries, screenshots, reports, and task context to be attached to decision tasks.

---

## B. Why The Commercial Model Matters

1. **It already separates concepts correctly:** `task_instances`, `response_tasks`, `task_claims`, `task_executions`, `automation_runs`, `automation_checkpoints`, templates, and schedules are separate entities.
2. **It is operator-centered:** The `Decisions` route shows one actionable task with recommendation, risk, draft, actions, and previous agent context.
3. **It supports reusable automation:** Pipelines are not just running agents; they are composed from reusable stages, prompts, scripts, triggers, and operator gates.
4. **It is multi-workspace:** Team/workspace/client/account scope is part of the UI, which is necessary for managing several work streams.
5. **It matches CoreV2’s ledger philosophy:** CoreV2 can provide the durable object graph, routes, threads, events, generated reports, runtime data, and persisted UI state that the commercial mock needs.

---

## C. Actual Operator Pain

1. **Too many open tasks become hard to triage.** The operator wants to run more work, but needs a structured list of current decision tasks rather than hunting through cards and conversations.
2. **The next action is unclear.** Each task should say whether the operator must approve, delegate, request changes, answer a question, inspect an artifact, or wait for automation.
3. **Evidence is scattered.** Summaries, prompt output, scripts, generated previews, diffs, test runs, screenshots, and chat context must converge into the active decision task.
4. **Long pipelines need gates.** Multi-stage work is viable only if agent/script stages can pause into operator gates with durable review payloads.
5. **The UI must remain focused.** The cockpit should not become a noisy generic dashboard; it should expose exactly the queue and decision surfaces needed to keep work moving.

---

## D. Corrective Principle

1. **Make `TaskInstance` the primary operational object.** A task instance owns status, subject, pipeline, next turn, decision payload, agent summaries, actions, artifacts, and execution lineage.
2. **Make `OperatorGate` first-class.** A gate is not a note; it is a stage that pauses automation, renders a decision task, captures an operator action, and resumes or reroutes the pipeline.
3. **Make artifacts typed.** Treat prompt, script, markdown, generated HTML, screenshot, file ref, diff, test report, and execution log as typed artifacts linked to the task.
4. **Make templates reusable.** Pipelines, stages, prompts, and scripts need versioned library records with workspace/team permissions and draft/promotion flows.
5. **Make routes semantic.** CoreV2 should expose route-addressable `decisions`, `pipeline`, `pipeline/new`, `stages`, `workspace`, and `team` views rather than burying task state inside card threads.

---

## E. Acceptance Criteria

1. **Decision record:** A CoreV2 task record can render the same minimum decision card as the commercial mock: title, sections, recommendation, risk, draft, actions, and previous agent context.
2. **Pipeline record:** A pipeline can define identity, trigger, ordered stages, stage types, prompt/script artifacts, and operator gates.
3. **Operator gate:** A pipeline run can pause at an operator gate, create a decision task, persist the operator action, and continue or reroute.
4. **Artifact review:** A decision task can show attached markdown, generated HTML, prompt, script, screenshot, report, and diff artifacts.
5. **Scope and filtering:** The UI can group tasks by team, workspace, pipeline type, pipeline, status, and next turn.
