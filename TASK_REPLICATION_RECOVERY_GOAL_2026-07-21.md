# Task CRDT Replication Recovery Goal

## A. Goal

1. **Repair the deployed causal current-state CRDT without restoring task event history.** Current entity shards, short-lived journals, immutable content objects, and the Cloudflare relay remain the architecture.
2. **Make CRDT state and application state converge exactly.** Equal project roots must imply byte-identical canonical projections. A node may report `synchronized` only after closed-loop root equality with the relay for that project.
3. **Make normal work proportional to changed current lanes.** One card mutation must not scan, clone, serialize, hash, transfer, or rewrite the complete workspace.
4. **Keep local interaction responsive.** Local success follows journal durability and in-memory join. Replication, bounded shard materialization, content transfer, and derived projection work continue without monopolizing the Node event loop.
5. **Run one offline CRDT-to-CRDT repair migration.** The final runtime accepts only the corrected state schema and contains no automatic migration, legacy reader, event authority, dual write, or fallback path.

---

## B. Authoritative Analysis

1. The complete current-state findings and selected remediation are defined in `TASK_CRDT_REPLICATION_CORRECTNESS_ANALYSIS_2026-07-21.md`.
2. That analysis supersedes the previous recommendation to restore the deleted v2 event store and durable event outbox.
3. The existing migration rollback directories remain recovery evidence. They are not the target runtime architecture.

---

## C. Required CRDT Invariants

1. Node and relay use one platform-neutral implementation of canonical encoding, entity validation, dotted-register join, entity hashing, bucket hashing, and state schema.
2. Replicated entity joining is associative, commutative, and idempotent for every field and every entity attribute.
3. Local activation and held-publication metadata never participate in replicated hashes or relay state.
4. Every entity create and update writes a causal presence candidate. Delete writes a competing tombstone candidate. Concurrent update and delete remain an explicit conflict.
5. Baseline migration, typed mutations, scoped external commands, data recovery, and tests use one canonical domain lane encoder.
6. No current entity set contains both a projection path and one of that path’s descendants.
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
5. State frame encoding, large-content hashing, Control Room aggregation, and cache persistence do not create unbounded synchronous work on the HTTP event loop.
6. An idle converged server performs zero task aggregation, zero content discovery, zero object transfer, and zero state repair work.

---

## E. Required Federation Contract

1. State frames are bounded by encoded bytes and entity count.
2. Each relay-bound frame carries a unique `deliveryId` and exact entity keys and hashes.
3. The relay acknowledges only after one durable join transaction and returns the accepted entity hashes and resulting relay root.
4. The node’s runtime dirty map is keyed by project and entity. It clears only hashes confirmed by the matching acknowledgement.
5. Reconnect correctness comes from current shards and bidirectional root anti-entropy. No durable event outbox is introduced.
6. Root mismatch exchanges cached 256-bucket summaries and current entities from mismatched buckets only. Repair repeats until both sides observe the same root.
7. Convergence, retry, and error state are keyed by `{peerId, projectId}`.
8. Remote readiness is derived from exact root convergence and exact demanded-content readiness, never from entity count.
9. Nodes subscribe to exact projects. The relay forwards live state only to project hosts and active subscribers.
10. A blank remote-only node bootstraps from durable relay state while project hosts are offline.
11. The manifest declares the exact state protocol, schema, and baseline epoch. Incompatible nodes are rejected before state participation.
12. A new or state-lost writer remains read-only until bootstrap completes and its replica counter is above the joined clock.

---

## F. Required Content Contract

1. CRDT resource heads replicate eagerly. Object bytes transfer only after an exact route demand.
2. Connection and catalog changes transfer zero document bodies.
3. Local file changes capture and publish the exact changed resource head without complete manifest discovery.
4. Any node with a verified object may serve it as a fallback source.
5. Requesters try the head source and then remaining online replicas for the same exact hash.
6. Resource equality uses immutable hash and type rather than filesystem timestamps.
7. Content conflicts remain explicit current head candidates and are visible in query status.
8. Object reclamation is permitted only after current-head reachability and replica fencing prove the hash cannot be resurrected by a retired replica.

---

## G. Repair and Cutover Sequence

1. Remove the destructive full-projection commit path from normal CLI and server operations. Add a fail-closed guard against undeclared bulk deletions.
2. Implement and property-test the shared CRDT core, canonical lane schema, presence register, metadata-free wire entity, and deterministic indexed materializer.
3. Implement bounded materialization, correlated byte-bounded delivery, closed-loop root repair, strict protocol admission, project subscription, and lazy content demand.
4. Quiesce every writer and preserve complete v2 current-state stores, project sidecars, object stores, registries, format markers, and release commits.
5. Collect current entity sets from every writable node. Join and rewrite them through the corrected schema instead of trusting the incomplete relay as sole authority.
6. Expand overlapping thread-reference lanes, repair every other parent-child collision, generate globally unique migration dots, and add presence registers.
7. Recover only sidecar-backed notes, causally cover the accidental `workstation:17` tombstones, and externalize note bodies into immutable objects.
8. Produce and review semantic inventories and canonical projection checksums for every project.
9. Install identical corrected roots, write format markers last, deploy the strict relay into a new state-key namespace, and bootstrap each node before enabling writes.
10. Retain rollback directories until workstation, phone, and a blank node pass the complete production proof.

---

## H. Completion Evidence

1. Generated algebra tests prove associativity, commutativity, and idempotence for nodes and relay from one shared implementation.
2. Every tested entity delivery permutation produces the same root and canonical projection checksum.
3. A scoped card command changes no unrelated entity hash and cannot delete unrelated notes.
4. The repaired semantic inventory retains every valid card, relationship, annotation, thread reference, note, deletion, resource head, and conflict.
5. One changed card performs one journal write, one indexed join, bounded shard materialization, one affected Control Room update, and no complete-workspace scan.
6. Duplicate, dropped, rejected, reordered, interrupted, and oversized deliveries either converge exactly or fail visibly without partial success claims.
7. Workstation and Mobile converge independent offline fields, same-field conflicts, and concurrent update-versus-delete conflicts.
8. A blank remote-only node reaches the exact relay root with all hosts offline.
9. Opening one remote resource fetches only its exact missing hashes. Connecting without reads transfers zero object bodies.
10. A production fixture with at least `10,000` tasks proves bounded mutation work and no operator-visible event-loop stall.
11. Production relay deployment and a real workstation, phone, and blank-node run prove immediate live replication, reconnect repair, owner-offline reads, lazy documents, and exact readiness.
12. Focused tests, package typechecks, the full repository suite, code-quality review, the corrected migration runbook, focused commits, deployment record, and push to `origin` all succeed.

---

## I. Completion Boundary

1. This goal is not complete while any route can report `synchronized` without root equality, any normal command can mutate undeclared lanes, any CRDT join is delivery-order dependent, any structural entity can exceed its frame contract, or any catalog connection triggers bulk document transfer.
2. Unit tests, matching entity counts, a successful WebSocket send, a relay acknowledgement without entity hashes, and a non-empty remote projection do not independently prove completion.
