# Epoch 4 Document State and Content Replication Analysis

## A. Repository Intent

1. **Task structure and narrative bytes are separate authorities.** Cards, relationships, assignments, executions, note lifecycle, and content heads belong to causal task state. Card Markdown and thread Markdown remain durable documents under `.decision-os/cards/` and `.decision-os/threads/`.
2. **A thread is not reconstructible from task entities alone.** `task-domain-lane-encoder.ts:8` excludes `message`, `body`, `content`, and `markdown` from causal entities. The selected thread Markdown object therefore owns the conversation text.
3. **A card body has the same dependency.** The same encoder excludes `description` and `what`; the selected card Markdown object owns the narrative body.
4. **One note contribution has two durable representations.** The canonical Epoch 4 architecture requires the `thread-note` entity and the resulting thread Markdown content head in the same causal batch (`epoch-4-task-assignment-execution-and-content.md:40-48`).
5. **State synchronization transfers heads, not bodies.** A content head carries the resource key, SHA-256, byte count, timestamp, and source replica. Missing object bytes are fetched by exact hash (`epoch-4-task-assignment-execution-and-content.md:68-76`).
6. **Epoch 4 production admission remains incomplete.** Mobile migration, relay deployment, three-party convergence, bidirectional execution, and cross-node artifact retrieval are still open (`epoch-4-task-execution-iteration-status.md:190-198`).

---

## B. Current Iteration Intent

1. **Separate card state from thread state in the browser.** Navigating between cards must not replace or clear the active thread document.
2. **Persist local intent before relay confirmation.** A message, transcription, card-body edit, and thread-body edit must survive a failed request, server restart, and relay outage once locally accepted.
3. **Replicate critical text documents reliably.** Card Markdown and thread Markdown must become available on another participating node without depending on a user opening the document while its source node is online.
4. **Keep binary policy selective.** Images remain exact-hash, demand-driven assets. Raw voice audio remains local. Transcription text travels inside the replicated thread document.
5. **Preserve the last validated visible state.** A missing object, conflict, failed refresh, failed causal commit, or unavailable peer must not produce an empty card or empty thread.

---

## C. Findings

1. **Critical drift — responsive navigation and thread hydration share one mutable owner.**
   1. `ledgerNavigationProjection()` deliberately returns cards, annotations, and relationships without `threadFiles`, `notes`, and `deletedNoteIds` (`backend/src/business/server/helper/ledger-read-models.ts:47-66`).
   2. `loadActiveThreadSlice()` correctly fetches one thread document and installs its notes into `state.activeLedger` (`frontend/src/runtime/thread/effect/load-active-thread-slice.ts:91-173`).
   3. `syncMobileThreadContext()` then directly assigns `input.ledger` to that same `canvasState.activeLedger` (`frontend/src/app/responsive/thread.js:112-138`).
   4. The responsive route owns a separate `state.ledger` and repeatedly passes it through this direct assignment (`frontend/src/app/responsive/application.js:2728-2735`, `2900-2908`).
   5. **First incorrect transition:** a valid thread slice exists, navigation supplies a deliberately thread-less ledger, and the direct assignment replaces the object that owns the hydrated thread.
   6. **Observed symptom:** a full reload fetches the thread again; leaving the card and returning can show an empty thread without deleting the Markdown file.

2. **Critical gap — mutable Markdown is written before the causal document commit.**
   1. The HTTP mutation route materializes required inputs, then calls `applyLedgerMutation()` (`backend/src/business/server/helper/create-http-server.ts:4227-4253`).
   2. `applyLedgerMutation()` writes card Markdown and thread Markdown immediately. Note actions call `writeThreadNotesFile()`; card-body edits call `writeCardDescriptionFile()` (`backend/src/business/ledger/helper/apply-ledger-mutation.ts:205-233`, `257-310`, `439-520`).
   3. Only afterward does `executeMutation()` capture those files, append their resource heads to the domain changes, and persist the causal batch (`backend/src/business/task-state/helper/project-task-state.ts:216-269`).
   4. **Failure result:** if capture or causal persistence fails, the mutable sidecar already contains new bytes while the selected content head still identifies the previous object.
   5. The watcher later calls `recordContentContribution()` in a detached repair path (`backend/src/business/server/helper/create-http-server.ts:969-998`). That second path can heal the mismatch when task state is writable, but it does not make the original mutation atomic.
   6. **Contract violation:** the note entity and head are atomic inside task state; the mutable document installation is outside that transaction.

