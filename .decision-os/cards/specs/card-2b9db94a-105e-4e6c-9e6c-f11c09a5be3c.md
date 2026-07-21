Ledger: Specs
Waiting since: 2026-07-16T16:40:51.656Z

## A. Outcome

1. Allow an operator to attach a recurring schedule to a saved pipeline so API ingestion, Instagram message collection, comment collection, and other pipeline workloads launch automatically.
2. Route every scheduled occurrence through the existing durable pipeline-run and FIFO capacity-queue path.

---

## B. Verified foundation

1. Saved pipeline definitions and durable run manifests are persisted in `.decision-os/codex-pipelines.json`.
2. `POST /api/codex/pipelines/runs` starts a saved pipeline.
3. The backend already limits concurrent Codex processes, queues pending pipeline runs in FIFO order, and reconciles durable runs after restart.
4. Repository search found no recurring schedule model, cron expression contract, next-fire calculation, or schedule trigger loop.

---

## C. Product boundary

1. A schedule targets one saved pipeline, uses a cron expression plus an IANA time zone, and has an explicit enabled state.
2. Each due occurrence has the durable identity `(scheduleId, scheduledFor)` so restart recovery and overlapping polling cannot enqueue it twice.
3. Scheduled launches use the pipeline's existing source-card, ledger, queue, cancellation, run-status, and output-card behavior.
4. Schedule management and occurrence history remain local to the owning Decision OS project.

---

## D. Subtasks

1. [Specify the schedule and occurrence contracts](card:card-bb2740c5-4401-4418-8b6d-b086e3bdb7eb)
2. [Persist schedules and expose management endpoints](card:card-195de894-0c99-4194-b3ea-725d7c422efa)
3. [Enqueue due occurrences through the pipeline runner](card:card-532218e6-3067-45bb-bbee-ff2ceefd7329)
4. [Add schedule controls to the pipeline library](card:card-dca44716-618e-458a-9071-fad1f9cd96f6)
5. [Verify scheduled execution and document operations](card:card-e5295bdf-1bf1-48c0-8ebc-c534f644e296)
