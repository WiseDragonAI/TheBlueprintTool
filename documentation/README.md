# Decision OS Knowledge Base

This directory is the canonical knowledge base for the `decision-os` repository.

Durable knowledge is organized by document role, then domain, then topic. New working analysis exists only for an active iteration and is removed after its verified technical content is integrated; pre-lifecycle sources remain an explicit migration backlog.

## A. Canonical Roles

1. [Documentation](./documentation/README.md) records current system behavior, architecture, ownership, data flow, and operator-facing surfaces.
2. [Specs](./specs/README.md) records accepted behavior, invariants, boundaries, and non-goals.
3. [Procedure](./procedure/README.md) records repeatable operator and agent workflows, commands, safety boundaries, validation, rollback, and escalation.
4. [Postmortem](./postmortem/README.md) records root causes, failure modes, lessons, and regression-prevention rules.
5. [Working Documents](./working-documents/README.md) holds temporary active analysis and the identified pre-lifecycle migration backlog.
6. [Archive](./archive/README.md) holds superseded material and migration evidence outside the active knowledge layer.

---

## B. Start Here

1. [Product and operator model](./documentation/product/README.md)
2. [System architecture](./documentation/architecture/README.md)
3. [Document research and solution selection prompt](./procedure/analysis/Document-Research-Solution-Selection-Prompt.md)
4. [Verification procedure](./procedure/testing/README.md)
5. [Knowledge-base contract](./specs/knowledge-base/README.md)
6. [Epoch-3 task state and federation](./documentation/architecture/epoch-3-task-state-and-federation.md)
7. [Epoch-3 node cutover procedure](./procedure/deployment/epoch-3-node-cutover.md)
8. [Epoch-3 production cutover postmortem](./postmortem/epoch-3-production-cutover-2026-07-21.md)
9. [Commit traceability contract](./specs/commit-traceability.md)
10. [Create and publish tasks from the CLI](./procedure/tasks/create-and-publish-tasks-from-cli.md)
11. [Epoch-4 task execution iteration status](./working-documents/epoch-4-task-execution-iteration-status.md)
12. [Epoch-4 implementation procedure](./procedure/implementation/epoch-4-task-execution-iteration.md)
13. [Epoch-4 node cutover procedure](./procedure/deployment/epoch-4-node-cutover.md)
14. [Epoch-4 task assignment, execution, and content architecture](./documentation/architecture/epoch-4-task-assignment-execution-and-content.md)
15. [Epoch-4 Workstation cutover and thread consistency postmortem](./postmortem/epoch-4-workstation-cutover-2026-07-24.md)
16. [Restore an accidentally tombstoned Epoch-4 note](./procedure/tasks/restore-accidentally-tombstoned-note.md)
17. [Create and operate the default prompt library](./procedure/implementation/default-prompt-library.md)
18. [Prompt expression and system-prompt catalog](./documentation/architecture/prompt-expression-catalog.md)
19. [Epoch-4 federation repair and recovery](./documentation/architecture/epoch-4-federation-repair-and-recovery.md)
20. [Epoch-4 replication incident postmortem](./postmortem/epoch-4-replication-incident-2026-08-09.md)

---

## C. Canonical Source Boundaries

1. `.decision-os/*.json` and `.decision-os/cards/**` remain the durable Decision OS ledger data.
2. `AGENTS.md` remains the repository agent contract.
3. `README.md` remains the repository launcher and product entrypoint.
4. This KB explains those sources and links to them; it does not replace runtime state or duplicate ledger content.
5. Existing loose files under `documentation/` remain source material until their durable facts are absorbed into a canonical topic.

---

## D. Maintenance Rules

1. Give every durable fact one primary canonical owner.
2. Link from secondary topics instead of duplicating full explanations.
3. Keep current behavior, intended behavior, procedure, and root-cause material separate.
4. Use a single Markdown file for a small topic and a directory with `README.md` for a large topic.
5. Do not create a same-name topic file and topic directory at the same level.
6. Preserve exact paths, routes, commands, symbols, IDs, and status literals.
7. Before closing an iteration, integrate verified final-state technical knowledge and delete its working documents.
8. Recycle pre-lifecycle sources through dedicated cleanup iterations that delete every settled source.
9. Do not promote intermediate TODO lists, implementation checklists, hypotheses, progress reports, or superseded plans.