3. **High omission — head convergence does not guarantee document-byte durability on another node.**
   1. Applying a remote manifest records the head but queues no transfer (`backend/src/business/federation/helper/federation-content-replica-store.ts:37-48`).
   2. Demand is held only in runtime memory. The file explicitly defines it as `runtime-only exact-object demand`; `prioritize()` creates demand only after a reader requests the resource.
   3. Remote card and thread routes enqueue content only when those exact routes are read (`backend/src/business/server/helper/create-http-server.ts:2047-2088`).
   4. If the source node disappears after head convergence and before a second node requests the object, the second node knows the exact hash but does not possess the bytes.
   5. `/api/federation/replication-status` reports causal roots, conflict counts, the local runtime queue, and local runtime resource entries (`backend/src/business/server/helper/create-http-server.ts:2931-2952`). It does not report per-peer possession of each selected document object.
   6. **Diagnostic consequence:** `converged: true` can be correct for task state while card and thread Markdown remain unavailable on a peer.

4. **High drift — critical Markdown and optional binary assets use the same lazy availability policy.**
   1. The content store handles `card-markdown`, `thread-markdown`, and `managed-asset` through the same demand map.
   2. This is appropriate for large images and raw audio.
   3. It is insufficient for small authoritative Markdown because causal entities deliberately omit narrative bytes.
   4. **Result:** the system treats the only recoverable copy of a conversation like an optional image cache entry.

5. **High gap — conflict handling stops safely but does not resolve document conflicts.**
   1. Materialization correctly rejects multiple distinct content identities with `409` and preserves existing bytes.
   2. `mergeableTaskConflictChanges()` automatically resolves only same-phase lifecycle refreshes and compatible execution artifact sets (`backend/src/business/task-state/helper/resolve-mergeable-task-conflicts.ts`).
   3. It has no resource-head rule and no thread-document merge rule.
   4. Identical hashes are already one content identity. Divergent thread hashes can be merged automatically only when parsing proves that note IDs are disjoint and that repeated note IDs have byte-identical bodies.
   5. Divergent card Markdown is not generally losslessly mergeable. It must retain both immutable candidates and keep the last validated visible value until an explicit content merge produces a new head.

6. **Medium omission — document state has no single observable status.**
   1. One logical card document is spread across card ownership metadata, a resource-head entity, an immutable object, a mutable sidecar, and an optional federation cache object.
   2. One logical thread document adds a separate `threadFiles/<threadId>` ownership lane and separate `thread-note` entities.
   3. The APIs expose fragments of this state, but no response reports the complete tuple: selected head, local immutable object, local sidecar match, peer possession, pending contribution, and conflict candidates.
   4. This makes a visual empty state, a local materialization failure, and a remote object-availability failure look like the same problem to the operator.

7. **Medium test omission — the two failure chains are not covered end to end.**
   1. Existing tests cover missing-input materialization, stale sidecars, exact-hash validation, Codex fail-closed admission, resource-head capture, and on-demand scheduling.
   2. No test injects failure after `writeThreadNotesFile()` and before `persistChanges()`, then proves that the prior sidecar and prior head remain paired.
   3. No task-document federation test performs a card-body edit and thread-note append on node A, waits for node B to retain both immutable objects without reading them, disconnects node A, restarts node B, and proves both documents remain readable.
   4. The existing owner-disconnect test proves structural card detail and complete skill-library retention; it does not prove updated card Markdown plus thread Markdown retention (`backend/test/server/federation-node-connector.integration.test.ts:940-1023`).

