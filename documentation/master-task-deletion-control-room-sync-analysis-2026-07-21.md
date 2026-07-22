## A. Optimistic Interaction Audit

1. **Scope.** This reassessment covers deterministic operator mutations of ledger, task, card, zone, group, note, and card-media state. The source inventory contains `21` callers of `commitActiveLedgerMutation()`, `9` callers of `sendActiveLedgerMutation()`, and `11` responsive-application calls to `ledgerMutation()`.
2. **Conclusion.** Six interaction families are server-blocking even though the client already has the complete requested state and can restore a snapshot after rejection. Three additional families change the DOM immediately but do not update authoritative client state or implement rejection recovery.
3. **Priority.** Card deletion is the first correction because the current non-optimistic interaction combines with a held-state invalidation defect and leaves a deleted task visible as an unusable Control Room row.
4. **Optimistic contract.** Apply the deterministic mutation to local state, render or navigate immediately, persist in the background, retain the local intent across stale refreshes, clear the intent after authoritative confirmation, and restore server-confirmed state after rejection.

---

## B. Retained Card-Deletion Incident

1. **Observed card.** `card-c9a30d5a-4f75-48a8-b5a8-650fb51e83d1`, titled `New task intake`, was deleted from the workstation.
2. **Authoritative deletion exists.** `.decision-os/task-state/ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z/current/card/card-c9a30d5a-4f75-48a8-b5a8-650fb51e83d1.json` contains a workstation counter `21` `$entity` tombstone. The card fields were created at workstation counter `20`.
3. **The card remains held.** `.decision-os/task-state/ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z/local/held/card-c9a30d5a-4f75-48a8-b5a8-650fb51e83d1.json` still lists the card, its intake zone, and its thread-file field. The direct card projection returns no card, while the persisted Control Room projection still contains the task.
4. **First incorrect client transition.** The responsive confirmation handler at `frontend/src/app/responsive/application.js:2351` disables the button, displays `Deleting task…`, awaits `ledgerMutation()`, and navigates only after the response. It removes nothing from `state.ledger` or the five Control Room collections before the request.
5. **Why the stale row is unusable.** The row still receives a click handler, but its card target no longer exists. Card loading returns no card and the route falls back to the surviving zone. The symptom is therefore a stale link to a deleted resource, not a missing click binding.
6. **Server invalidation defect.** `create-task-intake` marks its card, annotation, and thread field as `held` in `backend/src/business/task-state/helper/task-mutation-command.ts:144`. `task-current-state-store.ts:327` removes held entities from publishable deltas. The delete changes local current state, but its publishable delta can be empty. `create-http-server.ts:1525` invalidates the Control Room from `taskCommit.deltas`, and `control-room-projection-store.ts:549` returns immediately for an empty entity array. The accepted tombstone therefore does not invalidate the stale Control Room slice.
7. **Scope of the backend defect.** Every pre-activation mutation touching held card state can produce the same missed invalidation. This includes title changes, description changes, lifecycle transitions, note changes, image deletion, and card deletion. Federation convergence cannot repair a local projection cache that was never invalidated from the local authoritative change.
8. **Replica-routing defect.** `projectFetch()` emits `x-decision-os-replica-node` only when a caller supplies `replicaNodeId`. The responsive delete and detail lifecycle handlers call `ledgerMutation()` without the route replica identity. A remote-owned task can therefore be mutated against the wrong node scope.

---

## C. Server-Blocking Interactions That Must Become Optimistic

