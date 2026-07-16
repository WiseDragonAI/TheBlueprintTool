# Product Analysis: Staged Skill Pipeline

## Goal/Spec Link

| Field | Value | Evidence |
|---|---|---|
| Goal need | Create a pipeline system that transforms the `process` view into a 2-tab system where the operator can create a pipeline of staged skills. | Source card `card-83a2bf48-f8b7-4d7a-b566-b6133b1520c8`, `Goal`. |
| Affected product area | `tasks-system` / processing workflow / agent execution surface. | Source card names the `process` view and staged skill pipeline; `.decision-os/tasks-system.json` contains `Processing Queue Panel` and `Skills Pipeline` zones. |
| Affected workflow | Sequential staged skill execution, with one card created per stage. | Source card: staged skills "will be run one after the other" and "create one card per stage." |
| Affected actor or role | Operator and agent. | Context card `card-0b144d6a-16a1-4cc2-9b9f-32aabafd5b4a` says the operator owns decisions/intent and the agent reads threads, changes repo or ledger state, and replies in `# AGENT` sections. |
| Relevant context fact | Existing task-system work already separates threads, tasks, and runs, and warns that threads should not own scheduling, leases, progress, blocking state, approval gates, dependency order, or multi-agent coordination. | `card-agent-autonomy-work-queue`, lines 3-13 and 17-35. |
| Current behavior | Existing Processing Queue work describes a single headless Codex launch path, session reuse, queue-agent state/log storage, and process tree ownership. | `.decision-os/tasks-system.json`, cards `queue-codex-launch`, `queue-session-reuse`, `queue-state-and-logs`, `queue-process-tree`. |
| Expected behavior | The `process` view becomes a 2-tab system that lets the operator create staged skill pipelines, runs those skills sequentially through independent Codex headless sessions, and creates one card per stage. | Source card `card-83a2bf48-f8b7-4d7a-b566-b6133b1520c8`, `Goal`. |
| Acceptance signal | unknown | The source card states the desired capability but does not provide a testable acceptance signal. |

## Linked Specs

| Spec ID | Title | Source | Relationship | Goal relevance |
|---|---|---|---|---|
| `card-tasks-core-problem-statement` | Tasks Core Problem Statement | `.decision-os/cards/tasks-system/card-tasks-core-problem-statement.md` | support | Defines the existing product problem: decision-os lacks a structured `task_instance -> operator decision -> execution -> artifact -> next stage` loop, and long pipelines need gates. |
| `card-tasks-unified-control-surface-requirements` | Tasks Unified Control Surface Requirements | `.decision-os/cards/tasks-system/card-tasks-unified-control-surface-requirements.md` | support | Requires reusable pipelines with identity, trigger, ordered stages, explicit stage types, artifact inspection, a pipeline/stage registry, and bridging Processing Queue work away from only spawning one headless process. |
| `card-tasks-legacy-factory-pipeline-baseline` | Tasks Legacy Factory Pipeline Baseline | `.decision-os/cards/tasks-system/card-tasks-legacy-factory-pipeline-baseline.md` | adjacent | Captures prior Business OS mock concepts for pipeline routes, pipeline composer, stage library, task records, and automation paths that are adjacent to the requested staged skill pipeline. |
| `card-agent-autonomy-work-queue` | Agent Autonomy Work Queue | `.decision-os/cards/tasks-system/card-agent-autonomy-work-queue.md` | constrain | Establishes a workspace-local work queue model with tasks, runs, leases, dependencies, waiting-operator state, CLI commands, and failure recovery; staged skill execution must fit or explicitly replace this model. |
| `queue-codex-launch` | Headless Codex Launch | `.decision-os/tasks-system.json` | support | Existing Processing Queue node specifies launching headless Codex with `codex exec --json -C <workspace>` and preserving workspace cwd for `AGENTS.md` resolution. |
| `queue-session-reuse` | One Hour Session Reuse | `.decision-os/tasks-system.json` | conflict | Existing queue work reuses a Codex session within one hour, while the goal asks for independent Codex headless sessions per staged skill. |
| `queue-state-and-logs` | State And Logs | `.decision-os/tasks-system.json` | constrain | Existing queue work stores queue-agent state, run metadata, and raw stdout/stderr JSONL in workspace-local `.decision-os/queue-agent/`; staged sessions need compatible durable state/log evidence. |
| `queue-process-tree` | Process Ownership | `.decision-os/tasks-system.json` | constrain | Existing queue work requires owning the full process tree because killing only a wrapper can leave `codex exec` running; staged independent sessions inherit this process ownership constraint. |
| `5835377e` | Server tab ledger JSON storage | `.decision-os/cards/specs/5835377e.md` | constrain | Server reads ledger JSON as the backing store for route-addressable tabs and is authoritative for persisted ledger mutations. |
| `9c31f0a4` | ledgers in ./.decision-os load as default tabs | `.decision-os/cards/specs/9c31f0a4.md` | adjacent | Existing app tab behavior is ledger-file based; the requested 2-tab `process` view may be a separate local view pattern rather than an existing top-level ledger tab pattern. |
| `10000002` | navigation | `.decision-os/cards/specs/10000002.md` | constrain | Switching tabs must change the active surface without corrupting other surface-local truth. |
| `b2e7c5d9` | Master ledger executor skills are repo-local | `.decision-os/cards/specs/b2e7c5d9.md` | adjacent | Executor skills for master-ledger workflows must be repo-local under `.skills/`; the goal mentions staged skills but does not state whether those skills are repo-local, operator-local, or another registry. |

