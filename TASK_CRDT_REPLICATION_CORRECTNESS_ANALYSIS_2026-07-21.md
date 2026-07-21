# Task CRDT Replication Correctness Analysis

## A. Repository Intent

1. **Decision OS is a local-first multi-writer system.** Workstation and Mobile accept local mutations while disconnected, make those mutations durable before returning success, and converge after reconnecting.
2. **The causal current-state CRDT is the deployed task authority.** Its durable units are current entity shards, short-lived crash journals, immutable content objects, and one format marker. Permanent event history and runtime snapshots are not part of the target architecture.
3. **Replication cost must follow current divergence.** One card change joins one bounded entity lane, updates its cached projections, and transfers that current state immediately. It must not replay history, scan the complete workspace, or rewrite a complete aggregate.
4. **The relay is a durable current-state replica and router.** It joins structural state, acknowledges only durable acceptance, supports blank-node bootstrap, and routes exact-hash content without storing binary bodies.
5. **Structured metadata is eager and content bytes are lazy.** Nodes receive card, relationship, annotation, thread-note metadata, and content heads immediately. Markdown, voice, image, and managed-asset bytes move only when requested.

---

## B. Current Iteration Intent

1. **Keep the CRDT and repair it in place.** Reintroducing the historical event system is rejected because the cluster has completed the current-state migration and has accepted CRDT-native mutations.
2. **Correct the algebra before correcting transport.** A smaller WebSocket frame cannot make a non-confluent lane schema, non-commutative metadata join, or destructive aggregate import safe.
3. **Recover the migrated data without another authority reversal.** The correction requires one offline migration from the broken current-state schema to a corrected current-state schema, followed by a strict state-protocol cutover.
4. **Preserve the application boundary.** Frontend optimistic reducers, typed task commands, public routes, project identities, Cloudflare relay deployment, content-addressed objects, and Control Room remain.

---

## C. Findings — Verified Runtime Evidence

1. The live workstation server on port `50151` is connected to the production Cloudflare relay. At the observation point, the server process used `0.9%` CPU; the previously reported sustained saturation was not reproduced during this idle sample.
2. The decision-os project contains `3,663` current entities: `1,472` thread notes, `937` resource heads, `650` cards, `435` relationships, `160` annotations, and `9` ledger lanes.
3. Its current shards consume `19 MiB`. Its local immutable-object store contains `937` objects consuming `691 MiB`.
4. **All `1,472` thread-note entities are tombstoned.** Every tombstone is the same causal mutation, `workstation:17`. The thread sidecars remain present and contain the recoverable conversation bodies.
5. Two thread-note entity files are `1,077,319` and `1,075,587` bytes. Their embedded `message` candidates are approximately `1.03 MiB` and `1.05 MiB`. Either entity exceeds the relay’s safe `1 MiB` envelope after JSON framing.
6. The local state contains one whole-map `ledger/tasks:threadFiles` lane and four granular `ledger/tasks:threadFiles/<threadId>` lanes. These lanes mutate overlapping projection paths.
7. One card entity contains both `executionIntent` and its descendants `executionIntent/state` and `executionIntent/updatedAt`. This is a second verified parent-child lane collision.
8. The federation content cache contains `1,338` verified remote objects consuming `424 MiB`. Runtime status reports `1,468` available resources and `175` additional resources still synchronizing, all learned from Mobile. This is eager bulk replication, not on-demand transfer.
9. Replication diagnostics retain one `relay` convergence row and one `phone` row although the workstation hosts seven projects. The `phone` row contains the incompatible timestamp bucket `2026-07-20T07`.
10. The real blank-node proof received `3,532` of `3,663` source entities, missed `131`, and still returned `synchronized` from the remote read API.

---

## D. P0 — CRDT Algebra and Schema Failures

