# Epoch 4 Two-Document Defect and Factorization Reassessment

## A. Repository Intent

1. **Epoch 4 separates causal task structure from document bytes.** A card entity carries task metadata and a `contentFile` reference. A resource entity carries the active SHA-256 head. The immutable object store carries the exact Markdown bytes. The mutable workspace file is a materialized sidecar.

2. **Thread state has the same separation.** Thread-note entities carry note identity and lifecycle metadata. The thread resource head and immutable Markdown object carry the conversation text.

3. **Navigation, card-document, and thread-document reads are deliberately scoped.** Navigation omits card bodies, thread files, notes, and deleted-note state in `backend/src/business/server/helper/ledger-read-models.ts:47-66`. The card and thread routes hydrate their own documents.

4. **The required invariant is:**

   ```text
   structural owner reference
   -> exactly one active resource head
   -> an immutable object matching the declared hash and byte length
   -> an independently owned frontend document state
   ```

5. **This reassessment covers exactly two operator-visible defects:**

   1. The Ardaria master-task structure replicated, while its master Markdown body remained empty on the other node.
   2. A task thread reappeared after a full reload, then became empty after navigating away and back.

6. Voice capture, pipeline execution, generic task conflicts, and offline asset retention are not additional defects in this report.

---

## B. Current Iteration Intent

1. Determine the first incorrect transition for each defect.

2. Separate verified evidence from rejected clues and unverified event-order hypotheses.

3. Identify the shared factorization failure, duplicated responsibilities, legacy paths, and undocumented domain choices.

4. Select the smallest correction that fits the current Epoch 4 entity, resource-head, immutable-object, and scoped-read architecture.

5. Preserve current task structure and validated document bytes. The solution must not manufacture empty documents, hide dangling references, or redesign the Epoch 4 CRDT.

---

## C. Findings

### C.1 Problem 1 — Ardaria Master Body Did Not Replicate

1. **Observed defect.** Card `card-b3918920-c2f3-4039-b046-51cf877863b1` has synchronized master-task structure, while the remote read returns no master Markdown body.

2. **The document bytes are intact.** The authoritative file is:

   ```text
   /media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7/Ardaria_57/.decision-os/cards/tasks/card-b3918920-c2f3-4039-b046-51cf877863b1.md
   ```

   It is `7,198` bytes with SHA-256 `7c1058423d591c1c2f8aba30ec3b9eaa128f73b3f6d72df50f58a65ba2a2e722`.

3. **The resource relationship is absent.** The local content manifest returns zero resource heads for the master card. The project task state has `82` entities, no journal entries, no projection conflict, and the relay root has converged to `06a8023520d0a3b1840e614db85e53d97889a70bd2119f8d1cb05cdc4b75134f`.

4. **The source-offline clue is rejected.** Federation settings report both `workstation` and `phone` online. More importantly, an absent head creates no content demand. Connectivity cannot fetch an object whose resource identity was never published.

5. **The relay-lag clue is rejected.** The two-node reproduction converged on the same root with zero dirty entries and zero pending deliveries. Nine of Ardaria's twelve task-card Markdown files have no resource head. A control card with a head returns its body, and the master thread with a head returns all thirteen notes.

6. **The historical creation sequence explains the omission.**

   1. The master graph was created before commit `a263b947` (`Persist task content before replication`).
   2. `applyLedgerMutation()` wrote the master and subtask Markdown files before their ownership existed in the Epoch 4 task projection.
   3. The filesystem watcher attempted to infer card ownership from the stale aggregate path.
   4. `backend/src/business/ledger/helper/resolve-card-content-change.ts:40-67` and `:97` discard a change when ownership is missing or ambiguous.
   5. The mutation command persisted the card entities, but the pre-`a263b947` command did not include the newly created card resources.
   6. Later thread-note mutations ran after ownership existed and published thread heads, which is why thread documents replicated while the original card bodies did not.

