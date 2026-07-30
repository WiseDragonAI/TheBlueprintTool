# Task CRDT Replication Recovery Goal

## A. Goal

1. **Repair the deployed causal current-state CRDT without restoring task event history.** Current entity shards, short-lived journals, immutable content objects, and the Cloudflare relay remain the architecture.
2. **Make CRDT state and application state converge exactly.** Equal project roots must imply byte-identical canonical projections. A node may report `synchronized` only after closed-loop root equality with the relay for that project.
3. **Make normal work proportional to changed current lanes.** One card mutation must not scan, clone, serialize, hash, transfer, or rewrite the complete workspace.
4. **Keep local interaction responsive.** Local success follows journal durability and in-memory join. Replication, bounded shard materialization, content transfer, and derived projection work continue without monopolizing the Node event loop.
5. **Run one offline CRDT-to-CRDT repair migration.** The final runtime accepts only state schema epoch `3` and contains no automatic migration, legacy reader, event authority, dual write, or fallback path.

---

## B. Verified Failure Model

1. The workstation project contains `3,663` current entities. Its current shards occupy approximately `19 MiB`, while owned content objects occupy approximately `691 MiB`.
2. All `1,472` thread-note entities inspected are tombstoned by replica dot `workstation:17`; recoverable note bodies remain in project sidecars.
3. Two individual thread-note entity files exceed `1 MiB` because message bodies were embedded in structural CRDT entities.
4. The lane model contains both the complete `threadFiles` projection and four child lanes. It also contains `executionIntent` together with descendants. These parent-child overlaps permit one aggregate lane to overwrite independently joined child state.
5. The federation cache occupies approximately `424 MiB`, with `1,468` resources marked available and `175` marked syncing. The deployed content behavior is not lazy.
6. The blank-node proof received `3,532` of `3,663` entities and still reported synchronization. Entity count and successful transport do not prove convergence.
7. Node and relay join behavior has drifted. Activation metadata enters replicated state, delete-versus-update has no complete presence contract, aggregate import can destructively replace state, acknowledgements do not identify accepted entity hashes, root comparison is not a closed repair loop, convergence is keyed too broadly, and protocol/schema admission is incomplete.
8. Materialization and Control Room aggregation perform unbounded synchronous work. The observed CPU problem follows from aggregate recomputation and broad content discovery, not from missing task events.
9. **The repair target is the existing sharded state CRDT.** Events and time-based snapshots are not reintroduced.

---

## C. Required CRDT Invariants

1. Node and relay use one platform-neutral implementation of canonical encoding, entity validation, dotted-register join, entity hashing, bucket hashing, and state schema.
2. Replicated entity joining is associative, commutative, and idempotent for every field and every entity attribute.
3. Local activation and held-publication metadata never participate in replicated hashes or relay state.
4. Every entity create and update writes a causal presence candidate. Delete writes a competing tombstone candidate. Concurrent update and delete remain an explicit conflict.
5. Baseline migration, typed mutations, scoped external commands, data recovery, and tests use one canonical domain lane encoder.
6. No current entity set contains both a projection path and one of that path's descendants.
7. Cards, annotations, relationships, ledger fields, thread references, thread-note metadata, and resource heads have stable independent identities.
8. Thread-note messages, card Markdown, thread Markdown, voice, images, and managed assets are immutable content objects referenced by small causal heads.
9. Materialization updates indexed maps by identity. Canonically sorted read arrays are cached by collection generation.
10. Equal current-state roots imply equal canonical projections under every entity delivery order.

---

## D. Required Durability and Background Work