1. **Projection materialization is not a function of the CRDT entity set.** `materializeTaskCurrentEntity()` mutates one shared ledger in entity-arrival order. Parent and child paths can overwrite each other, and card, annotation, and relationship arrays are produced by filter-then-append without canonical sorting. Two replicas can hold identical entity hashes and roots while exposing different ledger JSON.
2. **Baseline and runtime encoders do not share one lane schema.** `taskCurrentBaselineChanges()` stores top-level objects, while `task-mutation-command.ts` recursively flattens runtime objects and special-cases only `comment`. The verified `threadFiles` and `executionIntent` collisions are consequences of this split encoding contract.
3. **Delete-versus-update is not represented as a CRDT conflict.** Deletion writes a `$entity` tombstone, but normal entity mutations write only changed data fields. A concurrent field update therefore supplies no competing presence candidate. Materialization sees the tombstone and silently removes the entity instead of retaining an explicit deletion conflict.
4. **Replicated entity metadata breaks commutativity.** Node joining selects `left.activationTaskId || right.activationTaskId`; relay joining spreads the existing left entity. Reversing operands can produce different `activationTaskId` values and hashes. A relay that already stored a baseline entity can permanently retain different metadata from a node that later activates the same entity.
5. **Local activation metadata is incorrectly inside replicated state.** `activationTaskId` and `replication: held` are local publication controls, yet they participate in entity hashing and joining. Relay state should contain only publishable causal fields.
6. **Migration conflict dots are not globally unique.** `conflictEntities()` restarts identifiers such as `migration-0-0` inside each entity group. A partial replica can observe that dot on one entity, issue a local write, and later suppress an unseen candidate on another entity that reused the same dot.
7. **The join implementations are duplicated and have already drifted.** Nodes use `task-current-state-join.ts`; the Worker uses `federation-relay/src/current-state.ts`. They differ in metadata joining and cannot provide one algebraic guarantee.

---

## E. P0 — Destructive Command Boundary

1. **The aggregate import endpoint treats omission as deletion.** `/api/task-state/commit` diffs the complete current projection against a submitted Tasks document.
2. `ledger-cli` strips hydrated sidecar notes before submitting that document. The import command then declares every thread from the before-and-after aggregate and tombstones every omitted note.
3. This path produced the verified `workstation:17` mutation that tombstoned all `1,472` migrated notes during an ordinary scoped CLI operation.
4. The endpoint also performs whole-project ID discovery and repeated linear entity lookups, so one scoped command can create project-wide CPU work before causing project-wide mutation.
5. **Absence is not a valid deletion instruction in a partial projection.** Every external mutation must declare exact owned card, relationship, annotation, thread-note, and ledger-field lanes. Deletion must be an explicit operation inside that declared scope.

---

## F. P0 — Delivery and Acknowledgement Failures

1. **Batching is count-based instead of byte-based.** Both node and relay split at `128` entities without measuring the encoded envelope. Three observed proof batches exceeded `1 MiB`.
2. **Some individual entities cannot fit.** The two oversized thread-note entities prove that byte-aware grouping alone is insufficient. Large note bodies must leave the structural CRDT and become immutable content objects referenced by small causal heads.
3. **A successful `socket.send()` is treated as successful delivery.** `publishStateFrame()` returns `true` when the WebSocket is open. It has no `deliveryId`, durable outcome, accepted entity hashes, or timeout.
4. **Relay errors cannot be correlated.** The Worker returns `response-error` without a request ID for rejected state frames. The connector routes state frames before generic errors and ignores an uncorrelated `response-error`.
5. **Acknowledgement scope is one project, not one delivery.** Any `state-relay-ack` deletes the project retry entry. Concurrent batches cannot be distinguished.
6. **Runtime retry loses divergent entities.** `runtimeRetry` stores one last delta per project. A second failed mutation overwrites the first. Reconnect anti-entropy can theoretically reconstruct both from shards, but the active repair loop is not strong enough to guarantee that outcome.
7. **Inbound protocol errors disappear.** The connector serializes all messages through `messageQueue`, then catches and discards parse, validation, merge, and handler errors without updating diagnostics or forcing repair.

---

## G. P0 — Anti-Entropy and Synchronization Truth

1. **The advertised root is not used.** Node summaries include `root`, but comparison uses only bucket arrays. Relay summaries omit their own root.
2. **Repair has no closing handshake.** After mismatched entities are joined, neither side must send a new root. `state-converged` is ignored by the relay and by the node replicator.
3. **Convergence state is keyed only by peer.** A summary for a second project overwrites the first project’s result.
4. **Remote readiness uses entity presence.** Remote routes and project catalog status promote any non-empty replica to `synchronized` or `replicated`. Once a partial projection exists, route access stops requesting repair.
5. **A blank non-hosting node cannot bootstrap from the durable relay.** Relay summaries are automatically sent only for projects in the connecting node’s own manifest. On-demand remote state requests target an online owner, so durable relay state does not satisfy owner-offline navigation.
6. **State traffic is broadcast without project subscription.** Every accepted entity delta is sent to every connected socket, including nodes that neither host nor query that project.
7. **There is no state-protocol admission gate.** The envelope accepts protocol `version: 1`; state frames are cast to the current TypeScript shape without validating `stateVersion`, bucket format, payload schema, baseline identity, or lane schema. This is why Mobile’s timestamp bucket entered the current-state reconciler.
8. **A state-lost replica is not fenced.** Replica counters are reconstructed from local shards. Reusing a stable node ID after state loss can reuse old dots unless the node finishes bootstrap before accepting writes.

