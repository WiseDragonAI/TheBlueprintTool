# Epoch-3 Task State and Federation

## A. Runtime Topology

1. **Historical status:** This page records the Epoch-3 architecture and remains the rollback reference. Workstation current behavior is owned by [Epoch-4 task assignment, execution, and content](./epoch-4-task-assignment-execution-and-content.md).
2. **Node:** A Decision OS server owns one catalog root, one federation identity, and every local project registered in `<catalog-root>/.decision-os/projects.json`.
3. **Workstation deployment:** The repository launcher is `/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs`; its production `cwd` is `/home/jbb`; its HTTP origin is `http://127.0.0.1:50150`.
4. **Phone deployment:** Termux runs the same launcher revision against its own catalog root with `federationNodeId` `phone`.
5. **Relay:** `federation-relay/` maintains federation membership and joined epoch-3 structural state. It does not own project source files.
6. **Catalog boundary:** Launcher path chooses code. Process `cwd` chooses `.decision-os/.settings.json`, `.decision-os/projects.json`, and the project catalog served by that process.

---

## B. Configuration Ownership

1. **Node settings:** `<catalog-root>/.decision-os/.settings.json` supplies `federationRelayUrl`, `federationId`, `federationNodeId`, and `federationNodeCredential`.
2. **Relay administration:** The repository `.env` supplies `ADMIN_SECRET` for authenticated relay administration. It is not the node connection credential.
3. **Secret boundary:** Settings and `.env` remain local and ignored. Diagnostics may report configured booleans, node IDs, and relay URLs; they must not emit secret values.
4. **Effective-source rule:** Configuration assessment starts from the registered process `cwd` and the launcher environment. A similarly named settings file outside that catalog is not evidence about the running node.

---

## C. Project State Layout

1. **Format marker:** `<project>/.decision-os/task-state/<projectId>/format.json` must contain `stateProtocol: decision-os-task-state/3`, `stateSchema: 3`, `baselineEpoch: 3`, the exact `projectId`, and a `baselineRoot`.
2. **Structural entities:** `current/<entityType>/*.json` stores canonical epoch-3 entities for ledger lanes, cards, annotations, relationships, resources, and thread-note metadata.
3. **Immutable objects:** `objects/<hash-prefix>/<sha256>` stores card bodies, thread bodies, voice, images, and managed assets.
4. **Journal:** `journal/*.json` records a mutation durably before in-memory join and shard materialization.
5. **Local publication:** `local/held/` excludes held entities from replicated roots until their activation task publishes them.
6. **Migration report:** `migration-report.json` records source audits, repairs, inventories, checksums, backup location, node identity, and baseline root.

---

## D. Structural Entity Contract

1. **Entity identity:** The canonical key is `<entityType>\u0000<entityId>`.
2. **Field registers:** Each field owns a causal clock and one or more dotted candidates.
3. **Presence:** `$entity` records live presence or a tombstone. Concurrent update and delete remain candidates until an explicit resolution causally covers them.
4. **Join:** Node and relay use the same canonical entity validation, hashing, register join, entity join, bucket hash, and root hash implementation from `shared/task-current-state-core`.
5. **Size limit:** `assertTaskCurrentEntity()` rejects a canonical encoded entity above `64 KiB` with `task_current_entity_too_large`.
6. **Lane-specific context:** `mutationContext()` collects clocks only for changed paths. `registerContext()` retains the observed causal history for one changed field and joins the mutation's new dot.
7. **Project clock:** The store may retain a project-wide clock for writer-counter advancement. That aggregate clock is not copied into unrelated field registers.

---

## E. Mutation and Durability Flow

1. A scoped controller supplies `replicaId`, changed entities and fields, activation identity, and publication mode to `store.mutate()`.
2. The store advances the writer counter above the joined project clock.
3. The store builds a mutation batch with lane-specific context.
4. The store atomically writes the journal document.
5. The store converts changed fields into bounded register entities and joins them in memory.
6. The store returns the active delta after journal durability. Held entity keys remain excluded from the returned replicated delta.
7. The bounded materializer writes changed shards, applies local publication state, and deletes completed journal files.
8. On restart, `recoverJournals()` replays retained mutations before normal service. A replay error is a fail-closed startup error; the journal remains evidence and recovery input.

---

## F. Offline Migration

1. **Input:** The node migrator reads the authoritative registry, each project's tasks ledger, file-backed bodies, assets, legacy task-state roots, and project identity.
2. **Network isolation:** Migration performs no federation request. Each node converts only its own local evidence.
3. **Backup:** The migrator copies the catalog `.decision-os` data and every project `.decision-os` data to an external rollback root before replacing active state.
4. **Causal source:** Baseline card and content candidates use the configured node identity. Recovered historical conflicts receive deterministic migration identities.
5. **Content capture:** Every retained resource head must resolve to a local immutable object before the format marker is committed.
6. **Commit boundary:** `format.json` is written last. Runtime admission treats it as proof that the offline transaction completed.
7. **Mixed-state limitation:** The current node migrator throws when it reaches an already epoch-3 project. A catalog containing both epoch `2` and epoch `3` projects requires the recovery procedure until node-level preflight becomes resumable.

