## A. Decision

1. **Replace only the task replication state core.** Keep the existing frontend, public ledger and card routes, typed task commands, optimistic UI reducers, stable project IDs, federation authentication, WebSocket connections, `state-event-batch` frame, direct-peer delivery, relay delivery, Control Room surface, and content-addressed object transfer.
2. **Change the meaning of the replicated payload from permanent historical operation to joinable current-state delta.** The payload remains entity- and field-scoped, but it carries the causal metadata required for correct multi-writer joining.
3. **Persist current state in independently writable entity shards.** A card update writes that card's state through a short-lived durability journal. It never rewrites the workspace projection.
4. **Remove whole-workspace snapshots from the runtime.** The entity shards are continuously checkpointed current state. Blank-node recovery joins current-state buckets instead of replaying history.
5. This is a **targeted backend and relay refactor**, not an application rewrite. Existing callers continue receiving the same materialized ledger, card, thread, and Control Room JSON shapes.

---

## B. Why the Existing v2 Core Needs One Causal Change

1. The typed command and exact field-change boundaries are reusable.
2. The scalar project `revision` is not reusable as causal truth. Independent offline writers can generate incomparable changes with different scalar values, and the larger value can incorrectly suppress a concurrent lower value.
3. The minimum correct replacement is one **dot** plus one **observed clock**:

   ```text
   dot     = { replicaId, counter }
   context = { replicaId: highestObservedCounter }
   ```

4. Existing `writerId`, stable federation node IDs, entity types, entity IDs, field paths, values, tombstones, event IDs, and command batches remain useful.
5. The runtime no longer needs permanent `appliedEventIds`, historical `fieldRevisions`, full event replay, time buckets, or snapshot coverage lists once current causal state is durable.

---

## C. Replicated State Model

1. One local command produces one `TaskStateBatch`:

   ```text
   batchId
   projectId
   replicaId
   dot: { replicaId, counter }
   context: compact project clock observed before the command
   changes: [{ entityType, entityId, fieldPath, value | tombstone }]
   ```

2. All changes in one command share the batch dot and context. This preserves the current command boundary without creating independent card transactions.
3. Each current entity shard stores only current register state:

   ```text
   entityType
   entityId
   fields[fieldPath] = {
     context: compact removed/observed dot frontier,
     candidates: [{ dot, value | tombstone }]
   }
   stateHash
   ```

4. A causally newer field value removes candidates it observed. Concurrent candidates remain. Identical concurrent values collapse. A later edit made after observing the conflict removes the current candidates and resolves it.
5. Entity deletion is the `$entity` register with a tombstone candidate. Concurrent deletion and modification remain a bounded explicit conflict.
6. Domain merge units remain deliberate: card status, title, geometry, execution intent, labels, relationship value, annotation geometry and style, ledger viewport, and exact content reference. Arbitrary nested JSON flattening is removed from the runtime command path.
7. The join is associative, commutative, and idempotent. Delivery order, duplicate delivery, direct-peer duplication, relay duplication, and batching cannot change the final state.
8. **Do not implement tombstone garbage collection in the first iteration.** Retaining current tombstones is simpler and prevents stale-node resurrection. Their size grows with deleted current identities, not mutation history.

---

## D. Local Persistence Without Workspace Rewrites

1. Reuse `.decision-os/task-state/<projectId>` with a new current-state-only internal layout:

   ```text
   format.json
   current/cards/<cardId>.json
   current/annotations/<annotationId>.json
   current/relationships/<relationshipId>.json
   current/ledger.json
   current/resources/<resourceKey>.json
   current/thread-notes/<noteId>.json
   journal/<batchId>.json
   objects/<sha256>
   ```

2. **Entity shards own current durable state.** Updating one card rewrites one card shard. Updating one relationship rewrites one relationship shard.
3. **Do not persist a separate project clock.** On startup, join the causal clocks retained in current shards and remaining journals. A new journal is created with exclusive-write semantics, so a reused dot cannot silently overwrite another command.
4. **The batch journal owns atomic crash recovery.** One multi-entity command is written and fsynced as one small journal file before local acknowledgement. A crash before shard materialization replays that journal idempotently.
5. The background materializer joins the journal into affected entity shards, makes those shard writes durable, then deletes the journal. A crash at any point safely repeats the join.
6. **Do not persist an outbox.** Current entity shards are the recoverable delivery state. While the process is alive, a runtime dirty set drives immediate retries. After restart and reconnection, bucket comparison identifies every current shard missing from the relay.
7. Immutable objects preserve document candidates after the mutable Markdown, image, and voice source files change. A concurrent old content hash therefore remains fetchable until the conflict is resolved.
8. `format.json` contains `{ version, projectId, baselineRoot }`. It is written last by the offline migration and is the only accepted runtime-format gate.
9. Remove hot writes to complete `projection.json`, `tasks.json`, pending-peer JSON, snapshot files, and archive refs.
10. Existing tools that require a complete Tasks document receive an explicit materialized export. Export generation is a requested operation, not part of every task mutation.