## Missing Specs

| Implied requirement | Missing acceptance signal | Missing UX spec | Missing technical spec | Missing data spec | Missing operational spec | Evidence status |
|---|---|---|---|---|---|---|
| Define the 2-tab `process` view. | What counts as the transformed `process` view is unknown. | Tab names, tab purpose, active-tab behavior, empty state, editing state, and relationship to existing ledger tabs are unknown. | unknown | unknown | unknown | Source-backed need; details unknown. |
| Create a staged skill pipeline. | How an operator confirms a valid pipeline is unknown. | Skill picker, stage ordering UI, stage edit/delete/reorder controls, and pipeline preview are unknown. | Stage validation, dependency ordering, and runnable pipeline compilation are unknown. | Pipeline, stage, skill reference, input, output, and version fields are unknown. | Ownership, permissions, and approval behavior are unknown. | Source-backed need; details unknown. |
| Run staged skills one after another. | What proves sequential execution is unknown. | Progress state and per-stage status display are unknown. | Execution scheduler, stage handoff, retry, cancellation, timeout, and failure propagation are unknown. | Run status, stage outputs, stage-to-stage artifacts, and execution lineage are unknown. | Recovery policy and operator intervention states are unknown. | Source-backed need; details unknown. |
| Use independent Codex headless sessions for each stage. | What proves session independence is unknown. | Whether session ids are visible to the operator is unknown. | Session launch arguments, resume policy, sandbox/approval policy, cwd, environment, and process-tree ownership are unknown. | Session id, command, stdout/stderr log refs, model settings, and per-stage run metadata are unknown. | Concurrency limits, cleanup, cancellation, and stale process recovery are unknown. | Source-backed need; conflicts with existing one-hour session reuse if reused for this feature. |
| Create one card per stage. | What card content must exist after each stage is unknown. | Card placement, zone ownership, status badges, and links back to the pipeline are unknown. | Card creation route, mutation timing, idempotency, and failure behavior are unknown. | Card schema fields for pipeline id, stage id, run id, artifacts, and provenance are unknown. | Duplicate prevention and cleanup behavior are unknown. | Source-backed need; details unknown. |

## Spec Gaps

| Gap type | Gap | Evidence | Impact on goal |
|---|---|---|---|
| source gap | `process` view is named but not defined in the source card or linked specs reviewed here. | Source card says transform the "`process` view" but provides no route, current UI description, or existing component reference. | The affected surface cannot be bounded without extra evidence. |
| UX constraint | The requested "2 tabs system" lacks tab names, tab responsibilities, active-state behavior, and relationship to existing route-addressed ledger tabs. | Source card requests a 2-tab system; specs `5835377e`, `9c31f0a4`, and `10000002` already constrain tab/ledger behavior. | The tab design could collide with existing ledger tab semantics unless bounded. |
| conflict | Existing queue work specifies one-hour Codex session reuse, while the goal asks for independent Codex headless sessions. | `.decision-os/tasks-system.json` `queue-session-reuse`; source card says stages run by "independant codex headless sessions." | The execution model must distinguish staged-session independence from current queue session reuse. |
| technical constraint | Independent headless Codex stages inherit existing process-tree ownership and durable logging constraints. | `.decision-os/tasks-system.json` `queue-process-tree` and `queue-state-and-logs`. | Stage runs need durable run evidence and cleanup behavior, not only card creation. |
| data constraint | The source does not specify the stage-to-card data contract. | Source card requires one card per stage; `card-tasks-unified-control-surface-requirements` requires task/pipeline/stage/artifact records, but no skill-stage card schema is defined. | Cards can be created without enough provenance to audit which stage, skill, session, or artifact produced them. |
| product-boundary decision | It is unknown whether this pipeline belongs inside the existing Processing Queue, the broader task-instance model, or a separate Skills Pipeline surface. | Existing sources include `Processing Queue Panel`, `Skills Pipeline` zone, task-instance requirements, and the source card's `process` view wording. | The feature boundary affects which data model and UI contracts govern the work. |
| dependency constraint | Skill registry/source is unspecified. | Source card says "staged skills"; spec `b2e7c5d9` only covers repo-local executor skills for master-ledger workflows. | The system cannot verify, version, or audit skills without knowing where staged skills are sourced from. |
| ownership gap | No owner is assigned for pipeline creation, stage review, failed stage recovery, or card approval. | Source card gives the capability only; context card says operator owns decisions/intent and agents perform work, but no feature-specific owner is assigned. | Operator/agent handoff points remain unknown. |
---

Codex run completed: exit code 0