7. **Direct defect.** The causal task mutation created a `contentFile` reference without atomically creating its resource-head entity. The watcher was an implicit second writer and silently dropped the only attempted publication.

8. **Current prevention is correct but incomplete.** `backend/src/business/task-state/helper/task-mutation-content-resources.ts:23-54` now derives card and thread resources for declared mutations. `backend/src/business/task-state/helper/project-task-state.ts:240-261` captures those files and journals their heads with the structural command. `backend/test/task-state/project-task-state.test.ts:434-471` covers new master and child heads. There is no historical backfill for pre-fix tasks.

9. **A second bad choice converts damage into false success.** `backend/src/business/server/helper/create-http-server.ts:2047-2067` treats a converged card with zero heads as an authoritative empty body. Commit `58c090f2` introduced that compatibility behavior, and `backend/test/server/federation-node-connector.integration.test.ts:912-925` codifies HTTP `200`, `state.status="synchronized"`, and `content.status="missing"` for a headless card.

10. **The missing semantic distinction is undocumented.**

    1. A card with no `contentFile` is a valid bodyless card.
    2. A card with a `contentFile` and no head is a dangling document reference.
    3. Those states are currently collapsed into the same successful empty result.

11. **Classification.**

    1. **Omission:** the historical causal command omitted created card resources.
    2. **Drift:** the read path treats a dangling reference as synchronized empty content.
    3. **Gap:** startup and replication diagnostics do not audit owner-reference-to-head coverage.

### C.2 Problem 2 — Thread Disappears After Navigation

1. **Observed defect.** A full page reload restores the thread, but navigating away and returning renders the thread empty.

2. **Durable-loss and backend-read clues are rejected.** Reload retrieves the thread again. Therefore, the Markdown object and scoped thread API remain capable of returning the document. The first incorrect transition occurs in frontend state after hydration.

3. **The frontend has two ledger owners.**

   1. `frontend/src/app/responsive/application.js:38-60` owns responsive `state.ledger`.
   2. `frontend/src/runtime/state.ts:64-145` owns shared `state.activeLedger`.

4. **Navigation returns a deliberately partial ledger.** `loadLedger()` receives the navigation read model, which contains card structure but excludes thread files, notes, and deleted-note state.

5. **The partial navigation object is installed as a complete active ledger.** `frontend/src/app/responsive/thread.js:112-138` assigns:

   ```js
   canvasState.activeLedger = input.ledger;
   ```

6. **That assignment bypasses the documented coordinator.** `frontend/src/runtime/ledger/effect/reconcile-active-ledger-state.ts:143-147` describes `replaceActiveLedger` as the only production assignment boundary. The responsive bridge assigns `activeLedger` directly at `thread.js:128` and again during legacy refresh reconciliation at `thread.js:352`.

7. **Thread hydration is stored inside the object that navigation replaces.** `frontend/src/runtime/thread/effect/load-active-thread-slice.ts:91-173` inserts `threadFiles`, `notes`, and deleted-note identities into the current `activeLedger`. A later navigation load can replace that enriched object with a new navigation-only object.

8. **Direct defect.** The thread document has no independent frontend state owner. A structural navigation response is allowed to replace the aggregate that also contains the hydrated thread document.

9. **Why reload appears to repair it.** Reload starts a new hydration sequence and fetches the scoped thread slice again. It does not repair persistence; it reconstructs the lost in-memory document state.

10. **Verified hypothesis boundary.** The code proves that route and refresh paths can install a thread-less navigation object after thread hydration. The exact callback ordering for the operator's click-away-and-back sequence has not been browser-recorded in this analysis. This timing detail is not required to establish the ownership violation, but it must be captured by the regression test before a success claim.

11. **Existing recovery work does not cover this sequence.** Commit `3abee8df` retries an interrupted first thread hydration. `tests/browser/application/the-application-is-one-responsive-frontend.spec.ts:235-280` covers an aborted first thread request. It does not cover a successfully hydrated thread being replaced by navigation and then revisited.