---

## H. P0 — Event-Loop and Work Amplification

1. **One changed entity still scans its full collection.** Materializing a card filters the complete card array and appends one result. Relationships and annotations do the same. Loading or repairing many entities repeats those scans and approaches quadratic projection work.
2. **Bucket repair scans every entity.** `entitiesForBuckets()` walks the complete entity map even though `bucketEntries` already indexes the requested buckets.
3. **Shard materialization is unbounded.** `runMaterializer()` drains every pending entity, serializes every JSON document synchronously, launches every atomic write in one `Promise.all`, then fsyncs every containing directory. A large repair therefore creates a burst of serialization, file descriptors, writes, and fsyncs.
4. **Async publication still blocks the request turn.** Local mutation waits through synchronous JSON serialization and `socket.send()` before returning from `persistChanges()`.
5. **Large values are repeatedly canonicalized and hashed on the main thread.** Embedded thread-note bodies amplify mutation, merge, bucket, and relay work.
6. **Control Room invalidation runs before task durability.** It schedules a `queueMicrotask()` that synchronously rebuilds a complete project slice while the mutation awaits journal I/O. The rebuild can consume stale state, hash card and thread files, aggregate every task, and synchronously rewrite the complete cache.
7. **Local task commits have no corresponding post-commit affected-lane update.** The pre-commit rebuild can stay stale until another watcher, request, or runtime event invalidates it again.
8. `/api/control-room` re-aggregates local slices, remote task projections, logical task grouping, project-sync runs, lists, and fingerprints before evaluating the ETag.

---

## I. P1 — Content Replication Is Not Local-First Lazy Transfer

1. `onRemoteCatalogChange()` requests complete content manifests for every online remote project. `applyManifest()` immediately queues every missing object. This caused the verified `424 MiB` remote cache and `175`-item backlog.
2. Task resource heads already replicate through the CRDT. The generic `content-change` signal and complete manifest sweep duplicate discovery work and discard exact resource identity.
3. File-watcher content changes publish the generic signal without first capturing and mutating the exact CRDT resource head. The subsequent manifest can therefore describe stale head state.
4. A fetched remote object is stored in the master cache, but `/api/federation/content-object` serves only project-owned object stores. A node that possesses a verified cached hash cannot act as a fallback source.
5. Fetching uses the candidate’s source replica only. When that node is offline, the scheduler does not query other online project replicas that already possess the same hash.
6. Resource candidates include `changedAt` inside the semantic value. Two nodes capturing identical bytes at different times can retain a false content conflict even though their hashes match.
7. Content conflict candidates are skipped by structural projection materialization, so their conflict state is absent from the reported projection conflicts.
8. Immutable objects have no safe reclamation rule. The local project already holds `691 MiB`. Reclamation requires exact current-head reachability plus replica fencing so a retired stale replica cannot reintroduce a collected head.

---

## J. Test and Runbook Gaps

1. Replicator unit tests use an in-memory harness that accepts every frame, has no byte ceiling, returns synthetic acknowledgements, and sends complete bucket entities directly. It cannot exercise the production failure.
2. Relay tests use one small entity and require the reader to advertise the project as locally hosted. They do not prove a blank remote-only subscriber can restore from the relay.
3. Join tests cover independent fields and same-field conflicts, but not entity deletion versus concurrent update, metadata commutativity, parent-child lane overlap, arbitrary delivery permutations, or node-relay algebra equivalence.
4. Store tests verify one-card shard persistence but do not count projection scans, duplicate journals, concurrent file writes, or event-loop delay.
5. Migration tests verify one thread note and one card object but do not reconstruct every thread reference after restart, compare semantic source and destination inventories, or exercise aggregate CLI commits.
6. The migration runbook checks format, file counts, hashes, conflicts, and journals. It does not prove canonical projection equality, lane non-overlap, note liveness, scoped thread reads, blank-node relay bootstrap, or protocol rejection.

---

## K. Remediation Paths — Selected Corrective Architecture

