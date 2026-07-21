# Task Replication Recovery Goal

## A. Goal

1. **Restore v2 typed events as the only durable task authority.** Preserve one logical command batch through local durability, relay persistence, remote durability, acknowledgement, aggregation, and UI invalidation.
2. **Make every node converge exactly.** A node may report `synchronized` only when its reducer-v2 checkpoint identity and uncovered v2 event set match the federation authority.
3. **Make normal work proportional to the accepted change.** One card mutation updates that card's event lanes, dependent indexes, cached projections, and durable outputs without replaying, cloning, scanning, serializing, or rewriting the complete workspace.
4. **Keep the interactive server responsive.** Immediate replication starts after local event durability. CPU-heavy checkpoint construction, hashing, compression, and large-content work execute outside the Node event loop.
5. **Complete one offline big-bang cutover.** The running application accepts only the corrected v2 format and protocol. It contains no automatic migration, legacy reducer, CRDT compatibility path, or runtime fallback.

---

## B. Verified Starting Point

1. Commit `316b9df9` replaced the v2 event store, reducer, durable outbox, event types, and checkpoint authority with a current-state CRDT implementation across `78` files.
2. The production relay accepts a maximum encoded frame size of `1 MiB`, while task replication currently batches by `128` entities without measuring encoded bytes.
3. A real blank-node proof received `3532` of `3663` source entities and missed `131` entities.
4. The incomplete replica incorrectly returned `synchronized` because any non-empty local projection is treated as complete.
5. Relay rejection is not correlated with the state batch. The sender treats an open WebSocket as successful delivery and clears retry state after an unrelated relay acknowledgement.
6. The phone advertises an incompatible timestamp bucket and must not participate in the corrected protocol until upgraded.

---

## C. Architecture Decision

1. **The v2 event log is authoritative.** Checkpoints, projections, Control Room state, federation caches, and content manifests are derived products.
2. **The Cloudflare Worker is a durable federation relay.** It authenticates nodes, durably accepts v2 batches, acknowledges exact accepted event IDs, retains the latest verified checkpoint and uncovered tail, forwards live batches, and routes exact-hash document streams.
3. **Each node is a local database replica.** It accepts optimistic local commands, durably appends event batches, aggregates affected lanes, serves queries from local projections, and repairs missing checkpoint-tail coverage after reconnection.
4. **Documents use a separate lazy content lane.** Task metadata and content heads replicate eagerly. Document bodies transfer on demand by immutable hash with streaming backpressure and hash verification.
5. **The current-state CRDT remains only long enough to converge all migrated nodes and produce the single corrective offline checkpoint.** It is not extended into the target runtime.

---

## D. Required Runtime Invariants

1. One typed command creates one durable v2 batch with one stable `batchId` and stable event IDs.
2. The durable local outbox is cleared only after the relay durably acknowledges that batch and its accepted event IDs.
3. A receiving node acknowledges only after one durable `appendBatch()` call.
4. Transport frames are split by encoded byte size while preserving one logical batch identity.
5. Duplicate delivery performs zero projection persistence and zero UI invalidation.
6. Every delivery permutation of the same v2 event set produces a byte-identical canonical projection, conflict set, entity order, applied-event set, and checkpoint checksum.
7. Card, annotation, relationship, resource-head, thread-note, and ledger-field lanes are indexed independently. An accepted batch aggregates only its affected lanes and declared dependents.
8. Checkpoints trigger after `500` accepted events. Elapsed time never triggers checkpoint discovery or task aggregation.
9. Checkpoint serialization, checksum generation, compression, and large-content hashing run in worker threads with bounded queues.
10. An idle server performs zero event-history scans, zero checkpoint work, zero task projection rewrites, and zero workspace content discovery.
11. Federation connection rejects every unsupported protocol and active-storage format before accepting mutations.
12. `synchronized` requires exact checkpoint identity and exact uncovered-tail coverage. Entity count and non-empty projection state are never synchronization evidence.

---

## E. Execution Sequence

1. **Stabilize the current-state migration bridge.** Add encoded-byte frame splitting, `{peerId, projectId}` convergence tracking, exact root comparison, repeated missing-bucket repair, and strict protocol rejection.
2. **Converge and preserve active data.** Bring every writable migrated node onto the bridge protocol, obtain identical roots, materialize one authoritative projection, and preserve one recovery backup outside active task storage.
3. **Restore the v2 event core.** Recover the deleted v2 outbox, event store, reducer, event types, checkpoint model, and acknowledgement tracking from the pre-`316b9df9` implementation.
4. **Correct aggregation boundaries.** Preserve batches end to end, add batch-local deduplication, canonicalize reducer ordering, index affected lanes, move invalidation after accepted aggregation, and cache final Control Room and content-manifest results by generation.
5. **Correct checkpoint behavior.** Trigger checkpoint creation from accepted event volume, construct it in a worker, record exact event coverage, and load one checkpoint plus its uncovered tail on startup.
6. **Correct federation semantics.** Deploy a versioned relay contract with byte-bounded framing, durable batch acknowledgements, exact checkpoint-tail repair, immediate live forwarding, and lazy exact-hash content streaming.
7. **Run the offline cutover.** Stop writers, verify the authoritative projection, generate one deterministic reducer-v2 checkpoint, install the corrected format on participating nodes and relay, write the format marker last, and remove runtime CRDT and legacy paths.
8. **Reopen federation only after the complete acceptance proof passes.**

---

## F. Completion Evidence

1. A blank node reaches the exact source checkpoint checksum and exact uncovered-event coverage for the `3663`-entity proof project.
2. One multi-event command causes one local append, one outbox handoff, one relay durable acknowledgement, one receiver append, one affected-lane aggregation, and one UI invalidation.
3. One card mutation performs zero complete-workspace projection clones, scans, serializations, and rewrites.
4. Live events reach connected nodes immediately after local durability without waiting for checkpoint creation.
5. Offline concurrent edits converge deterministically after reconnect and preserve the expected field conflicts.
6. Dropped, duplicated, reordered, oversized, and interrupted batches converge after retry without data loss.
7. Relay restart, sender restart, receiver restart, and a disconnected node rejoining all converge to the same checkpoint-tail identity.
8. Remote card and navigation queries are served from replicated local metadata. Missing document bodies stream by exact hash and survive reload after verification.
9. No route reports `synchronized` while one checkpoint, event, lane, resource head, or required document object is missing.
10. Repeated idle maintenance windows perform zero task aggregation and zero checkpoint work.
11. Checkpoint generation under a workspace containing at least `10,000` tasks does not create an operator-visible event-loop stall.
12. The corrected relay, workstation node, phone node, and one new blank node pass the same protocol and convergence suite before production rollout is declared complete.

---

## G. Completion Boundary

1. This goal is complete only after the corrected implementation, offline cutover, production relay deployment, multi-node convergence proof, responsiveness measurements, focused tests, package typechecks, full repository suite, code-quality review, committed runbook, focused commits, and push to `origin` all succeed.
2. A passing unit test, successful relay deployment, non-empty remote projection, matching entity count, or successful WebSocket send does not independently satisfy this goal.