12. **Classification.**

    1. **Drift:** the responsive frontend recombines the scoped backend read models into one replaceable aggregate.
    2. **Duplication:** responsive state and shared runtime state both claim active-ledger ownership.
    3. **Legacy remain:** `refreshThreadLedger()` and `reconcileResponsiveThreadLedger()` retain an older whole-ledger refresh path beside `loadActiveThreadSlice()`.
    4. **Gap:** no test exercises hydrate thread, navigate away, return, and assert continuous visibility.

### C.3 Shared Factorization Failure

1. **Both defects are failures to make `Document` a first-class state boundary.**

   1. Backend Problem 1 loses the link from structural owner to document head.
   2. Frontend Problem 2 loses the document state when structural navigation replaces its container.

2. **Backend document responsibilities are duplicated across six paths.**

   1. `apply-ledger-mutation.ts` writes sidecars.
   2. `task-mutation-command.ts` maps actions to structural changes.
   3. `task-mutation-content-resources.ts` independently maps actions to output resources.
   4. `materialize-task-mutation-inputs.ts` independently maps actions to input resources.
   5. `create-http-server.ts` independently derives changed-card, changed-thread, and created-file response metadata.
   6. The filesystem watcher re-discovers ownership after the mutation.

3. **This action taxonomy is not exhaustive at the type boundary.** A new mutation can write a document while omitting its head because structural changes, input materialization, output capture, and response reporting are maintained as separate switch-like mappings.

4. **The watcher retains the wrong responsibility.** It is appropriate for importing external filesystem edits. It must not be required for correctness of an API-owned task mutation.

5. **Frontend document responsibilities are duplicated across three paths.**

   1. Responsive navigation owns `state.ledger`.
   2. Shared runtime owns `state.activeLedger`.
   3. Thread hydration mutates document fields inside `activeLedger`, while legacy refresh reconstructs another whole ledger.

6. **The untyped aggregate permits category errors.** `state.activeLedger` is effectively untyped, so a navigation projection can be assigned where a hydrated card-and-thread aggregate is expected.

7. **Legacy compatibility fields conceal the boundary.** `comment.what`, `threadFiles`, and `notes` remain embedded in ledger-shaped frontend objects even though Epoch 4 reads and persists their content independently.

8. **The current architecture documentation specifies backend causal representation but not frontend document ownership.** It also does not specify the invalid state `contentFile present + zero heads`, which allowed the false-success read rule.

9. **`recordContentContribution()` mixes two concerns.** It persists resource heads and activates a held task identity. Historical document repair must not activate tasks as a side effect. The resource-head persistence primitive must be independently callable.

---

## D. Remediation Paths

### D.1 Problem 1 — Repair and Enforce Document-Head Completeness

1. **Immediate recovery:** publish a scoped causal backfill for the nine existing Ardaria card Markdown files that have a `contentFile`, existing bytes, and zero heads.

2. **Preserve the bytes exactly.** Capture each existing file through the immutable object store, verify SHA-256 and byte length, persist one resource-head entity, and publish the resulting task-state delta. Do not rewrite the Markdown.

3. **Separate persistence from activation.** Extract an internal `persistTaskContentHeads(resourceIds)` primitive from `recordContentContribution()`. Keep task activation in the operator-contribution path only.

4. **Replace the false-success rule.**

   1. No `contentFile` returns a valid bodyless card.
   2. `contentFile` plus zero heads returns explicit `missing_head` degraded content.
   3. Structural card state remains readable.
   4. The server never reports that dangling document as synchronized empty content.

5. **Return the actual write receipt.** Extend `applyLedgerMutation()` to return the exact `changedContentFiles` it wrote. Pass that receipt to `executeMutation()` for immutable capture and head journaling. Delete the parallel output enumeration in `taskMutationContentResources()`. Keep pre-mutation input materialization as the read precondition; it is not an output-discovery mechanism.