1. **Keep the sharded delta-state CRDT.** Do not restore permanent events, snapshots, historical replay, or a second database.
2. **Create one platform-neutral CRDT core used by Node and the Worker.** It owns canonical encoding, entity validation, dotted-register joining, state hashing, bucket hashing, presence semantics, and schema constants. Node filesystem code and Worker Durable Object code remain adapters around that core.
3. **Move to strict current-state schema `3`.** Runtime accepts only `stateVersion: 3`. Existing v2 current-state stores are converted once offline; no runtime reader or automatic migration remains.
4. **Make replicated entities purely causal.** The wire entity contains `{version, projectId, entityType, entityId, fields, stateHash}`. Local-only activation and held-publication metadata live outside the replicated hash and outside relay storage.
5. **Add a presence register.** Every create and update writes `$entity: set(true)` under the command dot. Delete writes `$entity: tombstone`. Concurrent update and delete therefore remain explicit candidates; a later observed decision resolves them.
6. **Use one canonical domain lane encoder.** Baseline migration, typed commands, external scoped commands, recovery, and tests call the same encoder. No entity set may contain both a path and one of its descendants. `threadFiles/<threadId>` is always per-thread. `comment` and `executionIntent` remain atomic domain fields.
7. **Externalize thread-note bodies.** Thread-note structural entities retain identity, timestamp, role, status, and one dotted body-head register. Message bytes are immutable hash objects fetched when the thread is opened.
8. **Materialize through indexed maps.** Cards, annotations, relationships, notes, conflicts, and ledger lanes update by ID in constant expected time. Canonically sorted arrays are generated only for a requested read projection and cached by collection generation.
9. **Use a bounded materializer.** Coalesce writes by entity key, serialize only a fixed batch per turn, cap concurrent atomic writes, yield with `setImmediate`, and retain the journal until every affected shard is durable.
10. **Make duplicate merge a zero-write path.** Validate and compute pure joins first. If every resulting hash already exists, acknowledge immediately without writing a journal, shard, Control Room update, or SSE event.

---

## L. Correct State Replication Protocol

1. **Pack by encoded bytes and count.** Each frame remains below a conservative state-frame budget. Structural schema limits reject an individual oversized entity before local durability; large values belong to content objects.
2. Every relay-bound frame carries `deliveryId`, `projectId`, `stateVersion`, and the exact `{entityKey, stateHash}` set.
3. The sender maintains one in-memory dirty map keyed by `{projectId, entityKey}`. Newer local state replaces older unsent state for that key.
4. The relay validates the strict schema, joins the frame in one Durable Object transaction, updates touched bucket summaries, then acknowledges `{deliveryId, acceptedEntityHashes, relayRoot}`.
5. The sender clears a dirty key only when the acknowledged hash still equals its current local hash. Process loss is recovered by root anti-entropy, so no durable outbox is introduced.
6. **Use root-first bidirectional anti-entropy.** Connection, subscription, accepted local state, and repair completion send a cached project root. Equal roots stop. Different roots exchange cached 256-bucket manifests, then current entities from mismatched buckets in both directions.
7. After every repair merge, both sides send their new root. `converged` becomes true only when the same `{peerId, projectId, root}` is observed after all preceding delivery frames have been applied.
8. Active reconciliation has a bounded retry deadline. A converged idle project owns no polling or snapshot timer.
9. Convergence and errors are keyed by `{peerId, projectId}`. Remote routes read this state directly and never infer readiness from entity count.
10. **Add explicit project subscriptions.** Hosting nodes and on-demand readers subscribe to exact project IDs. The relay sends live deltas only to hosts and subscribers. A remote-only blank node bootstraps directly from relay state even when every host is offline.
11. The connection manifest carries exact state protocol, schema, and baseline epoch. The relay rejects incompatible state participation before accepting a manifest or mutation.
12. A new or state-lost writer remains read-only until it has bootstrapped, matched the relay root, and advanced its local replica counter beyond the joined clock.

---

## M. Correct Query, Content, and UI Work

1. **Resource heads remain eager CRDT state; object bytes become demand-only.** Remove complete-manifest synchronization from catalog changes and remove automatic queuing from `applyManifest()`.
2. Opening a card, thread, image, or voice resource prioritizes its exact current hash. The scheduler retries that active demand with backoff and stops when no active demand exists.
3. Every node serves any verified object hash present in its project store or federation cache. The requester tries the head’s source replica, then the remaining online project replicas with that exact hash.
4. Canonical resource-head equality is based on content hash and type, not filesystem modification time.
5. Local file watchers capture the exact changed file, persist its immutable object, mutate that exact resource head, and publish the resulting small CRDT delta.
6. Local mutation success returns after journal durability and in-memory join. Replication is queued for the next event-loop turn and does not delay the HTTP response.
7. CRDT joins return affected card, relationship, annotation, thread, and resource identities. Control Room consumes those identities after commit, updates only dependent task records, and publishes one revision event.
8. Complete Control Room projection construction and cache persistence use a bounded worker job. GET requests serve the final cached response and test the ETag before serialization.