1. A local mutation writes and fsyncs one short-lived journal before acknowledging success.
2. The background materializer coalesces entity keys, processes a bounded batch per event-loop turn, caps concurrent atomic writes, and deletes the journal only after all affected shards are durable.
3. A duplicate incoming delta performs zero journal writes, zero shard writes, zero derived projection work, and zero UI invalidation.
4. Structural entities enforce a strict encoded size ceiling before durability. Large values use the object lane.
5. State-frame encoding, large-content hashing, Control Room aggregation, and cache persistence do not create unbounded synchronous work on the HTTP event loop.
6. An idle converged server performs zero task aggregation, zero content discovery, zero object transfer, and zero state-repair work.

---

## E. Required Federation Contract

1. State frames are bounded by encoded bytes and entity count.
2. Each relay-bound frame carries a unique `deliveryId` and exact entity keys and hashes.
3. The relay acknowledges only after one durable join transaction and returns the accepted entity hashes and resulting relay root.
4. The node's runtime dirty map is keyed by project and entity. It clears only hashes confirmed by the matching acknowledgement.
5. Reconnect correctness comes from current shards and bidirectional root anti-entropy. No durable event outbox is introduced.
6. Root mismatch exchanges cached `256`-bucket summaries and current entities from mismatched buckets only. Repair repeats until both sides observe the same root.
7. Convergence, retry, and error state are keyed by `{peerId, projectId}`.
8. Remote readiness is derived from exact root convergence and exact demanded-content readiness, never from entity count.
9. Nodes subscribe to exact projects. The relay forwards live state only to project hosts and active subscribers.
10. A blank remote-only node bootstraps from durable relay state while project hosts are offline.
11. The manifest declares the exact state protocol, schema, and baseline epoch. Incompatible nodes are rejected before state participation.
12. A new writer and a state-lost writer remain read-only until bootstrap completes and their replica counter is above the joined clock.

---

## F. Required Content Contract

1. CRDT resource heads replicate eagerly. Object bytes transfer only after an exact route demand.
2. Connection and catalog changes transfer zero document bodies.
3. Local file changes capture and publish the exact changed resource head without complete manifest discovery.
4. Any node with a verified object may serve it as a fallback source.
5. Requesters try the head source, then remaining online replicas for the same exact hash.
6. Resource equality uses immutable hash and type rather than filesystem timestamps.
7. Content conflicts remain explicit current head candidates and are visible in query status.
8. Object reclamation is permitted only after current-head reachability and replica fencing prove the hash cannot be resurrected by a retired replica.

---

## G. Verified Status-System Failure Model

1. **The status system is not CRDT-compatible end to end.** The scalar `card.status` register is joinable, but lifecycle timestamps, execution state, subtask ordering, remote projection, CLI mutation, and Control Room invalidation are not governed by one convergent model.
2. The current shards contain `650` card entities and `643` status registers, but zero card-level `createdAt`, `waitingAt`, `closedAt`, and `completedAt` fields. Lifecycle metadata is therefore absent from the replicated card state.
3. Current card bodies contain `143` lifecycle metadata headers, `95` `Waiting since` fields, `128` `Completed at` fields, and `155` generated `Subtasks` sections. Two body files already differ from their replicated content heads. **Body parsing cannot be task-state authority.**
4. `Waiting since` is parsed from card Markdown and then overwritten by the latest thread Markdown timestamp. `Completed at` is written into card Markdown and parsed back. A remote-only node with an empty `decisionOsRoot` cannot reproduce those values from replicated structural state.
5. Execution status combines replicated `executionIntent`, node-local process and queue observations, voice observations, and the latest desktop thread role. Nodes can therefore project different execution columns from the same CRDT root.
6. Canonical subtask membership mostly comes from `372` relationships, but `274` child cards still carry a `subtask` label and runtime code still recognizes Markdown task classification and `## Subtasks` sections. Relationship delivery order currently controls subtask order and `nextSubtask` because relationships have no explicit position.
7. CLI `todo` and `done` read a complete projection, change one status, strip hydrated notes, and post the complete projection to `/api/task-state/commit`. The importer rewrites every thread and interprets omitted notes as deletions. All `1,472` inspected thread-note entities carry `workstation:17` tombstones from this destructive aggregate mutation class.
8. Concurrent distinct status candidates are silently reduced by lexicographic dot order. Unknown domain values are admitted by structural validation; tests already use `blocked`. Neither condition becomes an explicit task conflict.
9. Control Room invalidation can run before the asynchronous task commit finishes. The cache can rebuild from old state and clear its dirty marker without a post-commit invalidation. A rebuild then reads and hashes every ledger, card body, and relevant thread, which directly amplifies the observed CPU problem.

