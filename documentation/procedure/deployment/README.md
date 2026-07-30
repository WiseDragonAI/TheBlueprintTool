# Deployment Procedures

## A. Purpose

1. Deployment procedures own production admission, offline migration, process registration, convergence, restart, rollback, and closeout evidence.

---

## B. Procedures

1. [Epoch-3 node cutover](./epoch-3-node-cutover.md) converts independent workstation and phone catalogs, starts strict nodes, and proves relay convergence and lazy content.
2. [Epoch-4 node cutover](./epoch-4-node-cutover.md) migrates durable task assignment and replicated execution state, deploys the versioned relay namespace, and proves offline-local plus assigned-node execution.
3. [Canary Skill Authoring Dev Environment](./canary-skill-authoring-dev-environment.md) operates the isolated `dev` branch, application `50151`, local Wrangler relay `50152`, exact-SHA evidence, and dev-only cleanup without changing production `50150`.
4. [Termux Phone Canary Environment](./canary-termux-phone-environment.md) adapts the same canary topology to Android with runit supervision, the native Node relay adapter, isolated durable state, phone-specific dependencies, logs, recovery, and cleanup.
5. [Production Delivery Protocol](./production-delivery-protocol.md) owns protocol-1 node bootstrap, exact-SHA `candidate` preparation, reviewed `main` promotion, relay activation, rolling node restart, durable status, resume, runtime rollback, and incident evidence through the single delivery CLI.
6. [Workspace Migration Runbook](./MIGRATE_RUNBOOK.md) migrates legacy root ledgers and card content into `.decision-os`.
7. [Node-Local Task Current-State Epoch 3 Cutover](./TASK_STATE_V2_MIGRATION_RUNBOOK.md) performs the federation-wide repair cutover from v2 current state to Epoch 3.