---

## N. Offline CRDT-to-CRDT Repair Migration

1. **Land the destructive-write guard first.** Normal CLI and server commands must use exact scoped operations before any state recovery begins.
2. Build and test the schema-3 core, protocol, projection indexes, background materializer, and migration tooling in isolation while production remains on current-state v2.
3. Quiesce every writer and preserve complete node-local v2 stores, sidecars, object stores, format markers, project registries, and release commits in timestamped rollback directories.
4. Collect the current entity sets from every writable node. Do not treat the current relay as the sole authority because the failed proof established incomplete relay delivery.
5. Join causal fields through the corrected common core, rewrite every lane through the canonical schema, create globally unique migration dots, remove local activation metadata, and generate explicit presence registers.
6. Expand whole `threadFiles` state into per-thread lanes and merge valid granular changes. Validate every path remains inside `.decision-os` and every surviving reference resolves.
7. Recover note liveness from surviving canonical sidecars. The recovery dot must causally cover `workstation:17`, resurrect only notes present in validated sidecars, and preserve explicit deleted-note records.
8. Store note bodies as immutable objects and write their body-head candidates into the corrected note entities.
9. Produce one semantic inventory per project: cards, annotations, relationships, thread references, live notes, deleted notes, resource heads, conflicts, entity root, and materialized projection checksum.
10. Install identical schema-3 roots on participating nodes, write the format marker last, deploy the strict relay, seed its new state-key namespace, then bootstrap and verify every node before enabling writes.
11. Keep v2 rollback directories intact until workstation, phone, and a blank node pass the complete production acceptance suite.

---

## O. Acceptance Proof

1. Every algebra property test proves associativity, commutativity, and idempotence across generated entities, metadata-free wire state, presence conflicts, duplicate delivery, and every delivery permutation.
2. The same entity set materialized in every tested order produces the same canonical projection checksum and collection ordering.
3. A scoped CLI card change alters no unrelated entity hash and cannot tombstone a thread note.
4. Source and migrated semantic inventories match exactly, including every thread reference and recovered note body.
5. One changed card performs one journal write, one indexed join, one bounded shard write, one affected Control Room update, and no complete-workspace scan.
6. A duplicate delta performs zero durable writes and zero UI invalidations.
7. Dropped frames, rejected frames, dropped acknowledgements, reconnects, relay restarts, node restarts, reordering, and duplication converge to an identical project root.
8. An oversized structural value is rejected locally with a precise schema error. A large note or document crosses the content stream by exact hash without entering a state frame.
9. A blank remote-only node bootstraps from the relay while all hosting nodes are offline and does not report `synchronized` before exact root equality.
10. Workstation and Mobile edit independent fields offline, edit the same field offline, and race deletion against update; every node retains the same expected results and conflicts.
11. Opening one remote card transfers only that card’s missing objects. Connecting a node with no reads transfers zero document bodies.
12. A `10,000`-task fixture proves mutation work is independent of project history, bounded by affected current lanes, and does not create an operator-visible event-loop stall.
13. An idle connected cluster performs zero task aggregation, zero content discovery, zero object transfer, and zero anti-entropy work after roots converge.

---

## P. Operator Decision Summary

1. **The selected solution is a corrected sharded state CRDT, not an event-system restoration and not a transport-only patch.**
2. The first implementation gate is the destructive aggregate-write guard because current normal CLI traffic can still erase unrelated conversations.
3. The second gate is one shared algebra and canonical lane schema. Transport work before that gate would replicate inconsistent state faster.
4. The third gate is correlated byte-bounded delivery plus closed-loop root anti-entropy. This makes the relay a trustworthy durable replica and enables offline blank-node reads.
5. The fourth gate is indexed projection work, bounded materialization, and truly lazy content. This removes the CPU and storage amplification while preserving immediate replication.
6. Existing corrupted stores require one offline CRDT-to-CRDT schema migration. This does not restore legacy events, add runtime compatibility, or rewrite the application.