---

## H. Required Card Lifecycle and Task Graph Contract

1. **Card Markdown is narrative content only.** Runtime task state never depends on parsing card content, thread content, generated headings, labels embedded in text, filesystem timestamps, or desktop-only observations.
2. `createdAt` is immutable top-level card metadata replicated with the card entity.
3. Lifecycle is one atomic CRDT register named `lifecycle` with exactly `status`, `changedAt`, `waitingAt`, and `closedAt`. No descendant lifecycle lanes are emitted.
4. `lifecycle.status` admits exactly `todo`, `backlog`, and `done`.
5. Transition to `todo` writes `changedAt` and `waitingAt` from the transition timestamp and clears `closedAt`.
6. Transition to `backlog` writes `changedAt` and clears both `waitingAt` and `closedAt`.
7. Transition to `done` writes `changedAt` and `closedAt` from the transition timestamp and clears `waitingAt`.
8. Execution intent is a separate atomic CRDT register named `executionIntent` with exactly `id`, `state`, `changedAt`, `startedAt`, `settledAt`, and `error`. No descendant execution-intent lanes are emitted.
9. Node-local process, queue, voice, and desktop-thread observations are diagnostics. They never override replicated lifecycle or execution-intent state in the canonical task projection.
10. Desktop, responsive Control Room, CLI `todo`, CLI `done`, master completion, Codex settlement, and recovery invoke one scoped `transition-card-lifecycle` domain command. The command accepts one card identity and cannot import a complete task projection.
11. Concurrent distinct live lifecycle candidates produce an explicit `task-conflict`. Master completion and execution remain blocked until a scoped resolution mutation causally supersedes every conflicting candidate.
12. `master-task` remains card metadata. **A card is a subtask solely when it is the target of a live `subtask` relationship.** The child `subtask` label, Markdown classification, and `## Subtasks` parsing have no runtime meaning.
13. Every `subtask` relationship carries a CRDT `position`. Canonical child order is the tuple `(position, relationshipId)`, so replay and delivery order cannot change task order or `nextSubtask`.
14. The Control Room projection is incrementally maintained from card, relationship, and execution-intent entities. One card change updates that card and the relationship-owned master card only.
15. Cache invalidation is emitted after the scoped commit joins successfully. Duplicate joins emit no invalidation. Projection work runs in bounded background batches and performs no card-body or thread-body discovery.
16. State schema epoch `3` is installed by one offline migration. The migration parses legacy lifecycle headers once, assigns audited card metadata, validates subtask relationships, assigns deterministic relationship positions, removes generated lifecycle and subtask sections from bodies, captures the new content heads, and emits a semantic inventory.
17. Before writers resume, the cutover deletes runtime lifecycle parsers, Markdown subtask parsers, touch-based lifecycle migration, the aggregate `/api/task-state/commit` mutation path, child-label membership fallback, and every legacy status fallback.

---

## I. Repair and Cutover Sequence