---

## E. Local-First Write Flow

1. The browser applies the existing optimistic command reducer immediately.
2. The backend validates the typed command, advances its own replica counter, and creates one causal batch.
3. The backend writes and fsyncs one journal file through asynchronous filesystem APIs.
4. The backend joins the affected entity registers in memory and updates the affected card and Control Room task.
5. The backend returns local success after journal durability. It does not wait for another node, relay aggregation, content transfer, archival, or export generation.
6. The replication lane publishes the same complete batch to the relay and connected peers immediately after durability.
7. The background materializer writes only the affected entity shards. It performs no workspace serialization.
8. An empty local-only task retains its current activation rule. Its held causal state publishes as one joined batch immediately after the first durable contribution.

---

## F. Live Synchronization Between Nodes

1. Keep the existing `state-event-batch` transport frame and maximum batch size. Its payload becomes causal current-state deltas rather than permanent replay events.
2. The relay writes one short-lived journal, joins the received fields into its current project state, persists only affected shards, removes the journal, then acknowledges the batch dot.
3. The relay forwards the accepted delta to connected project replicas.
4. Direct peers receive the same delta concurrently for minimum latency.
5. A receiving node writes one incoming journal file, joins the batch once, writes only affected entity shards, updates only affected UI tasks, then acknowledges.
6. A duplicate batch whose dot is already covered causes zero shard writes, zero Control Room updates, and one acknowledgement.
7. Relay acknowledgement clears the runtime retry marker. It deletes no durable local state because the current shard remains the anti-entropy source.
8. Reconnection immediately compares current-state roots and repairs mismatched buckets. It does not wait for a periodic maintenance interval.

---

## G. Bounded Anti-Entropy Without History

1. Partition current entity keys into `256` stable buckets using the first byte of `SHA-256(entityKey)`.
2. Derive each bucket hash in memory from canonical `{entityKey, stateHash}` entries loaded from current shards. Update only the touched bucket after a join.
3. Exchange one cached project root on federation connection and after accepted batches.
4. Equal roots require no work.
5. Different roots exchange the `256` cached bucket hashes.
6. Transfer the current entity-register states from mismatched buckets only. Join them through the same reducer used for live deltas.
7. At `10,000` entities, a uniformly distributed bucket contains roughly `39` entities. Repair cost therefore follows current divergence without a recursive Merkle implementation.
8. Reuse the existing summary and missing-request frame family. Change the bucket meaning from historical hour to stable current-state bucket during the offline cutover.
9. Do not persist a second bucket manifest. Bucket state is derived incrementally from entity shard hashes already required for integrity.
10. Remove the fixed `30`-second full reconciliation pass. Connection establishment, accepted relay state, and runtime retry state trigger synchronization.
11. Do not add a relay cursor window, permanent sequence log, persisted bucket index, or recursive Merkle tree. Current causal state is sufficient to identify and repair divergence.

---

## H. Querying Cards and Documents Across Nodes