1. **Task and regular-ledger card deletion — critical.** `frontend/src/app/responsive/application.js:2351` and `frontend/src/runtime/card/controller/delete-card-controller.ts:14` wait for server reconciliation before removing the card. Snapshot the card, relationships, thread reference, notes, selection, route, and Control Room membership. Remove the card locally and navigate immediately. Keep a deletion intent keyed by `projectId`, `ownerNodeId`, `ledgerId`, and `cardId` so incoming stale projections cannot resurrect it. On rejection, force an authoritative scoped reload and restore that result. Project-catalog cards and ledger-catalog cards retain server-authoritative deletion because those handlers unregister a project and delete a ledger from disk.
2. **Task lifecycle transition — critical.** `toggle-card-status-controller.ts:11` waits for `transition-card-lifecycle`. The responsive detail action at `application.js:2256` only disables and relabels the button until the request returns. Apply `todo`, `backlog`, and `done` locally to both the ledger card and every Control Room collection, navigate immediately when the action changes columns, and restore the authoritative snapshot after a `409` lifecycle conflict or another rejection. The queue drag path at `application.js:1749` already demonstrates the correct immediate-placement behavior.
3. **Responsive thread-note deletion — high.** `frontend/src/app/responsive/thread.js:338` waits for the delete request, then refreshes the thread. The canvas runtime already has the required pattern in `delete-note-controller.ts:18`: remove the note locally, render, persist, and restore the removed note when the commit fails. The responsive surface must use the same state transition and rollback contract.
4. **Regular-ledger zone and group deletion — high.** `delete-selected-zones.ts:10` and `delete-selected-groups.ts:11` await the server before clearing selection and rendering. `apply-ledger-mutation.ts:294` confirms that `delete-zones` removes annotations and preserves cards. Remove the selected annotations locally, refresh zone attribution, clear selection, and render before persistence. Restore the annotation snapshots and attribution after rejection.
5. **Responsive named zone and card creation — high.** `application.js:697` awaits zone creation before navigation. `application.js:704` awaits zone expansion and then card creation before navigation. Both IDs and complete records already exist on the client. Insert the zone or card into `state.ledger`, apply the required zone height in the same local transaction, navigate immediately, then persist the mutation sequence. Restore the previous ledger and route after rejection. The canvas drawing handlers already insert these same entity types before their requests.
6. **Card-image deletion — normal.** `delete-card-image-controller.ts:34` closes the overlay before the request but leaves the image in card content until server reconciliation. Remove the markdown image and its `imageSizes` entry from the local card, render immediately, and preserve the previous markdown plus image metadata until the request succeeds. Restore that snapshot after rejection. The filesystem asset remains a server-owned side effect and must only be considered deleted after acknowledgement.

---

## D. Existing Optimism With Missing State or Recovery

1. **Card title, card description, and region label edits are DOM-only optimism.** `begin-ledger-card-edit.ts:36`, `begin-ledger-card-edit.ts:72`, and `begin-zone-label-edit.ts:27` leave the edited text visible but do not update `state.activeLedger` before persistence. A refresh can replace the edit, and a failed commit has no explicit restoration. Apply the patch to local ledger state before sending it, then restore the previous field after rejection.
2. **Zone color is preview-only optimism.** `apply-zone-color-edit.ts:22` changes CSS and the attribution preview, then sends the mutation. A failed commit returns `false` without restoring the confirmed color. Store the previous color, patch local ledger state, and restore the previous color plus attribution cache after rejection.
3. **Codex model and effort selection is control-only optimism.** The native selects change before `persistCardCodexRunPreference()` runs, but the card fields remain unchanged until `commitActiveLedgerMutation()` completes. Update `codexRunModel` and `codexRunEffort` in local card state, synchronize every mounted control from that local pair, and restore the confirmed pair after rejection.
4. **Canvas create and paste paths lack rejection recovery.** `create-card-from-rect.ts`, `create-zone-from-rect.ts`, `create-group-from-rect.ts`, and `paste-selection-controller.ts` insert entities before persistence, but none restores the previous ledger when `commitActiveLedgerMutation()` returns `false`. Preserve a transaction snapshot and mark persistence failure without leaving an unacknowledged object indistinguishable from confirmed state.
5. **Task intake already exposes a recoverable pending state.** `application.js:1816` inserts the task with `persistenceState: 'creating'`; rejection changes it to `failed`. This path should remain optimistic. Its missing pieces are Control Room intent overlay, explicit retry, and held-state invalidation.

---

## E. Actions Correctly Outside Optimistic Success