---

## G. Federation State Lane

1. **Connection:** The node connector authenticates with the configured relay, federation ID, node ID, and node credential.
2. **Manifest:** Each connected node announces its locally hosted projects.
3. **Summary:** `federation-task-state-replicator.ts` advertises each project root and bucket manifest.
4. **Repair:** A root or bucket mismatch produces `state-missing-request`; only entities in mismatched buckets are sent.
5. **Bounded frames:** Entity batches contain at most `128` entities and at most `512 KiB` of encoded frame data.
6. **Acknowledgement:** Relay acknowledgements carry `deliveryId`, accepted entity keys and hashes, and the resulting relay root.
7. **Dirty clearing:** Runtime dirty entries clear only when the matching acknowledgement confirms the exact current hash.
8. **Closed loop:** Summary exchange repeats until bucket sets and roots match.
9. **Readiness:** `canWrite()` returns true only when the project has a relay convergence row whose root equals the local store root.
10. **Diagnostics:** `/api/federation/replication-status` exposes convergence, missing buckets, runtime dirty entries, pending delivery IDs, project entity counts, journal counts, current bytes, conflicts, and content-lane status.

---

## H. Remote Project State

1. **Local project:** A project present in the node's registry uses its project-owned task-state root and remains locally authoritative.
2. **Remote-only project:** The node creates a derived store under `<catalog-root>/.decision-os/cache/federation-task-state/task-state/<projectId>`.
3. **Strict cache format:** Remote stores use the same epoch-3 format contract as local stores.
4. **Derived-data recovery:** An incompatible remote cache is archived while the server is stopped, then recreated and repopulated from the relay. The project store validator is not weakened.
5. **Catalog merge:** `/decision-os/projects` combines local project manifests and remote node manifests through `federatedProjectCatalog()`.
6. **Replica identity:** Owner node identity stays explicit in remote project and content routing. Equal project IDs do not remove replica ownership.

---

## I. Federation Content Lane

1. **Eager data:** Structural resource heads replicate with task entities. They contain type, key, SHA-256, byte length, changed time, and source replica identity.
2. **Lazy data:** Object bodies do not transfer during node connection, project announcement, root repair, or catalog listing.
3. **Demand:** A remote card or thread read applies the relevant head to the content store and checks whether the exact object is already cached.
4. **Pending response:** If bytes are absent, the route returns `HTTP 202` with `state_synchronizing`, prioritizes the exact resource, and drains the content scheduler.
5. **Fetch:** The scheduler requests `/api/federation/content-object?projectId=<id>&hash=<sha256>` through the selected source node.
6. **Integrity:** Received bytes are stored only after exact-hash verification.
7. **Ready response:** A repeated read returns `HTTP 200`, `state.status: synchronized`, `content.status: available`, and the hydrated body.
8. **Conflict:** Multiple current hashes remain candidates. The content lane reports the conflict instead of choosing by timestamp.

---

## J. Operational Diagnostics

1. **Server:** `curl -sS -I http://127.0.0.1:50150/` proves HTTP availability after startup recovery.
2. **Catalog:** `GET /decision-os/projects` proves local registry loading and remote-store admission.
3. **Connector:** `GET /api/settings/federation` proves effective configuration, socket state, phase, node identity, retry state, and peers.
4. **State lane:** `GET /api/federation/replication-status` proves per-project root repair, journals, dirty state, pending deliveries, and conflicts.
5. **Content manifest:** `GET /api/federation/content-manifest?projectId=<id>&key=<encoded-key>` returns the authoritative current heads for one local resource.
6. **Content object:** `GET /api/federation/content-object?projectId=<id>&hash=<sha256>` serves a locally owned or already verified cached object.

---

## K. Failure Boundaries

1. **`task_state_offline_migration_required`:** No compatible state exists and runtime initialization was not explicitly authorized.
2. **`unsupported_task_current_state_format`:** A local or derived store has an incompatible protocol, schema, epoch, or project identity.
3. **`task_current_entity_too_large`:** A structural entity violates the frame-compatible size ceiling.
4. **`task_state_bootstrap_incomplete`:** A federated writer has not reached exact relay-root equality.
5. **`state_frame_too_large`:** One entity cannot fit the bounded federation frame contract.
6. **`state_synchronizing`:** Structural state or demanded content is not yet locally ready for the requested remote read.

---

## L. Primary Evidence

1. `shared/task-current-state-core/`
2. `backend/src/business/task-state/helper/task-current-state-store.ts`
3. `backend/src/business/task-state/helper/task-current-state-migration.ts`
4. `backend/src/business/task-state/controller/migrate-node-task-current-state.ts`
5. `backend/src/business/federation/helper/federation-task-state-replicator.ts`
6. `backend/src/business/federation/helper/federation-content-store.ts`
7. `backend/src/business/federation/helper/federation-content-scheduler.ts`
8. `backend/src/business/server/application/create-decision-os-server.ts`
9. `backend/test/unit/task-state/`
10. `backend/test/unit/federation/`
