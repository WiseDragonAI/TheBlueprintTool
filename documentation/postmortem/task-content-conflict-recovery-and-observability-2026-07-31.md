# Task Content Conflict Recovery and Observability

## A. Failed Invariant

1. A project task mutation must prepare its Markdown successor from the projection that the authoritative project queue owns. Independent replicas may retain competing causal heads, but a recoverable resource conflict must not affect unrelated projects or routes.

---

## B. First Incorrect Transition

1. Before `09eef8b4`, `createProjectControllerRuntime()` read the projection and materialized task content before `ProjectTaskState.executeMutation()` acquired the project queue. Two concurrent mutations could therefore publish independent whole-thread successors from the same stale projection.
2. The next mutation correctly received `409 task_content_conflict` when materialization found multiple content heads. Voice upload had already persisted its audio, leaving the browser with a retained failed intent.

---

## C. Delivered Recovery

1. `09eef8b4` moved projection read, content materialization, Markdown mutation, and causal commit into `executePreparedMutation()` under the project queue; `ae90b920` promoted that repair to `main`.
2. The repair retries once only after `reconcileSupersetThreadContentConflict()` proves the local thread contains every stable note identity from every retained candidate and publishes one successor that causally observes them all.
3. Same-note divergence, missing candidates, remote-only notes, card Markdown, and binary assets remain explicit conflicts. The repair does not select content without a lossless merge proof.

---

## D. Detection Gap

1. The text route returns the materialization error as HTTP `409`; voice upload returns the same failure after audio persistence. Neither path records a resource-scoped runtime incident when safe reconciliation refuses the conflict.
2. System Status consequently has no durable incident for a persistent task-content write outage. This is an observability gap, not evidence that the delivered queue and lossless-superset recovery failed.

---

## E. Prevention Rule

1. A future incident-owning iteration must record a coalesced, non-pausing `task_content_conflict` warning with project, resource key, candidate heads, source replicas, byte counts, and refusal reason; return its incident ID in the text and voice `409` responses; and resolve that exact incident only after verified causal reconciliation.
2. The iteration must preserve all candidate objects and keep unrelated project routes writable.