8. **Exact Lys evidence — the reported document is locally sound now, while system guarantees remain incomplete.**
   1. Project: `ZGV2L2x5cw`.
   2. Card: `card-3df74ad9-e109-4452-a6dc-de81bd5d5564`.
   3. Card Markdown: `4,974` bytes, SHA-256 `58e112b61bb44c690aee1aa999f691452707a87122bff1951defdb85dfd352e0`.
   4. Thread: `thread-card-3df74ad9-e109-4452-a6dc-de81bd5d5564`.
   5. Thread Markdown: `8,020` bytes, SHA-256 `650f3d5e65d3bb29dbc745404b8f5ffbe8dfb878b73fc66ca928a9b4c857dc04`, containing `7` notes.
   6. The local sidecars match their selected immutable content heads.
   7. The Lys state store reports projection version `4`, `243` entities, `0` journal entries, and `19` project-level conflicts.
   8. The local content lane reports `queueDepth: 0`, `resources: []`, and `running: false`. That proves no local transfer is pending; it does not prove another node possesses these two objects.

9. **Critical gap — local reads trust any existing sidecar without verifying the selected head.**
   1. `ledgerCardProjection()` and `ledgerThreadProjection()` read an existing mutable file directly (`backend/src/business/server/helper/ledger-read-models.ts:68-86`).
   2. The scoped HTTP route invokes exact-head resolution only when the mutable file is missing (`backend/src/business/server/helper/create-http-server.ts:2823-2842`).
   3. **Failure result:** after a newer remote head arrives, an older local sidecar can remain visible because the read path never compares its SHA-256 and byte count with the selected head.
   4. Mutation materialization detects this mismatch and fails closed, but ordinary reads can still present the stale body as current.
   5. The read contract must serve a sidecar as current only when it matches the unique selected head. During exact-object retrieval it must retain the last validated visible document with a synchronizing status.

10. **High drift — a missing card head is treated as empty while a missing thread head is treated as unavailable.**
    1. A remote card with a content-file reference, no content head, and a converged relay root is returned as a synchronized card with no body (`backend/src/business/server/helper/create-http-server.ts:2057-2060`).
    2. A remote thread with the same evidence remains synchronizing (`backend/src/business/server/helper/create-http-server.ts:2070-2085`).
    3. The card behavior converts **missing replication evidence** into **authoritative empty content**.
    4. Existing card and thread sidecars that predate head capture need a bounded repair pass. Every referenced local Markdown file without a head must be captured and published without rewriting its bytes.

11. **High omission — watcher-imported thread Markdown can diverge from note entities.**
    1. A normal note mutation persists the note entity and thread head in one causal batch.
    2. A direct thread-file watcher event records only the resource head (`backend/src/business/server/helper/create-http-server.ts:983-993`).
    3. Because note bodies are not present in `thread-note` entities, the watcher can publish a document containing stable note identities that structural note state does not contain.
    4. Deletion and restoration then consume different durable evidence from thread readers and agents.
    5. A watched thread import must parse and validate note identities, then persist note metadata and the document head through one scoped contribution command.

12. **Critical omission — optimistic text intent is discarded before causal acknowledgement is installed.**
    1. Text-message intent is correctly stored in browser `localStorage` before submission (`frontend/src/runtime/thread/effect/persist-pending-thread-message.ts:1-21`).
    2. `commitPendingThreadMessage()` deletes that durable receipt on any successful HTTP response (`frontend/src/runtime/thread/effect/commit-pending-thread-message.ts:27-56`).
    3. The server response already contains `taskClock` and a mutation-bound receipt (`backend/src/business/server/helper/create-http-server.ts:2785-2793`).
    4. `sendActiveLedgerMutationResult()` discards both fields and returns only HTTP status (`frontend/src/runtime/ledger/effect/send-active-ledger-mutation.ts:10-38`).
    5. The responsive transaction path also ignores each mutation receipt and installs a later canvas confirmation outside its causal clock gate (`frontend/src/app/responsive/application.js:650-698`).
    6. **Failure result:** an older relay or thread response can be installed after local persistence because this path never records the minimum task clock that future state must cover.
    7. Pending intent must remain durable until the exact mutation receipt is validated and its task clock is installed. Every later card and thread projection must dominate that clock.

