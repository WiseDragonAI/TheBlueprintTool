# Deployment Procedures

## A. Purpose

1. Deployment procedures own production admission, offline migration, process registration, convergence, restart, rollback, and closeout evidence.

---

## B. Procedures

1. [Release-Tag Production Deployment](./release-tag-deployment.md) is the canonical merge, relay deployment, application boundary, and production proof procedure.
2. [Epoch-3 node cutover](./epoch-3-node-cutover.md) converts independent workstation and phone catalogs, starts strict nodes, and proves relay convergence and lazy content.
3. [Epoch-4 node cutover](./epoch-4-node-cutover.md) migrates durable task assignment and replicated execution state and proves offline-local plus assigned-node execution.
4. [Canary Skill Authoring Dev Environment](./canary-skill-authoring-dev-environment.md) operates the isolated `dev` branch, application `50151`, local relay `50152`, exact-SHA development evidence, and dev-only cleanup without changing production `50150`.
5. [Temporary Worktree Canary](./temporary-worktree-canary.md) launches one bounded, non-federated feature-worktree server on a dynamic port, verifies it, and removes it without MultiTerm registration.
6. [Termux Phone Canary Environment](./canary-termux-phone-environment.md) adapts the development canary topology to Android with runit supervision, isolated durable state, logs, recovery, and cleanup.
7. [Full Production Rollback](./full-production-rollback.md) owns operator-authorized tag rollback through forward corrective history, relay alignment, canonical supervisor recovery, durable runtime recovery, and post-restart proof.
8. [Legacy Coordinated Delivery Reference](./production-delivery-protocol.md) documents the implemented SHA/worktree delivery subsystem but is not the canonical production procedure.
9. [Workspace Migration Runbook](./MIGRATE_RUNBOOK.md) migrates legacy root ledgers and card content into `.decision-os`.
10. [Node-Local Task Current-State Epoch 3 Cutover](./TASK_STATE_V2_MIGRATION_RUNBOOK.md) performs the federation-wide repair cutover from v2 current state to Epoch 3.