1. **Codex run admission, cancellation, restart, and session deletion require server confirmation.** These operations allocate execution identity, stop live processes, and remove runtime artifacts. The current pending labels are appropriate; the UI must not claim successful execution state before the server responds.
2. **Project synchronization and federation-library synchronization require remote results.** Their result identities and peer outcomes do not exist locally before acknowledgement.
3. **Project creation, ledger creation, project unregister, and ledger deletion require filesystem and catalog side effects.** Their visible success remains server-authoritative.
4. **Settings persistence remains server-authoritative.** The saved result depends on validation and durable workstation configuration.
5. **Already-correct optimistic paths require no interaction redesign.** Queue dragging, manual master completion, task-intake creation, canvas geometry, image resizing, questionnaires, git review notes, desktop note deletion, note creation, voice-note updates, and thread file/image attachment already apply local intent before persistence. Their existing rollback quality is covered separately in Section D where incomplete.

---

## F. Required Technical Architecture

1. **Create one optimistic ledger transaction coordinator.** It accepts a mutation, full project and replica scope, a deterministic local reducer, a render/navigation effect, and a rejection restorer. It assigns a monotonic client mutation sequence so an older response cannot overwrite a newer local edit.
2. **Use a Control Room intent overlay.** Maintain pending deletion and lifecycle intents by full task identity. Apply the overlay to every `/api/control-room` response before replacing `state.controlRoom`. Clear an intent only when the authoritative projection confirms it. This extends the existing `optimisticExecutionIntents` design instead of adding per-screen exceptions.
3. **Separate local projection invalidation from federation publication.** Return all locally changed entity identities from the task commit in addition to publishable deltas. Invalidate the owning Control Room slice from the complete local change set. Continue filtering held entities only at the federation publication boundary.
4. **Carry replica scope on every mutation.** Resolve `projectId` and `replicaNodeId` from the active route when the interaction begins and retain that scope through acknowledgement, rollback, and refresh.
5. **Make rejection non-fatal.** A failed mutation must restore confirmed state, expose a scoped retryable error, keep the server process alive, and leave unrelated requests operational. Mutation validation and projection refresh failures must not escape the request boundary.
6. **Use one reconciliation rule.** Success replaces the transaction snapshot with the acknowledged scoped ledger. Rejection discards optimistic state and loads the server-confirmed scoped ledger. A stale Control Room response is filtered through pending intents before it reaches the screen.

---

## G. Verification Required Before Completion

1. **Immediate application.** Delay each mutation response and assert that the visible card, status, note, zone, group, created entity, image, or edited field changes before the response resolves.
2. **Durable success.** Resolve the request successfully, perform a fresh scoped reload, and assert byte-equivalent canonical state.
3. **Rejection recovery.** Reject the request and assert restoration of server-confirmed state, one scoped error, continued server availability, and no unrelated state loss.
4. **Stale-response resistance.** Deliver a stale ledger response and a stale Control Room response while an intent is pending. Assert that neither response reverses the local action.
5. **Held-state invalidation.** Create a held task, mutate it, and delete it before activation. Assert that local projection revisions advance while federation publication remains held, and that the Control Room removes the deleted task.
6. **Replica ownership.** Execute each task interaction against a remote-owned card and assert the exact `x-decision-os-replica-node` value on mutation and reconciliation requests.
7. **Deletion route behavior.** Delete a master task, keep the request pending, and assert immediate Control Room navigation plus row removal. Confirm that a rejected request restores a clickable task whose card route resolves.

---

## H. Delivery Order

1. **First:** correct held-state Control Room invalidation and add full replica routing.
2. **Second:** implement the shared optimistic transaction coordinator and Control Room intent overlay.
3. **Third:** migrate card deletion and lifecycle transitions.
4. **Fourth:** migrate responsive note deletion, zone/group deletion, named creation, and card-image deletion.
5. **Fifth:** complete rollback for DOM-only and existing optimistic paths.
6. **Sixth:** run the behavioral matrix in Section G on the served workstation surface and the operator-validated phone surface.

---

## I. Report Status

1. **Analysis only.** No runtime implementation was changed.
2. **Audit result.** Six server-blocking families require optimistic conversion. Three partial-optimism families and four canvas create/paste paths require state or rollback completion.
3. **Primary production issue retained.** The deleted `New task intake` card remains the highest-priority reproduction because its tombstone is authoritative, its held marker persists, and its Control Room representation is stale.