13. **High diagnostic gap — document conflicts are absent from normal projection conflict reporting.**
    1. Resource entities are explicitly skipped by `materializeTaskCurrentEntity()` (`backend/src/business/task-state/helper/materialize-task-current-entity.ts:136-138`).
    2. Document conflicts are discovered by content-head readers and materializers, not included in `projection().conflicts`.
    3. The Lys count of `19` therefore describes structural projection conflicts only; it is not a complete document-conflict count.
    4. Replication diagnostics must enumerate distinct selected resource identities independently from structural conflicts.

---

## D. Remediation Paths

1. **Rejected — add more merge guards around `activeLedger`.** This leaves navigation, card documents, and thread documents sharing one mutable owner. Another direct assignment can reintroduce the same loss.
2. **Rejected — eagerly replicate every asset.** This violates the selective-transfer constraint and spends bandwidth on images and raw voice payloads that are not required to reconstruct text state.
3. **Selected — introduce one narrow document boundary with separate frontend owners and durable Markdown replication.**
   1. Add `cardDocumentByIdentity` keyed by `projectId/replicaNodeId/ledgerId/cardId`.
   2. Add `threadDocumentByIdentity` keyed by `projectId/replicaNodeId/ledgerId/threadId`.
   3. Store document ownership, selected head, hydration status, last validated body, pending local contribution, and conflict candidates in those stores.
   4. Keep responsive `state.ledger` limited to navigation and card structural state.
   5. Make thread rendering consume only `threadDocumentByIdentity`. Navigation replacement must not write that store.
   6. Replace direct `canvasState.activeLedger = input.ledger` thread ownership with a context pointer plus explicit document-store hydration.
   7. Return mutation receipts and task clocks through the text-message and responsive transaction paths. Retain optimistic intent until that exact receipt is admitted.
   8. Verify every existing card and thread sidecar against the unique selected head before serving it as current.
   9. Capture referenced historical card and thread sidecars that have no head through a bounded, non-rewriting repair command. Remove the remote-card converged-empty exception.
   10. Stage new Markdown in a temporary file. Capture and verify its immutable object. Persist semantic entity changes plus the new content head. Atomically install the sidecar only after the causal commit succeeds.
   11. Route watcher imports through the same document-contribution service. A thread import includes parsed note metadata and the head in one command. The watcher remains responsible for external file edits, not repair of normal HTTP mutation ordering.
   12. After local commit, write a durable replication outbox entry for each new `card-markdown` and `thread-markdown` object. Upload the exact immutable object to relay-retained content storage in the background. Local request success does not wait for relay transport.
   13. A receiving node durably fetches selected Markdown from relay-retained storage with bounded retry. It removes demand only after hash and byte-length verification plus atomic object installation.
   14. Keep `managed-asset` demand runtime-driven. Keep raw voice audio local. Replicate transcription through thread Markdown.
   15. Extend replication diagnostics per selected Markdown head with `headConverged`, `objectLocal`, `sidecarMatches`, `relayRetained`, `peerReceipts`, `pendingDemand`, and `conflictCandidates`.
   16. Add failure injection at the sidecar-to-causal-commit boundary, stale-sidecar read coverage, mutation-receipt rollback coverage, missing-head repair coverage, and the source-offline two-document federation test before changing the served behavior.

---

## E. Operator Decision Summary

1. **The visible empty-thread regression and the document-replication weakness are linked, but they are not the same failure.**
2. **The visible regression is a frontend ownership overwrite:** a partial navigation ledger replaces an independently hydrated thread slice.
3. **The durability weakness is a backend transaction and replication-policy gap:** sidecar installation precedes causal commit, while peer document bytes remain purely on demand.
4. **The stale-read weakness is a backend authority gap:** an existing sidecar is trusted without proving it matches the selected head.
5. **The optimistic-message weakness is an acknowledgement gap:** HTTP success deletes local intent before the returned causal receipt protects future installs.
6. **The selected correction is bounded:** separate two frontend document stores, enforce task-clock receipts, verify reads against heads, install Markdown after causal persistence, and retain only card and thread Markdown in relay content storage.
7. **No task-state schema rewrite is required for the first correction.** Existing content heads, immutable objects, materialization verification, and scoped read endpoints remain useful.
8. **Do not describe Epoch 4 as cross-node document-safe until the source-offline card-plus-thread test and three-party production evidence pass.**
