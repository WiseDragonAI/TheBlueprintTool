## A. Correct Target Capability

1. **Commercial Business OS cockpit:** Bring the `business-os-mock` decision cockpit concept into decision-os as a durable task surface backed by ledger-style data, not by GitLab labels.
2. **Focused next-decision UI:** Preserve the commercial mock principle that the operator should see the next required decision with sufficient context, rather than a broad generic dashboard.
3. **Task instance ledger:** Model tasks as first-class records similar to `task_instances`, with links to subjects, templates, pipelines, interactions, prior agent summaries, chat summaries, drafts, actions, claims, executions, and artifacts.
4. **Pipeline composition:** Support reusable pipelines with identity, trigger, ordered stages, and explicit stage types: `Agent`, `Script`, and `Operator gate`.
5. **Artifact inspection:** Every stage that produces or consumes a prompt, script, report, generated HTML, image, screenshot, diff, or markdown summary must expose that artifact in an inspectable review surface.

---

## B. Data Model Requirements

1. **Task identity:** Store `task_instance_id`, `task_template_key`, `pipeline_type_key`, `pipeline_key`, `pipeline_name`, `task_kind`, `task_status`, `next_turn`, priority, subject type, subject id, dedupe key, and workspace scope.
2. **Task context:** Store previous agent task id, previous agent summary, chat session summary, markdown decision summary, draft output, available actions, and chat excerpts.
3. **Task execution:** Store task claims, claimant ref, lease expiration, execution attempts, run status, retry data, dead-letter records, error events, alerts, automation run ids, and checkpoints.
4. **Entity links:** Link tasks to content entities, interactions, messages, leads, campaigns, publication targets, knowledge documents, generated reports, files, and runtime data.
5. **Template lineage:** Store task template, template version, pipeline version, reusable stage key, prompt version, script bundle, compilation diagnostics, and failure policy.

---

## C. UI Requirements

1. **Decision ledger:** Render task lists grouped by pipeline type and pipeline key, with the active task selected and the recommendation visible in the list item.
2. **Decision card:** Render the task markdown summary into sections such as relationship, latest signal, business state, agent summary, recommendation, risk, and outcome if approved.
3. **Agent chat:** Show previous agent summary, chat session summary, transcript, task context, and focused conversation lines next to the decision.
4. **Actions:** Support `Approve`, `Delegate`, `Request changes`, `Ask question`, `Reject`, and pipeline-specific actions as structured commands, not free-form-only replies.
5. **Delegation:** Keep delegation explicit with workspace members, roles, current workload, and the receiving workspace/team context.
6. **Scope controls:** Preserve team and workspace switching so the cockpit can show the correct client, workspace, accounts, API keys, pipelines, and tasks.

---

## D. Pipeline Requirements

1. **Pipeline library:** List workspace-scoped scheduled pipelines with purpose, ingestion sources, stages, output, cadence, next run, and active/paused state.
2. **Pipeline composer:** Let an operator or agent create a pipeline version by defining identity, trigger, ordered stages, and runnable artifacts.
3. **Stage contract:** Each stage must define name, reusable key, type, input contract, output contract, and an attached prompt or script when applicable.
4. **Operator gates:** Operator gates must pause execution and create a focused decision task with markdown summary, draft, actions, artifacts, and continuation metadata.
5. **Automation output:** Scheduled or immediate pipeline runs should produce task instances only when operator action is needed; safe cases can auto-complete with auditable execution records.

---

## E. Artifact Requirements

1. **Prompt artifacts:** Agent stages must expose the exact prompt or prompt version, editable markdown preview, and provenance.
2. **Script artifacts:** Script stages must expose the runnable script bundle or function name, syntax-highlighted preview, inputs, outputs, and last execution result.
3. **HTML/report artifacts:** Operator gates must be able to display generated HTML reports, markdown summaries, screenshots, canvas views, and file refs.
4. **Diff artifacts:** When the task changes local files, the decision task must link changed files and diffs as artifacts, but diff is only one artifact type, not the core data model.
5. **Audit artifacts:** Store decisions, overrides, actor metadata, timestamps, idempotency keys, outbox events, and failure diagnostics.

---

## F. First Implementation Cut

1. **Define decision-os task schema:** Add a workspace-local `.decision-os/tasks/` schema based on `task_instance`, `task_claim`, `task_execution`, `operator_gate`, `pipeline_stage`, and `artifact` records.
2. **Build decision route:** Add a `tasks` or `decisions` route/panel in decision-os that renders a decision ledger, one decision card, and an agent/context panel.
3. **Add pipeline/stage registry:** Add durable records for pipeline definitions, reusable stages, prompt/script attachments, and scheduled/immediate runs.
4. **Bridge existing queue work:** Make the existing Processing Queue feature create task instances and operator gates instead of only spawning one headless agent process.
5. **Use Data ledger concepts:** Reuse decision-os concepts such as `Ledger`, `Card`, `Thread`, `Event`, `RouteState`, `RuntimeData`, `GeneratedReport`, `TestRun`, and `Worktree` as implementation primitives.