6. **Restrict watcher ownership.** API-owned mutations publish their document heads synchronously. The watcher imports external edits only.

7. **Add a bounded referential audit.** For every local card and thread `contentFile`:

   1. Existing file plus no head triggers deterministic causal repair.
   2. Head plus missing object records a scoped content incident and begins exact-object recovery.
   3. Missing file plus no head records `missing_document` and preserves structural state.

8. **Acceptance evidence:**

   1. All nine recovered files have one head matching their exact local hash and byte length.
   2. Both nodes and the relay converge on the new root.
   3. The remote master body equals all `7,198` authoritative bytes.
   4. Fresh reloads preserve the body.
   5. Diagnostics report zero dangling local document references.

### D.2 Problem 2 — Give Thread Documents an Independent Frontend Owner

1. **Add `ThreadDocumentState` keyed by** `projectId/replicaNodeId/ledgerId/threadId`.

2. **Store only document-owned data there:** `contentFile`, notes, deleted-note identities, installed task clock, hydration status, last validated document, and optimistic pending intents.

3. **Keep responsive `state.ledger` structural.** Navigation loads may replace structural cards, zones, groups, and selection context. They cannot replace thread documents.

4. **Make `loadActiveThreadSlice()` write only the keyed thread-document store.** Thread rendering, text-message optimism, voice transcription insertion, delete, and restore consume that store.

5. **Reduce `syncMobileThreadContext()` to context synchronization.** It may update active project, replica, ledger, thread identity, and callbacks. Remove both direct `canvasState.activeLedger` assignments.

6. **Remove the legacy whole-ledger thread refresh.** Delete `refreshThreadLedger()` and `reconcileResponsiveThreadLedger()` after their callers use the scoped thread-document loader.

7. **Keep card structure separate from thread state.** Card navigation and task status updates continue through the structural reconciliation coordinator. They cannot clear a thread document.

8. **Acceptance evidence:**

   1. Open a populated thread.
   2. Record the rendered note identities.
   3. Navigate to another card and return.
   4. Assert the notes never render as empty between route transitions.
   5. Resolve a delayed older navigation response and prove it cannot replace the thread document.
   6. Reload and prove the scoped thread document still matches the server.
   7. Reject a pending mutation and prove reconciliation returns to the last server-confirmed thread document.

### D.3 Architectural Documentation

1. Document five independent authorities:

   ```text
   task/card structural state
   card document state
   thread note lifecycle state
   thread document state
   asset state
   ```

2. Document `contentFile present + zero heads` as an invalid dangling reference.

3. Document the watcher as an external-edit importer, not a normal mutation commit mechanism.

4. Document the frontend rule that structural navigation cannot install, clear, or supersede card and thread document state.

---

## E. Operator Decision Summary

1. **Problem 1 is not a network-availability defect.** The master body never entered Epoch 4 resource state. Current code prevents the creation race for new tasks, but historical files require a causal backfill and the read path must stop calling a dangling document synchronized.

2. **Problem 2 is not durable thread loss.** The frontend stores hydrated thread content inside a ledger object that navigation is allowed to replace. Reload only rehydrates that lost in-memory state.

3. **The common technical debt is missing document ownership.** Backend code duplicates the mutation-to-document plan. Frontend code duplicates active-ledger ownership. Both permit structural state to exist without a protected document lifecycle.

4. **The selected correction fits Epoch 4.** Keep the existing entities, heads, immutable objects, and scoped APIs. Add one backend mutation write receipt, one referential audit and repair path, and independent frontend card/thread document stores.

5. **Implementation order:**

   1. Backfill and verify the nine Ardaria heads.
   2. Remove the headless-card false-success rule.
   3. Add the referential audit and mutation write receipt.
   4. Introduce independent `ThreadDocumentState`.
   5. Remove direct responsive `activeLedger` replacement and the legacy whole-ledger thread refresh.
   6. Add the exact navigation regression and cross-node document verification.
