## A. Reassessment

1. **The combined report is over-engineered as one delivery plan.** It merges project recovery, status reporting, fatal-process handling, Skill Library containment, federation-cache rebuilding, content reconciliation, and image-note recovery.
2. **The recovery architecture itself is mostly lean.** It correctly reuses the existing task-state transaction, incident ledger, pause maps, migration journal, federation reconciliation, and pending-message receipt.
3. **The plan should become six focused changes.** The content/image incident remains a separate final change because it is not causal to project pausing.

---

## B. Verified Corrections

1. **Do not add the proposed backend status projection.** The existing diagnostics response already exposes authoritative pause registries and complete incident records in `backend/src/business/server/helper/create-http-server.ts`. Adding `impact`, `affectedProjectIds`, `affectedReplicaNodeIds`, and `recoverableScope` would duplicate existing state.
2. **Do not migrate the incident schema now.** Keep the persisted `paused`/`resolved` compatibility format. Treat `paused` as an unresolved incident internally. Derive operational interruption exclusively from live admission registries.
3. **Correct the false project status directly.** Remove `pausedFederatedTaskProjectIds` from `projectPauseReasons()` in `frontend/src/app/responsive/runtime-status.js`. A derived cache incident remains visible without marking the hosted project paused.
4. **The proposed reuse of the existing migration marker is inaccurate.** The current marker contains no project identity in `backend/src/business/task-state/helper/task-current-state-migration-transaction.ts`. Extend it with `projectIds`; do not add a recovery database.
5. **The launcher is not currently a restart supervisor.** It enters permanent emergency mode after a child failure in `bin/decision-os-server.mjs`. Removing the global zombie gate therefore requires bounded launcher restart behavior in the same change.

---

## C. Bloat Register

1. **Combined-report lines 1–91 and 93–264 — redundant — merge.** Both sections establish the same no-restart, project-scoped transaction.
2. **Combined-report lines 165–208 — over-coupled — split.** They combine five independent failure families.
3. **Combined-report lines 302–310 — excessive status redesign — delete.** The new backend projection, persistent impact model, rich incident expansion, and additional affected-entity arrays are unnecessary.
4. **Combined-report line 305 — incorrect lifecycle expansion — rewrite.** Exclude expected domain responses from incident creation and keep health independent from settled request errors.
5. **Combined-report line 310 — UI expansion beyond the requirement — defer.** Incident-member expansion, full context rendering, and new grouping identity are not required to make paused projects visible and truthful.
6. **Combined-report line 311 — oversized regression bundle — split.** Attach focused failure-lifecycle tests to each implementation change.
7. **Combined-report lines 197–208 — misplaced — move.** Keep content and image recovery outside the project-pause recovery critical path.

---

## D. Revised Implementation Order

1. **Make status truthful.**
   1. Exclude federated caches from whole-project pause calculation.
   2. Derive health degradation from actual admission registries plus fatal process state.
   3. Display unresolved non-blocking incidents as errors.
   4. Show the exact authoritative pause reason beside each paused project.
2. **Remove immediate cross-component blockage.**
   1. Load server skills independently from server pipelines.
   2. Keep valid pipelines available when one pipeline is invalid.
   3. Handle typed request failures at their route boundary without creating runtime pauses.
3. **Eliminate the global zombie state.**
   1. Catch expected asynchronous failures at their owning component.
   2. Remove the `globalRuntimeIncident` request-admission gate and in-process server-runtime resume.
   3. Persist genuine fatal evidence, terminate the child once, and let the launcher restart with bounded backoff.
   4. Enter launcher emergency mode only after the finite restart circuit is exhausted.
4. **Make scoped resume atomic.**
   1. Keep the scope paused during validation.
   2. Dispose the owning project context and end its SSE responses.
   3. Validate and install replacement state.
   4. Reopen the project context and refresh its projection.
   5. Persist incident resolution.
   6. Clear the in-memory pause only after every preceding step succeeds.
5. **Add automatic recovery.**
   1. For `task_state_offline_migration_required`, run one project recovery attempt per source fingerprint.
   2. Build the legacy baseline, merge validated retained v4 entities, and commit through the existing transaction.
   3. Extend the existing admission marker with `projectIds`.
   4. For `unsupported_task_current_state_format`, archive the exact derived cache, create a compatible empty cache, and reconcile from the relay.
   5. Keep hosted authoritative project state available during cache reconstruction.
6. **Harden evidence and finish the separate content incident.**
   1. Preserve corrupt incident-ledger bytes.
   2. Retain incidents referenced by live pause registries before resolved history.
   3. Add the exact watcher flush and single retry.
   4. Preflight image-note content before creating assets.
   5. Reuse `PendingThreadMessage` without adding image persistence models.

---

## E. Explicit Cuts

1. **Remove:** new recovery database.
2. **Remove:** durable incident-impact schema migration.
3. **Remove:** backend status projection fields.
4. **Remove:** image manifest, orphan registry, asset database, and cleanup scheduler.
5. **Remove:** generic conflict-resolution framework.
6. **Remove:** arbitrary mismatching-byte adoption.
7. **Defer:** full interactive incident evidence explorer.
8. **Defer:** serving the complete frontend from launcher emergency mode.
9. **Reject:** one large implementation branch covering every incident family.

---

## F. Acceptance Criteria

1. A cache failure cannot mark a healthy hosted project paused.
2. A recoverable project failure cannot block unrelated projects, routes, federation traffic, health, or diagnostics.
3. Compatible local task-state damage recovers without restarting the server.
4. Derived caches rebuild automatically without pausing authoritative state.
5. Pause removal happens only after validated, durable recovery.
6. Genuine process corruption results in bounded supervised restart instead of permanent global admission blockage.
7. The Status screen identifies the exact project and authoritative pause reason.
8. Invalid durable bytes remain byte-identical and their incident evidence remains readable.

---

## G. Final Bloat and Over-Engineering Reassessment

1. **Decision:** the implemented recovery is lean enough to ship. It preserves every requested feature and removes the global live-process admission gate.
2. **No duplicate durable model was added.** Hosted recovery reuses the migration transaction and journal. Derived recovery reuses the federation cache and task-state store. Pause evidence reuses the incident ledger.
3. **No speculative status model was added.** Health and project status derive from live pause registries. Historical incidents remain diagnostics instead of becoming admission state.
4. **No image persistence subsystem was added.** Preflight occurs before writes and the existing pending-message receipt retains retry intent.
5. **No recovery framework was added.** Two narrow helpers own the only new reusable operations: compatible hosted migration and exact derived-cache archive.
6. **No broad cache scan remains in thread rendering.** The existing thread-document restoration function accepts an active thread identity and restores only that cached conversation on render.
7. **No timing inflation masks the browser failure.** The pipeline test now waits for exact generated step identities instead of increasing its timeout.
8. **Safety correction from the final audit:** the derived-cache archive validates project identity before resolving or renaming any path.
9. **Remaining structural concentration:** `create-http-server.ts` still owns HTTP composition and recovery coordination. Extracting a new service now would duplicate closure-owned runtime maps and increase lifecycle coupling. Keep the current composition until a second independent caller exists.
10. **Deferred items remain cut:** rich incident explorer, complete emergency frontend, recovery database, incident-impact schema, image asset registry, cleanup scheduler, and generic conflict framework.
