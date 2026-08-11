# Epoch-4 Federation Repair and Recovery

## A. Authority Boundary

1. Epoch-4 structural task state uses protocol `decision-os-task-state/4`, schema version `4`, and baseline epoch `4`.
2. The local task-current store owns durable entity joins. The relay owns repair scheduling and retained cross-node authority. A receiver ACK releases delivery credit only after the receiver has durably applied the accepted entries.
3. Exact equal task-current roots prove structural convergence. HTTP readiness, a connected socket, empty queue gauges, and elapsed time do not.
4. Mutable Markdown and immutable content objects use the content lane. Structural convergence does not assert content availability.

---

## B. Bounded Repair

1. Node publication batches contain at most 128 entities and every encoded structural-state frame is limited to 512 KiB.
2. Relay repair allows four in-flight deliveries per project, sixteen per connection, and 16 MiB of encoded in-flight delivery credit per connection.
3. Accepted and rejected entries settle independently. A collision on one entity does not prevent unrelated valid entities in the same delivery from committing.
4. Delivery identity, accepted hashes, rejected hashes, and the resulting relay root persist so reconnect can continue from durable state without replaying acknowledged work.
5. Receiver durability and structural ACK settlement remain ahead of derived current-shard materialization, content scheduling, UI projection, and observer work.

---

## C. Watcher Admission

1. Native filesystem events and audit scans share one filesystem-generation claim so the same mutation is not captured twice.
2. A retained remote head with no readable mutable sidecar is not a local edit. Startup defers that resource instead of authoring a local contribution.
3. Only `ENOENT` is classified as a missing sidecar. Other read failures preserve their error identity and remain contained to the owning scope.
4. Newly absent resources are seeded into watcher observation without emitting a local contribution.

---

## D. Collision Evidence

1. A terminal collision records direction, project, entity key, repair attempt, delivery, submitted hash, receiver or resulting hash, collision coordinates, complete archived entities, and the authoritative relay root.
2. Submitted and resulting hashes have different meanings. Dirty-state settlement requires the exact submitted hash; a joined receiver hash cannot stand in for it.
3. Terminal poison suppression is scoped to the rejected hash and relay root and is reconstructed from durable incidents and store evidence after restart.
4. Sequential recovery identity includes the entity key and exact successor hash. Key-only attribution cannot distinguish later collision generations.
5. Incident resolution validates the currently active incident generation so stale pause state cannot authorize recovery.

---

## E. Explicit Recovery

1. Recovery is operator-authorized and may open an isolated durable task-current store while the project remains paused.
2. Legacy incident evidence may be adopted only during explicit recovery after the attempt, delivery, rejection hashes, current submitted entity, archived receiver entity, and collision coordinates validate together.
3. Local-authority recovery creates a deterministic successor, publishes it, waits for the correlated relay ACK and exact root equality, flushes the store, reopens it, and revalidates the root and entity hashes.
4. Normal project runtime is installed only after the durable reload and active-incident generation checks succeed.
5. A restoration failure removes transient runtime state, retains the original pause evidence, and records `federation_repair_runtime_restore_failed`.

---

## F. Operational Proof

1. A convergence proof records exact roots, missing buckets, dirty entities, pending deliveries, queued relay entities, active repairs, content work, active incidents, and paused scopes.
2. Restart proof must reproduce the same durable root and settled diagnostic state after a fresh process start.
3. Production relay and application compatibility is bound to one published annotated release tag and its runtime compatibility fingerprint.

---

## G. Implementation Evidence

1. `shared/task-current-state-core/model.ts`
2. `backend/src/business/federation/helper/federation-task-state-replicator.ts`
3. `backend/src/business/refresh/helper/watch-card-content-files.ts`
4. `backend/src/business/server/runtime/runtime-recovery-service.ts`
5. `federation-relay/src/protocol.ts`
6. `federation-relay/src/state-entity-frames.ts`
7. `federation-relay/src/state-storage.ts`
8. `federation-relay/src/index.ts`
9. `backend/test/unit/federation/federation-task-state-replicator.test.ts`
10. `backend/test/unit/refresh/helper/watch-project-files.test.ts`
11. `backend/test/unit/server/runtime/project-content-runtime.test.ts`
12. `backend/test/unit/server/runtime/runtime-recovery-service.test.ts`
13. `federation-relay/test/relay.test.ts`
14. `federation-relay/test/termux-local-relay.node.test.ts`