1. Remove the destructive full-projection commit path from normal CLI and server operations. Add a fail-closed guard against undeclared bulk deletions.
2. Implement the scoped lifecycle command, atomic lifecycle and execution-intent registers, domain value validation, explicit lifecycle conflict projection, positioned subtask relationships, and post-commit invalidation.
3. Implement and property-test the shared CRDT core, canonical lane schema, presence register, metadata-free wire entity, and deterministic indexed materializer.
4. Implement bounded materialization, correlated byte-bounded delivery, closed-loop root repair, strict protocol admission, exact project subscription, and lazy content demand.
5. Quiesce every writer and preserve complete v2 current-state stores, project sidecars, object stores, registries, format markers, and release commits.
6. Collect current entity sets from every writable node. Join and rewrite them through the corrected schema instead of trusting the incomplete relay as sole authority.
7. Expand overlapping thread-reference and execution-intent lanes, repair every remaining parent-child collision, generate globally unique migration dots, and add presence registers.
8. Recover sidecar-backed notes, causally cover the accidental `workstation:17` tombstones, and externalize note bodies into immutable objects.
9. Run the lifecycle and task-graph migration once. Produce and review its source-value audit, body rewrite report, relationship repair report, semantic inventory, and canonical projection checksums for every project.
10. Delete every runtime content-derived task-state path and aggregate mutation path before reopening writes.
11. Install identical corrected roots, write format markers last, deploy the strict relay into a new state-key namespace, and bootstrap each node before enabling writes.
12. Retain rollback directories until workstation, phone, and a blank node pass the complete production proof.

---

## J. Completion Evidence

1. Generated algebra tests prove associativity, commutativity, and idempotence for nodes and relay from one shared implementation.
2. Every tested entity-delivery permutation produces the same root and canonical projection checksum.
3. A scoped lifecycle transition changes only the target card entity, changes zero unrelated entity hashes, and creates zero thread-note tombstones.
4. Concurrent lifecycle transitions converge to an explicit conflict under every delivery order. The tested resolution causally covers every candidate and converges to one lifecycle value.
5. Local-host and remote-only Control Room projections are byte-identical from the same card, relationship, and execution-intent entities without access to card bodies or thread bodies.
6. Every tested relationship-delivery permutation produces identical child order and identical `nextSubtask`.
7. Domain admission rejects unknown lifecycle values, overlapping parent-child lanes, lifecycle fields outside the atomic register, and execution-intent fields outside the atomic register.
8. The repaired semantic inventory retains every valid card, relationship, annotation, thread reference, note, deletion, resource head, and conflict.
9. One changed card performs one journal write, one indexed join, bounded shard materialization, one affected Control Room update, and no complete-workspace scan.
10. A delayed scoped commit proves the cache remains unchanged before join, invalidates after join, and projects the committed value. A duplicate join performs zero projection work.
11. Duplicate, dropped, rejected, reordered, interrupted, and oversized deliveries converge exactly when accepted and fail visibly when rejected without partial success claims.
12. Workstation and mobile converge independent offline fields, same-field conflicts, and concurrent update-versus-delete conflicts.
13. A blank remote-only node reaches the exact relay root with all hosts offline.
14. Opening one remote resource fetches only its exact missing hashes. Connecting without reads transfers zero object bodies.
15. A production fixture with at least `10,000` tasks proves bounded mutation work and no operator-visible event-loop stall.
16. Production relay deployment and a real workstation, phone, and blank-node run prove immediate live replication, reconnect repair, owner-offline reads, lazy documents, and exact readiness.
17. Focused tests, package typechecks, the full repository suite, code-quality review, the corrected migration runbook, focused commits, deployment record, and push to `origin` all succeed.

---

## K. Completion Boundary

1. This goal is not complete while a route can report `synchronized` without root equality.
2. This goal is not complete while a normal command can mutate undeclared lanes or import a complete task projection.
3. This goal is not complete while lifecycle, execution, subtask membership, subtask order, waiting time, closing time, or Control Room status depends on card content, thread content, node-local observations, filesystem access, or relationship delivery order.
4. This goal is not complete while a CRDT join is delivery-order dependent, a structural entity can exceed its frame contract, or a catalog connection triggers bulk document transfer.
5. Unit tests, matching entity counts, a successful WebSocket send, a relay acknowledgement without entity hashes, and a non-empty remote projection do not independently prove completion.