1. **Structured task metadata replicates eagerly because it is small.** Every online node and the relay retain current card, annotation, relationship, and ledger register state.
2. Existing card and navigation routes materialize responses from the local current-state cache, including remote-only projects.
3. **Document bodies replicate lazily by exact resource key and content hash.** A content-head register uses the same dot and context semantics and contains the current hash candidates for one card, thread, image, voice file, or managed asset.
4. A content change hashes the changed resource once, stores the immutable object once, updates one resource-head register, and publishes that exact head delta.
5. Opening a remote card or thread checks its exact head. Missing bytes first request the head candidate's source replica through the existing relay request stream, then query the remaining online project replicas by exact hash until one returns it.
6. Add a connector API that pipes `response-chunk` frames directly to a temporary file with credit backpressure, incremental hash verification, and atomic rename. The internal buffered `federation.request()` path must not fetch content objects.
7. Concurrent Markdown edits retain multiple current hash candidates and surface a document conflict. A resolved edit causally replaces those heads.
8. Keep `/api/federation/content-manifest` for compatibility, but answer it from current resource-head shards. It must not discover and hash the workspace on demand.
9. Map `/api/federation/content-object` directly from the requested hash to `objects/<sha256>`, then stream and verify that one object.
10. A missing-object request is runtime state keyed by `{projectId, hash, sourceReplicaId}`. Route access reconstructs the request from the current head and local object absence, so no durable content queue is needed.
11. The relay stores current resource heads, not binary bodies. It forwards object chunks through its existing authenticated, credit-controlled request stream. The content stream has a `1 GiB` hard limit; task metadata frames retain their existing small limit.
12. If no online replica returns the exact hash, the route reports that object as synchronizing and retries the source candidate when its replica reconnects.
13. Thread notes replicate as current entities with stable note IDs. Their bodies use immutable content objects; the existing Markdown thread document becomes a compatibility materialization rather than replication authority.

---

## I. Event-Loop and Background-Work Contract

1. **Event-loop work is limited to validation, small causal joins, in-memory map updates, routing, and response serialization requested by the caller.**
2. Journal fsync, shard writes, object streaming, and file reads use asynchronous filesystem APIs.
3. One background materializer per project coalesces repeated updates to the same entity and processes a bounded number of entities per turn.
4. Current-state anti-entropy uses cached hashes and performs joins only for mismatched buckets.
5. Control Room maintains one task record per logical card and updates the records affected by a batch. `/api/control-room` returns the cached final projection and evaluates its ETag before serialization.
6. Content hashing uses a background worker for large files. Small Markdown hashing uses asynchronous streaming and yields between bounded batches.
7. Git backup and full Tasks export run only as explicit background jobs against stable current shards.
8. **There is no periodic whole-project snapshot job.** Current entity shards are the checkpoint. A blank node restores through current-state bucket transfer.
9. An idle server performs no task aggregation, snapshot creation, content discovery, projection rewrite, or Git traversal.

---

## J. Offline Big-Bang Cutover

1. Implement and verify the current-state join, store, relay handling, and materializers while the existing v2 runtime remains active. Do not dual-write.
2. Pause Workstation, Mobile, and relay task mutations. Require every known writable node to be online for the cutover.
3. Verify that the existing v2 replicas have converged, then build the current union projection once.
4. Convert every current field into a deterministic baseline register. Convert every unresolved conflict candidate into a distinct deterministic baseline dot.
5. Copy every current and unresolved document candidate into the immutable object store, then create causal resource-head registers.
6. Write identical current entity shards to every participating node and relay, verify identical project roots and materialized ledger checksums, then write identical `format.json` markers last.
7. Preserve one rollback backup outside active task-state storage.
8. Reject old replication payloads after the marker is present. A node absent from the cutover must bootstrap current state from the relay before it can accept local writes.
9. Remove event segments, old outboxes, projections, snapshots, pending acknowledgement maps, time buckets, checkpoint routes, and snapshot archive refs from active storage after the rollback window.
10. Remove runtime parsing and migration support for the old representation. Keep the offline migration executable outside the server startup path.
11. Start the current-state system. A missing marker, a mismatched baseline root, or an old active representation causes startup failure instead of automatic migration.

---

## K. Existing Boundaries Preserved

1. Preserve frontend optimistic reducers and route shapes.
2. Preserve typed mutation controllers and command queue ordering.
3. Preserve stable project identity and federation node identity.
4. Preserve authenticated federation connector and direct-peer connections.
5. Preserve the `state-event-batch`, acknowledgement, summary, and missing-request frame family.
6. Preserve card, thread, navigation, Control Room, and replica route response shapes.
7. Preserve content-addressed object files and exact-resource priority.
8. Preserve local-only task activation and execution-intent behavior.

---

## L. Internal Components Replaced

