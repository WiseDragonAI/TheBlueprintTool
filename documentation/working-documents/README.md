# Working Documents

## A. Purpose

1. This role holds active analysis, extraction registers, comparisons, implementation studies, and decision drafts.
2. Working documents may change as evidence changes.
3. They are not canonical current behavior or accepted Specs.

---

## B. Existing Source Material

1. All Markdown files in this directory are registered working source material for later KB extraction.
2. Task synchronization and replication sources: [synchronization RCA](./TASK_SYNCHRONIZATION_RCA.md), [synchronization reassessment](./TASK_SYNCHRONIZATION_REASSESSMENT_2026-07-18.md), [v2 aggregation reassessment](./TASK_V2_AGGREGATION_REASSESSMENT_2026-07-21.md), [fundamental replication architecture](./TASK_REPLICATION_FUNDAMENTAL_ARCHITECTURE_ANALYSIS_2026-07-21.md), [minimal causal-state solution](./TASK_REPLICATION_MINIMAL_CAUSAL_STATE_SOLUTION_2026-07-21.md), and [replication recovery goal](./TASK_REPLICATION_RECOVERY_GOAL_2026-07-21.md).
3. Task execution and lifecycle sources: [Codex execution ownership reassessment](./CODEX_EXECUTION_OWNERSHIP_REASSESSMENT_2026-07-20.md), [Codex context-capacity analysis](./CODEX_CONTEXT_CAPACITY_ANALYSIS_2026-07-21.md), [node-local Epoch-3 migration plan](./NODE_LOCAL_EPOCH3_MIGRATION_PLAN.md), [phone Epoch-3 migration tasks](./PHONE_EPOCH3_MIGRATION_TASKS.md), [task lifecycle full-chain analysis](./task-lifecycle-refactor-full-chain-analysis.md), [Epoch-4 Codex log regression analysis](./epoch-4-codex-log-output-regression-analysis-2026-07-25.md), [execution-log packet reassessment](./epoch-4-execution-log-packet-reassessment-2026-07-25.md), [lightweight execution-presentation packet](./epoch-4-lightweight-execution-presentation-packet-2026-07-25.md), [execution-summary integration](./epoch-4-task-execution-summary-integration-2026-07-25.md), and [execution-presentation cutover plan](./epoch-4-task-execution-presentation-cutover-plan-2026-07-25.md).
4. Skill-authoring sources: [codebase analysis](./canary-skill-authoring-codebase-analysis-2026-07-26.md), [over-engineering analysis](./canary-skill-authoring-over-engineering-analysis-2026-07-26.md), and [Epoch-3/4 destructive-default reassessment](./epoch-3-4-destructive-default-write-reassessment-2026-07-26.md).
5. Runtime recovery sources: [systemic conflict and Lys-loss reassessment](./systemic-task-conflict-lock-and-lys-loss-reassessment-2026-07-26.md), [project-scoped recovery reassessment](./project-scoped-online-task-state-recovery-reassessment-2026-07-29.md), [task-state and image-note recovery](./task-state-and-image-note-recovery-minimal-reassessment-2026-07-29.md), [system-status screen analysis](./system-status-incident-screen-analysis-2026-07-29.md), and [combined runtime recovery and system status](./runtime-recovery-and-system-status-combined-2026-07-29.md).
6. Decision OS cards and threads remain in `.decision-os/`; do not copy their full bodies into working documents without a concrete analysis need.
7. [Epoch-4 task execution iteration status](./epoch-4-task-execution-iteration-status.md) is the authoritative implementation gate and cross-node progress ledger.
8. [Epoch-4 artifact garbage-collection analysis](./epoch-4-artifact-garbage-collection-analysis.md) records the missing post-tombstone byte-collection boundary and its selected remediation.
9. [Epoch-4 migration process assessment](./epoch-4-migration-process-assessment.md) records the interrupted Workstation proof, the unsafe transaction boundary, and the selected resumable shadow-cutover architecture.
10. [Epoch-4 live execution-intent conflict RCA](./epoch-4-live-execution-intent-conflict-rca.md) traces the stale epoch-3 card owner that blocks a newly durable execution and records the required node-wide cutover.
11. [Epoch-4 migration documentation audit](./epoch-4-migration-documentation-audit-2026-07-25.md) reconciles the complete implementation and incident chain with canonical architecture, procedure, status, and postmortem documents.

---

## C. Promotion Gate

1. Extract atomic facts with stable evidence.
2. Resolve contradictions against current code, runtime behavior, tests, Specs, and operator decisions.
3. Route each durable item to one canonical role and domain.
4. Keep unresolved findings in working status.
5. Archive the source only after all durable content has an owner.
