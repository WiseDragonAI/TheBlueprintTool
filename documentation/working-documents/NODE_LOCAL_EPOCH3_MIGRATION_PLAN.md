## A. Concrete Target Architecture

Each node runs the same offline executable against its own filesystem:

```text
tasks.json + card/thread/assets + legacy task-state
                         │
                         ▼
          decision-os-migrate-node
                         │
                         ▼
 epoch-3 shards + immutable objects + format.json
                         │
                    server starts
                         │
                         ▼
             relay CRDT anti-entropy
                         │
                         ▼
       workstation root = phone root = relay root
```

No migration data passes through the relay. The relay only synchronizes the epoch-3 outputs after startup.

---

## B. Offline Node Migrator

Add a node-level command:

```bash
node bin/decision-os-migrate-node.mjs \
  --catalog-root /path/to/catalog \
  --node-id workstation
```

Termux runs the same command with:

```bash
--node-id phone
```

The command must:

1. Read `.decision-os/projects.json`.
2. Resolve every registered project.
3. Read each project’s `tasks.json`.
4. Read its card Markdown, thread Markdown, and managed assets.
5. Read its local legacy task-state when present.
6. Back up the complete local `.decision-os` directory.
7. Convert each project independently.
8. Write one node-level migration report.
9. Perform no network request.

The current project-level migration function remains the conversion engine. The node command supplies project paths and the federation node identity.

---

## C. Causal Encoding

The converter must calculate a migration counter above the node’s existing causal clock.

Example:

```json
{
  "replicaId": "workstation",
  "counter": 18
}
```

The phone independently produces:

```json
{
  "replicaId": "phone",
  "counter": 6
}
```

If both nodes contain the same card with different titles, the migrated register becomes joinable:

```json
{
  "candidates": [
    {
      "dot": { "replicaId": "workstation", "counter": 18 },
      "operation": "set",
      "value": "Desktop title"
    },
    {
      "dot": { "replicaId": "phone", "counter": 6 },
      "operation": "set",
      "value": "Phone title"
    }
  ]
}
```

That produces an explicit conflict. The current shared `baseline:1` encoding cannot represent this because both values receive the same causal identity.

This translates into changes to:

1. `migrateTaskCurrentState(...)`: accept `nodeId`.
2. `createTaskCurrentStateStore(...)`: accept the migration replica and counter when initializing a baseline.
3. `task-current-state-migration.ts`: replace `baseline` and `baseline-content` with the real node identity.
4. `register-join.ts`: reject the same dot carrying different operations or values.

---

## D. Content Conversion

Every local content file becomes an immutable object:

```text
.decision-os/cards/tasks/card-a.md
              │ SHA-256
              ▼
.decision-os/task-state/<project>/objects/73/7336c4...
```

The corresponding resource entity records:

```json
{
  "type": "card-markdown",
  "key": ".decision-os/cards/tasks/card-a.md",
  "hash": "7336c4...",
  "bytes": 4821,
  "sourceReplicaId": "phone"
}
```

The source must be `phone`, not `baseline-content`, because the content scheduler uses that value as the federation node destination.

The relay synchronizes only this small resource head. When the workstation opens the card, it requests the exact hash from `phone` through:

```text
/api/federation/content-object?projectId=<id>&hash=<sha256>
```

The relay does not store card bodies.

---

## E. Startup Synchronization

The existing synchronization mechanism should execute this sequence automatically:

1. The node validates its local `format.json`.
2. The node connects using configured federation credentials.
3. It sends its project manifest.
4. It advertises each project root and bucket checksums.
5. The relay requests buckets missing from relay state.
6. The node uploads those epoch-3 entities.
7. The node requests buckets missing from local state.
8. The relay returns joined entities from the other node.
9. Both sides repeat the summary exchange.
10. Writes remain rejected with `task_state_bootstrap_incomplete`.
11. Writes become enabled when the local root exactly equals the relay root.

Most of this state machine already exists in `federation-task-state-replicator.ts`.

---

## F. Relay Cutover Operation

Before either migrated node starts, relay project state must be empty. Add an authenticated operation:

```http
POST /admin/federations/<federation-id>/projects/<project-id>/reset-state
```

It must:

1. Reject the request while a participating node is connected.
2. Delete only that project’s `state:v3:entity:` and `state:v3:bucket:` keys.
3. Preserve node credentials and federation configuration.
4. Return the deleted entity count, bucket count, and empty root.
5. Record the reset in Durable Object storage.

This prevents old epoch-3 recovery data from joining the newly converted node state.

---

## G. Required Verification Scenario

The missing integration test must use two independent directories:

1. Workstation contains a workstation-only card and one version of a shared card.
2. Phone contains a phone-only card and a different version of the shared card.
3. Each directory is migrated independently.
4. Both servers start against an empty relay.
5. The test waits for:

```text
workstation root = phone root = relay root
```

6. Both projections contain both node-only cards.
7. The shared divergence appears as an explicit conflict.
8. A workstation request retrieves a phone-owned content hash.
9. Both nodes remain writable after convergence and survive a fresh restart.

That is the concrete implementation required for the intended architecture.