1. Add `task-current-state-types.ts` for dots, clocks, registers, entities, and wire batches.
2. Add `task-current-state-join.ts` as the single associative, commutative, idempotent join implementation used by nodes and relay.
3. Add `task-current-state-store.ts` for format validation, journal recovery, entity shards, immutable object heads, and in-memory bucket summaries.
4. Add `task-current-state-migration.ts` as an offline executable with no server-startup import.
5. Update `project-task-state.ts` and `task-mutation-command.ts` to create one causal batch and publish it immediately after journal durability.
6. Update `federation-task-state-replicator.ts` to join batches once and repair current buckets through the existing frame family.
7. Update `federation-relay/src/index.ts` to persist and join affected current-state shards instead of retaining complete event history.
8. Update `federation-content-replica-store.ts`, `federation-content-scheduler.ts`, `federation-node-connector.ts`, and `create-http-server.ts` to use current resource heads and streamed exact-hash object transfer.
9. Update `federated-project-catalog.ts` so replicated task metadata remains queryable from local current state while its source node is offline.
10. Update `control-room-projection-store.ts` to consume affected task identities and cache the final federated response.
11. Remove the task maintenance work from the `30`-second timer in `create-http-server.ts`.
12. Keep the old event implementation available only to the offline migration until the rollback window closes. The server runtime must not import it after cutover.

---

## M. Over-Engineering Audit

1. **No new database:** filesystem entity shards already answer exact state, durability, restart, and query needs.
2. **No permanent event journal:** short-lived journal files exist only until affected current shards are durable.
3. **No workspace snapshot model:** current shards are the checkpoint.
4. **No persisted Merkle tree:** one in-memory fixed bucket summary is derived from entity hashes.
5. **No per-card transport queue:** one command remains one project batch; entity keys route aggregation work.
6. **No second projection authority:** ledger JSON is materialized from current shards.
7. **No durable replication outbox:** current shards are delivery truth and reconnect anti-entropy reconstructs missing delivery.
8. **No binary relay store:** existing nodes stream immutable objects directly.
9. **No tombstone-compaction membership system in the first iteration:** retain current tombstones and avoid a new fencing model until measured state size requires it.
10. **No persisted project clock:** join it from current shard and recovery-journal clocks during startup.
11. **No relay transport log, cursor window, membership epoch, content manifest file, durable content request queue, or Control Room index.** Each is derivable from current shards and runtime connections.
12. The durable objects are limited to **one format marker, current entity shards, short-lived batch journals, and immutable content objects**. Each owns a distinct correctness invariant that cannot be derived safely from another object.

---

## N. Acceptance Evidence

1. Workstation changes a card title while Mobile changes its status offline; both changes appear on both nodes after reconnection.
2. Both nodes change the same field offline; both retain the same bounded conflict candidates after every delivery permutation.
3. Unrelated local counter growth cannot suppress a lower-counter concurrent remote field value.
4. A later observed resolution removes the conflict everywhere.
5. Concurrent deletion and modification remain an explicit conflict.
6. Updating one card writes one journal, one card shard, and no workspace projection, outbox, project clock, or bucket index.
7. Repeated offline edits to one card leave one current entity state instead of permanent operation history. After restart, reconnect repair delivers that state without an outbox.
8. One received batch performs one journal write, one join, affected shard writes, one Control Room update, and one acknowledgement.
9. Duplicate delivery causes zero state writes and zero UI invalidation.
10. Connected peers receive task changes immediately after local durability without a maintenance interval.
11. A blank node converges through current-state buckets and reads no historical event segment or snapshot.
12. One remote card query reads its current card state. Opening its Markdown transfers only the exact missing hash.
13. A `40 MB` voice object crosses the relay into a temporary file without buffering the body in Node.js memory and without blocking unrelated HTTP and SSE traffic.
14. An idle server performs zero aggregation and maintenance filesystem work for hours.
15. A relay restart reconstructs current clocks and bucket summaries from current shards, then converges with both writers without a sequence log.
16. A state-lost node is rejected as a writer until it completes a current-state bootstrap from the relay.
17. A production fixture with `10,000` tasks proves that one-card mutation latency and write bytes remain independent of workspace history and proportional to the affected entity.

---

## O. Operator Decision Summary

1. **Keep the application and transport surfaces. Replace the historical replication core with sharded causal current state.**
2. The solution fixes multi-writer correctness with the minimum causal metadata: one replica counter, one observed clock, and bounded current candidates per field.
3. It eliminates full projection writes, permanent history replay, workspace snapshots, full manifest scans, time-based maintenance, and history-sized repair.
4. It provides immediate task synchronization, exact on-demand document transfer, crash recovery, offline continuation, deterministic conflicts, and idle-zero background behavior.
5. The cutover is one offline migration. The final runtime contains no legacy reader, automatic migration, dual authority, or fallback path.
