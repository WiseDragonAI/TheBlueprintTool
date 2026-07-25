# Working Documents

## A. Purpose

1. This role holds active analysis, extraction registers, comparisons, implementation studies, and decision drafts.
2. Working documents may change as evidence changes.
3. They are not canonical current behavior or accepted Specs.

---

## B. Existing Source Material

1. Loose Markdown files currently under `documentation/` remain source material for later KB extraction.
2. Root analysis files such as `TASK_SYNCHRONIZATION_RCA.md` and `TASK_REPLICATION_FUNDAMENTAL_ARCHITECTURE_ANALYSIS_2026-07-21.md` remain outside canon until reconciled.
3. Decision OS cards and threads remain in `.decision-os/`; do not copy their full bodies into working documents without a concrete analysis need.
4. [Epoch-4 task execution iteration status](./epoch-4-task-execution-iteration-status.md) is the authoritative implementation gate and cross-node progress ledger.
5. [Epoch-4 artifact garbage-collection analysis](./epoch-4-artifact-garbage-collection-analysis.md) records the missing post-tombstone byte-collection boundary and its selected remediation.
6. [Epoch-4 migration process assessment](./epoch-4-migration-process-assessment.md) records the interrupted Workstation proof, the unsafe transaction boundary, and the selected resumable shadow-cutover architecture.
7. [Epoch-4 live execution-intent conflict RCA](./epoch-4-live-execution-intent-conflict-rca.md) traces the stale epoch-3 card owner that blocks a newly durable execution and records the required node-wide cutover.
8. [Epoch-4 migration documentation audit](./epoch-4-migration-documentation-audit-2026-07-25.md) reconciles the complete implementation and incident chain with canonical architecture, procedure, status, and postmortem documents.

---

## C. Promotion Gate

1. Extract atomic facts with stable evidence.
2. Resolve contradictions against current code, runtime behavior, tests, Specs, and operator decisions.
3. Route each durable item to one canonical role and domain.
4. Keep unresolved findings in working status.
5. Archive the source only after all durable content has an owner.
