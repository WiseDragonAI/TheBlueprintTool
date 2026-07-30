## A. Repository Intent

1. **Control Room intent:** aggregate task state from Workstation and Mobile while preserving project-scoped mutation routing.
2. **Replica intent:** serve retained remote task, card, and thread projections locally, refresh them in the background, and expose synchronization state.
3. **Project-sync intent:** reconcile two Git checkouts through an explicit source-first pipeline initiated from project settings.

---

## B. Current Iteration Intent

1. **Current `HEAD`:** `4414f1c5` routes explicit project synchronization through a federated pipeline.
2. **Current runtime:** the server on `http://127.0.0.1:50151` started on 2026-07-18 at 12:32 and is running the current backend. The frontend/backend version skew recorded in `TASK_SYNCHRONIZATION_RCA.md` is no longer present.
3. **Current question:** determine whether the task resurrection cause is removed and whether replica synchronization now converges.

---

## C. Findings

1. **Gap — canonical task ownership remains absent.** `federatedControlRoomProjection()` still owner-qualifies project IDs and concatenates every owner list. It does not reconcile equal logical project, ledger, and card identities.
2. **Gap — backlog placement remains owner-scoped.** `persistControlTaskPlacement()` still sends one `patch-card` mutation to `task.projectId`. The equivalent checkout is not updated by that mutation.
3. **Drift — the original three backlog conflicts have converged, but the defect has recurred on four other cards.** The live projection contains `21` duplicated card IDs and `4` divergent statuses.
4. **Current divergent state:**
   1. `Remove obsolete Control Room error details`: Workstation `task-waiting`, Mobile `task-backlog`.
   2. `RCA and fix plan: Shift+X navigation waits for voice upload`: Workstation `task-waiting`, Mobile `task-backlog`.
   3. `Skills Library readable details and references`: Workstation `task-complete`, Mobile `task-waiting`.
   4. `Restore Thread and Codex Log Follow-Bottom`: Workstation `task-waiting`, Mobile `task-backlog`.
5. **Verified improvement — the original incident rows have changed.** `Create Server-Wide Pipelines`, `Analyze Codex run lifecycle and status consistency`, and `Study Federated Decision OS Environments` are now `task-backlog` on both owners. This resolves those stored conflicts without correcting the merge contract that permits new conflicts.
6. **Omission — explicit Git synchronization is not continuous task-state authority.** The project-sync controller runs only after `/api/project-sync` admission and reconciles repository commits. Ordinary queue/backlog mutations do not invoke it and do not select a canonical task owner.
7. **Gap — replica refresh can block indefinitely.** The live replica store contains five overdue Mobile projects with `attempts: 0`; every remote task reports `synchronizing`; the last successful snapshot is from 2026-07-17 at 17:43 UTC.
8. **First incorrect local replica transition:** `openRequest()` creates an internal federation promise without a deadline. `scheduleFederatedTaskReplicas()` retains the per-node run until that promise settles. The live `attempts: 0` state proves that `fail()` has not been reached; an unsettled request keeps `federationReplicaRuns` occupied and causes every 15-second scheduler pass to skip the node. The exact missing remote response frame cannot be identified because the connector records no per-request lifecycle diagnostics.
9. **Verified status-label correction:** current remote rows contain real `replica.status: synchronizing`. The badge is no longer caused by frontend/backend version skew; it now reflects a persisted pending refresh that is not progressing.
10. **Drift — Mobile projector diagnostics remain stale.** Mobile task snapshots still contain empty `waitingSince` values and `invalid Waiting since` while corresponding Workstation projections are valid.

---

## D. Remediation Paths

1. **Canonical ownership:** derive one logical project identity from `originFingerprint` and `localProjectId`, select one authoritative owner, and route every task mutation to that owner.
2. **Conflict-aware projection:** coalesce tasks by logical project identity, `ledgerId`, and `cardId`; reject divergent writable states into an explicit conflict diagnostic during migration.
3. **Bounded federation requests:** add a request deadline that cancels the relay request, removes the requester stream, settles the internal promise with a timeout response, and lets `federationReplicaStore.fail()` schedule retry metadata.
4. **Scheduler regression:** hold one replica response open, prove the request times out, prove the next project proceeds, advance through backoff, and prove the failed project retries automatically.
5. **Cross-owner task regression:** move the authoritative card to backlog, refresh the peer replica, and assert that the merged queue contains no second waiting row.
6. **Projector compatibility:** require the replica protocol version to include normalized `waitingSince` and reject snapshots whose task schema does not satisfy that contract.

---

## E. Operator Decision Summary

1. **Previous RCA status:** the deployment-skew explanation is obsolete; the duplicate-owner root cause remains valid.
2. **Current additional root cause:** replica synchronization is genuinely stuck because internal federation requests have no deadline and one unsettled request blocks the node scheduler.
3. **Required implementation boundary:** canonical task ownership and bounded federation transport must both be corrected. Fixing only the badge, filter, or stored conflicts would leave the recurrence path active.
