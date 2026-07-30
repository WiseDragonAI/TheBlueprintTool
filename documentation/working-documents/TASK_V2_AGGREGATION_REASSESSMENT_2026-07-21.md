## A. Repository Intent

1. **The existing v2 event system is the authority.** Typed task events are durable facts. Projections, snapshots, remote caches, content manifests, and Control Room are derived aggregates.
2. **One logical command batch should remain one batch.** Local persistence, outbox delivery, relay delivery, peer delivery, remote reduction, acknowledgement, and UI invalidation must not split it into per-event work.
3. **Aggregation must be deterministic.** The same v2 event set must produce the same projection, conflict set, entity ordering, snapshot checksum, and Control Room state regardless of delivery order.
4. **Aggregation must be proportional to change.** Normal work must touch the accepted batch, affected fields, affected entities, and one dirty project slice. It must not touch every retained event, every task, and every content resource.
5. **Snapshots are v2 checkpoints.** They capture the current aggregate after significant accepted work. They do not introduce another event model.

---

## B. Current Iteration Intent

1. Preserve v2 events, the durable outbox, existing federation frames, relay delivery, peer delivery, snapshots, and optimistic local behavior.
2. Perform one offline big-bang cleanup that leaves one verified v2 checkpoint plus its revisioned v2 tail in active storage.
3. Remove runtime support for revisionless events, reducer-v1 snapshots, aggregate seeding, compatibility imports, and automatic migration.
4. Correct aggregation inside the existing files and protocols. Do not introduce a new database, protocol epoch, clock model, storage engine, or transport.
5. Make checkpoint creation depend on accepted event volume. An idle server must perform no aggregation to rediscover unchanged state.

---

## C. Corrected Mental Model

1. **The v2 events are not the defect.** Local event creation already gives one command's events one causal revision and calls `store.appendBatch(events)` once.
2. **The batch is lost immediately after local persistence.**

   ```text
   one typed command
      -> one local appendBatch
      -> N outbox entries
      -> N outbox completions
      -> N publishEvent calls
      -> N one-event state-event-batch frames
      -> N receiver store.append calls
      -> N projection aggregations and persistence pairs
   ```

3. **The reducer then performs broad work inside each lost batch.**

   ```text
   accepted event
      -> clone complete projection
      -> scan entity arrays for each changed field
      -> copy complete applied-event identity set
      -> full-history reduction for late causal arrival
      -> rewrite complete projection.json
      -> rewrite complete compatibility tasks.json
   ```

4. **Control Room adds another aggregation layer.** A dirty project slice walks every card and repeatedly scans relationships, annotations, and content files. `/api/control-room` then rebuilds the federated aggregate before checking the ETag.
5. **The current snapshot threshold is already event-based.** `snapshotTailMaximum` defaults to `500`. The defect is that the 30-second maintenance tick scans all events to rediscover the threshold and seals every non-empty segment.

---

## D. Primary Aggregation Defects

1. **P0 — the outbox destroys local batches.** `project-task-state.ts:57-68` drains task entries one at a time, calls duplicate `store.append(event)`, publishes one event, and persists one completion. Server wiring exposes singular `publishEvent(event)` at `create-http-server.ts:261`.
2. **P0 — the sender converts one command into one frame per event.** `publishEvent()` marks pending for one ID and calls `publishBatch(..., [event])` at `federation-task-state-replicator.ts:48-59`.
3. **P0 — the receiver destroys transport batches.** `state-event-batch` loops over payload events and calls `store.append(event)` at `federation-task-state-replicator.ts:119-137`. The existing frame supports `128` events, but persistence receives up to `128` independent aggregation requests.
4. **P0 — duplicates inside one new batch are not deduplicated.** `appendBatch()` creates `known` once and filters the input without adding newly accepted IDs to that set. Two copies of one previously unseen ID in the same frame are both accepted and written.
5. **P0 — duplicate delivery emits false aggregate change.** The receiver adds every incoming ID to `accepted` without inspecting `store.append(event).accepted`. Duplicate batches still acknowledge, invalidate Control Room, and emit SSE refresh.
6. **P0 — the reducer is arrival-order dependent.** Events inside one causal position are not canonically sorted. Entity insertion order, `appliedEventIds`, conflict `emittedAt`, and conflict candidate order inherit transport order. Verified opposite-order inputs produced different complete projection hashes for the same event set.
7. **P0 — incremental reduction clones the complete aggregate.** `reduceTaskEvents()` begins with `structuredClone(base)`. Every accepted batch copies the full ledger, conflicts, applied IDs, and field revisions before changing one field.
8. **P0 — entity aggregation repeatedly scans collections.** `entityFor()` filters the complete entity collection and then performs a linear search for every applied field. Tombstones filter the complete collection. Every changed field filters the complete conflict list. The reducer sorts the complete conflict list after each call.
9. **P0 — late v2 arrival triggers complete-history aggregation.** Any accepted revision at or below `lastRevision` calls `reduceTaskEvents({ events })`. Late arrival is normal between distant writers. De-batching can therefore invoke complete-history reduction once per received event.
10. **P0 — one lost batch writes two complete aggregates.** Each accepted `appendBatch()` serializes and fsyncs full `projection.json`, then serializes and fsyncs full compatibility `tasks.json`. The multiplicative defect is the number of calls, not segment rereading: segments and snapshots are loaded once at store construction.

