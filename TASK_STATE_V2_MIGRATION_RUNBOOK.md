# Node-Local Task Current-State Epoch 3 Cutover

## A. Release Gate

1. Install one reviewed Decision OS commit on the workstation and phone.
2. Verify each node's `.decision-os/.settings.json` contains its unique `federationNodeId`.
3. Verify the configured node IDs are `workstation` and `phone`.
4. Commit tracked ledger sidecars on each node without modifying an existing Git index.
5. Keep both Decision OS servers stopped until their local migrations and the relay reset pass validation.

---

## B. Node Quiescence

1. Disable automatic server restart on the node.
2. Stop the exact Decision OS process.
3. Verify its configured port is closed.
4. Make no ledger, card, thread, or managed-asset edit until startup convergence completes.

---

## C. Local Source Inventory

Run this gate separately on each node.

1. Read the authoritative `.decision-os/projects.json` registry from the catalog root.
2. Require registry version `2`.
3. Require every registered project path and `.decision-os/project.json` identity to resolve.
4. Require each project to expose its `tasks` ledger and referenced local content files.
5. Retain each project's local legacy task-state directory when present.
6. Do not copy state between nodes before migration.
7. Do not use relay state as migration input.

---

## D. Durable Sidecar Checkpoint

Run this gate in every registered project repository.

1. Stop when the Git index already contains operator-approved staged work.
2. Commit the task ledger, card Markdown, thread Markdown, project metadata, and managed assets.
3. Exclude settings, caches, runtime files, voice uploads, migration outputs, and task-state shards.
4. Record the checkpoint commit in the cutover record.

---

## E. Relay State Reset

Run this once while every participating node is offline:

```http
POST /admin/federations/<federation-id>/projects/<project-id>/reset-state
Authorization: Bearer <admin-secret>
```

1. Reset every registered project separately.
2. Require HTTP `200`.
3. Require `ok: true`, the requested project ID, deleted entity and bucket counts, an empty root, and `resetAt`.
4. Preserve node credentials, node manifests, and federation configuration.
5. Save each response in the cutover record.
6. Treat HTTP `409 project_nodes_online` as a failed quiescence gate.

---

## F. Workstation Offline Migration

Run from the installed Decision OS repository:

```bash
node bin/decision-os-migrate-node.mjs \
  --catalog-root /home/jbb/dev/EditorBP/decision-os \
  --node-id workstation
```

1. The command must match `--node-id` against the configured `federationNodeId`.
2. The command reads only local registries, ledgers, content files, and legacy task-state.
3. The command writes an external complete catalog backup before conversion.
4. It converts every registered project and writes one `node-migration-report.json`.
5. It performs no network operation.
6. Keep the returned backup root until production verification completes.

---

## G. Phone Offline Migration

Run the same installed command in Termux with the phone catalog root:

```bash
node bin/decision-os-migrate-node.mjs \
  --catalog-root <termux-catalog-root> \
  --node-id phone
```

1. Apply the same validation gates as the workstation migration.
2. Keep the phone's returned backup root until production verification completes.
3. Do not start the phone server before its complete node report exists.

---

## H. Per-Node Migration Validation

For every project result on each node:

1. Require `stateProtocol` equal to `decision-os-task-state/3`.
2. Require `stateSchema` equal to `3`.
3. Require `baselineEpoch` equal to `3`.
4. Require a 64-character local `baselineRoot`.
5. Require the migration report's `nodeId` to equal the configured federation node ID.
6. Require every resource head's causal replica to name that node.
7. Require every retained resource hash to resolve to an immutable object under the local project task-state root.
8. Review lifecycle audits, body rewrites, relationship repairs, semantic inventory, and canonical projection checksum.
9. Do not require the workstation and phone baseline roots to match before relay synchronization.

---

## I. Startup and Automatic Convergence

1. Start the workstation server.
2. Wait until its local project roots equal the empty relay's joined roots.
3. Start the phone server.
4. Let bucket anti-entropy exchange and join both independently migrated states.
5. Keep writes rejected with `task_state_bootstrap_incomplete` until each local root equals its relay root.
6. Require, for every project:

```text
workstation root = phone root = relay root
```

7. Require both canonical projections to match byte-for-byte.
8. Require node-only entities from both migrations to exist on both nodes.
9. Require divergent shared values to remain explicit task conflicts.
10. Restart each node once and require the same roots and projections after reconnection.

---

## J. Content Verification

1. Confirm connection and catalog synchronization transfer no card, thread, image, voice, or managed-asset bytes.
2. Open one phone-owned card from the workstation.
3. Require one exact-hash request to the `phone` node through `/api/federation/content-object`.
4. Require the fetched bytes to match the advertised SHA-256 hash.
5. Open one workstation-owned resource from the phone and apply the same verification.
6. Require content conflicts to expose every current hash candidate without choosing a migration winner.

---

## K. Rollback

1. Stop both epoch-3 servers.
2. Reset relay project state again while both nodes remain offline.
3. Restore each node exclusively from its own returned backup root.
4. Restore the recorded pre-cutover Decision OS commit.
5. Do not combine writes created after rollback with epoch-3 state.

---

## L. Retention Gate

1. Retain node backups, node migration reports, relay reset responses, checkpoint commits, and convergence evidence until workstation, phone, and restart verification pass.
2. Remove rollback data only through a separately reviewed retention operation.
