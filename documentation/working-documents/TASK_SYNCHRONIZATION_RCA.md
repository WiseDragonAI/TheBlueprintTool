## A. Repository Intent

1. **Decision OS exposes one Control Room across locally registered and federated projects.** Project-scoped routes retain the owner-qualified project identity needed to dispatch reads and mutations to the owning node.
2. **Federation task replicas accelerate remote reads.** They copy task projections, card content, and thread content for local presentation; the owner remains responsible for mutation persistence.

---

## B. Current Synchronization Intent

1. **Equivalent Git checkouts share one visible project filter.** `frontend/src/app/responsive/project-filter-chip.js` groups projects by `originFingerprint` and `localProjectId`.
2. **Task ownership remains terminal-specific.** The grouped filter includes every member project ID, and `frontend/src/app/responsive/application.js` identifies a task with the owner-qualified `projectId`, `ledgerId`, and `cardId`.
3. **The Control Room merges owner projections.** `backend/src/business/server/helper/federated-control-room-projection.ts` qualifies each owner projection and concatenates `queue`, `exec`, `backlog`, `done`, and `allTasks`.

---

## C. Root Cause

1. **The federation models the Workstation checkout and Mobile checkout as separate task owners even when they represent the same logical repository and card IDs.** Project-filter grouping changes presentation only; it does not establish one authoritative task record.
2. **A backlog placement patches only the selected owner-qualified project.** `persistControlTaskPlacement()` sends one `patch-card` mutation using `task.projectId`. The matching card in the other checkout is not updated.
3. **The backend performs no logical-task reconciliation.** `federatedControlRoomProjection()` concatenates owner lists without coalescing equal logical tasks or detecting conflicting statuses. The unchanged peer copy therefore remains `task-waiting` and is returned in `queue`.
4. **The replica implementation does not resolve ownership conflicts.** `buildFederationTaskReplica()` and `peerProjections()` preserve the source task status. Replication transports each owner's projection; it does not merge mutations between equivalent checkouts.

---

## D. Runtime Evidence

1. **Served route:** `http://127.0.0.1:50151/api/control-room` returned HTTP `200` on 2026-07-17.
2. **Duplicate scope:** the response contained `223` tasks, `104` card IDs present under multiple owners, and `5` card IDs with divergent owner statuses.
3. **Direct resurrection evidence:** `Create Server-Wide Pipelines`, `Analyze Codex run lifecycle and status consistency`, and `Study Federated Decision OS Environments` are `task-backlog` under Workstation while the same card IDs are `task-waiting` under Mobile.
4. **Additional divergence:** `Preserve Control Room column scroll` is `task-complete` under Workstation and `task-waiting` under Mobile.
5. **Screenshot labels are version-skew evidence:** the running backend process started at 19:24, before commit `568dffbd` and merge `dcdaaf7c` added federation task replicas at 19:29-19:30. The current frontend treats remote tasks without replica metadata as `synchronizing`, so the displayed badge does not prove an active synchronization of those task states.
6. **Timestamp diagnostic:** the Mobile projections for the screenshot rows contain an empty `waitingSince`, producing `invalid Waiting since`. This confirms projector/data drift between nodes but is not the transition that returns backlog tasks to Queue.

---

## E. Remediation Path

1. **Establish one authoritative owner for each logical project identity** derived from `originFingerprint` and `localProjectId`.
2. **Route every task mutation for that logical project to the authoritative owner.** Treat other node copies as read replicas rather than independent writable task sources.
3. **Coalesce Control Room rows by logical project identity, `ledgerId`, and `cardId`.** Surface a hard conflict diagnostic when multiple writable projections disagree during migration instead of silently displaying both states.
4. **Add a regression for the observed chain:** move the authoritative card to backlog, refresh both node projections, and assert that no owner-qualified waiting copy enters the merged queue.
5. **Load one compatible backend and frontend revision on both nodes** before validating replica status and timestamp diagnostics.

---

## F. Operator Decision Summary

1. **The backlog mutation is not being reversed.** A second writable copy of the same logical task remains queued and is merged back into the Control Room.
2. **The structural correction is canonical task ownership plus conflict-aware projection coalescing.** A frontend-only hide rule would conceal divergent persisted state and leave mutations ambiguous.