---

## E. Snapshot and Base Aggregation Defects

1. **P0 — projection base selection uses counts instead of coverage.** `rebuild()` prefers a disk projection when its applied-event count is greater than or equal to the newest snapshot count. Equal counts do not prove equal event sets.
2. **P0 — snapshot equivalence uses ledger checksum plus count.** Two projections can have the same ledger and count while differing in event identity, conflicts, and field revisions.
3. **P0 — identical snapshot installation is not a no-op.** `installSnapshot()` verifies the input, reduces retained events over it, rewrites the complete projection, and triggers invalidation even when the snapshot is already installed.
4. **P0 — a base projection cannot reconstruct a missing same-revision candidate.** Applying a second revision-`2` field event over a snapshot that already contains one revision-`2` result misses the conflict unless the complete same-revision candidates are available. Snapshot replacement must therefore prove set coverage before incremental tail aggregation.
5. **P1 — checkpoint threshold discovery scans complete history.** `maintain()` rebuilds a covered-ID set and filters the complete event array every 30 seconds despite an unchanged accepted-event count.
6. **P1 — checkpoint construction recomputes complete aggregate metadata.** `effectiveBucketManifest()` rebuilds coverage sets and scans events. Snapshot hashing serializes the complete aggregate multiple times. This work is valid at an actual checkpoint boundary and invalid during idle polling.

---

## F. Control Room and Content Aggregation Defects

1. **P0 — invalidation happens before the v2 aggregate commits.** `persistLedgerMutationAndRespond()` invalidates at `create-http-server.ts:917`, then awaits the task command at `:921`. The queued rebuild can consume the old projection. There is no post-commit invalidation carrying affected task identities.
2. **P0 — one dirty project slice repeats full scans.** `buildProjectSlice()` invokes `taskFrom()` for every card. `taskFrom()` repeatedly scans relationships, cards, annotations, pipeline runs, and queued runs for each master task and subtask.
3. **P0 — one slice rereads the same content.** Card Markdown is read to build a task and read again for dependency hashing. Relevant thread Markdown is parsed and then read again for dependency hashing.
4. **P0 — every Control Room GET rebuilds the federated aggregate.** The cached local slice is reused, but the request reconstructs remote task projections, groups logical tasks, hashes semantic values, derives lists, applies project-sync runs, and only then evaluates the ETag.
5. **P1 — full global cache persistence follows every dirty-slice rebuild.** After rebuilding one project, `aggregateProjection()` flattens all project tasks, filters and sorts every status list, serializes the complete cache, and rewrites it.
6. **P1 — content loses its manifest aggregation boundary.** One manifest build reads card and thread Markdown for discovery and reads the files again for hashing. `/api/federation/content-object` rebuilds the complete manifest for every requested hash, then reads and hashes the selected resource again.
7. **P1 — content outbox drain repeats one broad notification per resource.** Multiple exact resources in one local contribution can cause repeated manifest synchronization even though one invalidation covers the batch.

---

## G. V2-Only Offline Cutover

1. Stop all writers and relay delivery.
2. Materialize and verify the current projection once.
3. Write one verified reducer-v2 checkpoint containing that projection and its exact applied-event coverage.
4. Retain only revisioned v2 events not covered by the checkpoint.
5. Delete reducer-v1 snapshots, revisionless events, legacy projection files, and stale compatibility artifacts from active storage.
6. Verify the same projection checksum and v2 tail on every participating node.
7. Remove `revision?`, synthetic legacy positioning, `hasLegacyEvent`, `taskEventsForLegacyProjectionSeed`, automatic `tasks.json` seeding, and compatibility projection import from runtime code.
8. Restart the v2-only system. Startup must reject non-v2 active data instead of migrating it.

---

## H. Minimal Remediation Path

1. **Preserve batches through the existing system.** Drain due task outbox entries as one event array, call `appendBatch()` once, publish through plural `publishEvents()`, retain the existing maximum-`128` frames, call receiver `appendBatch()` once, complete outbox IDs once, acknowledge only `acceptedEventIds`, and notify projection change once.
2. **Fix batch-local deduplication.** Add each newly accepted event ID to `known` while selecting the accepted input.
3. **Make reducer output canonical.** Sort causal-position events by event ID and checksum, process field keys in stable order, sort conflict candidates, sort entity collections by ID, and emit applied-event IDs in stable order.
4. **Index one aggregation pass.** Build entity-by-ID maps and conflict-by-field maps once per reduction. Maintain an events-by-revision index in the store so a late v2 batch reads only the affected causal positions instead of the complete event history.
5. **Aggregate one logical batch once.** Keep one projection persistence pair for each genuinely accepted logical batch during the first correction. Remove the compatibility `tasks.json` export during the offline v2-only cutover. Measure the remaining single `projection.json` write before changing its durability contract.
6. **Make snapshot choice coverage-aware.** Compare applied-event set containment. Use the full canonical snapshot checksum for equivalence. Reject a non-dominating base. Treat an identical installed checkpoint as a no-op.
7. **Move checkpoint triggering into accepted batch processing.** Increment `acceptedEventsSinceCheckpoint` after `appendBatch()`. Queue one checkpoint after crossing `500`. Reset the counter only after the checkpoint is durable. Remove checkpoint threshold discovery from the periodic maintenance pass.
8. **Load one v2 checkpoint plus its uncovered tail.** Record covered segment identities in the checkpoint manifest. Startup must not parse checkpoint-covered segments.
9. **Move Control Room invalidation after accepted aggregation.** Return affected entity identities from `appendBatch()`. Coalesce one project-slice update and one SSE notification per logical batch.
10. **Index one dirty Control Room slice.** Build `cardsById`, relationships by master ID, eligible annotations, pipeline runs by task identity, and queued runs by task identity once. Cache each file buffer so parsing and dependency hashing share one read.
11. **Cache the final Control Room response.** Recompute the federated aggregate only after an accepted task batch, execution observation, project membership change, or project-sync change. Evaluate ETags against the cached result.
12. **Cache one content manifest per project generation.** Reuse file buffers during construction, keep a hash-to-entry map, invalidate through existing exact content callbacks, and coalesce content notifications per drained batch.

---

## I. Work-Budget Acceptance Criteria

1. One multi-event local command causes one outbox batch handoff, one receiver `appendBatch()`, one event-segment fsync, one projection persistence, one acknowledgement, and one Control Room invalidation.
2. One `128`-event federation frame invokes `appendBatch()` exactly once.
3. Duplicate IDs inside one batch are written once. A fully duplicate frame performs zero projection work and zero invalidation.
4. Every delivery permutation of the same v2 event set produces byte-identical projection state, conflict candidates, applied IDs, entity arrays, and snapshot checksum.
5. A late event affecting one field aggregates only the causal positions needed for that field.
6. Equal-count snapshots with different event identities are not treated as equivalent. Identical installation performs zero projection work.
7. An unchanged server performs zero event-history scans and zero checkpoint work across repeated maintenance intervals.
8. Crossing `500` accepted events creates one checkpoint after the accepted batch.
9. Restart opens one v2 checkpoint and only its uncovered event segments.
10. One dirty Control Room slice reads each required card and thread file once.
11. Repeated `/api/control-room` requests with no accepted changes perform zero project slicing and zero federated regrouping.
12. Multiple content-object requests against one unchanged project generation build one manifest.

---

## J. Operator Decision Summary

1. **Keep v2.** The event authority, durable outbox, relay, peer transport, snapshots, and optimistic direction remain valid.
2. **Correct aggregation, not architecture.** Preserve batches, canonicalize the reducer, make snapshot coverage exact, index each aggregation pass, and avoid rewriting unchanged aggregates.
3. **Use the existing `500`-event threshold as the significant-work checkpoint boundary.** Trigger it from accepted batches and remove idle scans.
4. **Complete one offline cleanup and delete runtime legacy code.** The running server must accept only revisioned v2 events and reducer-v2 checkpoints.
5. **Do not introduce a new database, protocol epoch, clock system, storage engine, or transport.** The verified defects are inside the current aggregation boundaries.
