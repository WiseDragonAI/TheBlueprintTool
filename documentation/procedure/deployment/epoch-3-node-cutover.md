# Epoch-3 Node Cutover

## A. Preconditions

1. **Installed revision:** Workstation and phone use the same reviewed Decision OS revision containing the epoch-3 migrator, strict runtime, relay protocol, and sparse causal-context repair.
2. **Catalog identity:** Resolve the exact catalog root for each node. On the workstation, the production catalog root is `/home/jbb`; the code repository remains `/home/jbb/dev/EditorBP/decision-os`.
3. **Registry:** Require `<catalog-root>/.decision-os/projects.json` version `2`. Record every project ID, name, and relative path before migration.
4. **Node settings:** Require `federationRelayUrl`, `federationId`, `federationNodeId`, and a non-empty `federationNodeCredential` in the catalog settings file.
5. **Relay administration:** Require `ADMIN_SECRET` in the repository `.env` before the relay reset. Check presence without printing its value.
6. **Git index:** Stop when a project repository contains staged operator work. Do not modify, commit, or unstage protected hunks.
7. **Quiescence:** Disable automatic restart, stop both Decision OS servers, prove both ports closed, and block card, thread, ledger, and asset edits until migration completes.

---

## B. Configuration Presence Checks

1. **Workstation node settings:**

   ```bash
   jq '{
     federationNodeId,
     relayConfigured:(.federationRelayUrl|type=="string" and length>0),
     federationConfigured:(.federationId|type=="string" and length>0),
     credentialConfigured:(.federationNodeCredential|type=="string" and length>0)
   }' /home/jbb/.decision-os/.settings.json
   ```

2. **Relay administrator secret:**

   ```bash
   rg -q '^ADMIN_SECRET=' /home/jbb/dev/EditorBP/decision-os/.env
   ```

3. **Expected workstation result:** Node ID `workstation`; every configured boolean `true`; command output contains no credential value.
4. **Phone:** Apply the same settings-key check to the Termux catalog root and require node ID `phone`.

---

## C. Catalog and Format Inventory

1. Read the complete registry from the selected catalog root.
2. For each entry, resolve the real project directory and require `.decision-os/project.json` to contain the same project ID.
3. Read `.decision-os/state.json` and require a `tasks` ledger whose `ledgerFile` exists inside the project `.decision-os` directory.
4. Inspect `.decision-os/task-state/<projectId>/format.json` when present.
5. Classify each project as `legacy`, `epoch-3`, or `invalid`.
6. Stop on `invalid`.
7. Record the intended project-name list. Migration verification must return the same complete list.

---

## D. Relay Reset

1. Keep every participating node offline.
2. Reset every participating project through:

   ```http
   POST /admin/federations/<federation-id>/projects/<project-id>/reset-state
   Authorization: Bearer <ADMIN_SECRET>
   ```

3. Require `HTTP 200`, `ok: true`, the exact project ID, deleted entity count, deleted bucket count, empty root, and `resetAt`.
4. Treat `HTTP 409 project_nodes_online` as failed quiescence.
5. Preserve node credentials and federation membership.
6. Save the redacted reset response with cutover evidence.

---

## E. Complete Legacy Catalog Migration

1. Use the node migrator only when every registered project is legacy:

   ```bash
   node /home/jbb/dev/EditorBP/decision-os/bin/decision-os-migrate-node.mjs \
     --catalog-root /home/jbb \
     --node-id workstation
   ```

2. Termux runs the same installed command with its exact catalog root and `--node-id phone`.
3. Require the command to return one external node backup, one project result per registry entry, and one `node-migration-report.json`.
4. Do not copy workstation state to the phone. Do not copy phone state to the workstation. Do not use relay state as migration input.

---

## F. Mixed Epoch Recovery

1. **Current limitation:** The node migrator rejects an already epoch-3 project. Do not run it blindly against a catalog containing both legacy and epoch-3 projects.
2. Keep the server stopped.
3. Retain and verify existing epoch-3 project reports and backups.
4. Migrate each remaining legacy project through the installed project migration CLI:

   ```bash
   env TSX_TSCONFIG_PATH=/home/jbb/dev/EditorBP/decision-os/backend/tsconfig.json \
     /home/jbb/dev/EditorBP/decision-os/backend/node_modules/.bin/tsx \
     /home/jbb/dev/EditorBP/decision-os/backend/src/cli/migrate-task-current-state.ts \
     --decision-os-root <project>/.decision-os \
     --project-id <project-id> \
     --node-id workstation \
     --tasks-ledger <project>/.decision-os/tasks.json
   ```

5. Run one project at a time. Stop at the first non-zero exit.
6. Preserve every returned backup directory and migration report.
7. Produce a cutover inventory that combines the retained epoch-3 reports and the newly migrated project reports.

---

## G. Per-Project Migration Validation

1. Require `stateProtocol` `decision-os-task-state/3`.
2. Require `stateSchema` `3`.
3. Require `baselineEpoch` `3`.
4. Require the format `projectId` to equal `.decision-os/project.json`.
5. Require the migration report `nodeId` to equal the node's configured federation identity.
6. Require the report root to equal the format `baselineRoot` immediately after migration.
7. Review `sourceValueAudit`, `bodyRewriteReport`, `relationshipRepairReport`, `semanticInventory`, `currentEntityInventory`, and `canonicalProjectionChecksum`.
8. For every locally owned resource-head candidate, require its SHA-256 object under `objects/<prefix>/<hash>`.
9. Do not require remote-owned lazy objects to exist locally.
10. Require the report backup path to contain the complete copied `.decision-os` directory.
11. Require zero journals before startup.

---

## H. Derived Federation Cache Admission

1. Inspect `<catalog-root>/.decision-os/cache/federation-task-state/task-state/*/format.json` while the server remains stopped.
2. Keep caches whose markers satisfy protocol, schema, epoch, and project identity `3`.
3. Move any incompatible federation-task-state cache intact into `<catalog-root>/.decision-os/task-state-rollback/<timestamped-cache-backup>`.
4. Do not weaken `validateFormat()` and do not convert derived cache entities in place.
5. The restarted node recreates missing remote stores and refills them through relay anti-entropy.

---

## I. Workstation MultiTerm Registration

1. Disable and unregister an obsolete registration only after verifying its exact `cwd` and port.
2. Avoid the initial-launch monitor race by registering the new catalog without enabling or launching it:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process register \
     --cwd /home/jbb \
     --cmd 'env PORT=50150 /home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs' \
     --port 50150 \
     --url http://127.0.0.1:50150/ \
     --name decision-os-workstation \
     --description 'decision-os workstation production catalog server' \
     --no-launch \
     --no-auto-restart
   ```

3. Enable and launch under the registry lock:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process toggle \
     --cwd /home/jbb \
     --port 50150
   ```

4. During cold start, count process groups. One registered shell, launcher, and backend child are one process group. A second process group is a duplicate launch.
5. Do not launch a second server outside MultiTerm.

---

## J. Startup and State Convergence

1. Start the workstation against the reset relay.
2. Wait for the listener after synchronous store loading and journal recovery.
3. Require `HTTP 200` from `/`.
4. Require `/decision-os/projects` to return the complete local registry plus expected remote-only projects. This route also proves remote cache admission.
5. Require `/api/settings/federation` to report `configured: true`, `connected: true`, `phase: connected`, the exact local node ID, an empty `lastError`, and the expected peer online.
6. Start the phone after its local migration is verified.
7. Query `/api/federation/replication-status` until every observed project convergence row has `converged: true`, no missing buckets, and a non-empty root.
8. Require `runtimeDirty` empty, `pendingDeliveryIds` empty, and every project `journalCount` zero.
9. Require every projection version `3`.
10. Retain explicit conflicts. Do not resolve them as a deployment shortcut.

---

## K. Lazy Content Verification

1. Select one phone-owned card whose resource head names `phone`.
2. Read it from the workstation through its project-scoped card route with `replica=phone`.
3. Accept an initial `HTTP 202` only when task state is synchronized and exact content is queued.
4. Repeat the same read and require `HTTP 200`, `state.status: synchronized`, `content.status: available`, and hydrated Markdown.
5. Hash the returned body bytes and require the advertised SHA-256.
6. On the phone, select one workstation-owned card and repeat the same proof with `replica=workstation`.
7. Confirm the content queue returns to zero and no unrelated object bodies were fetched.

---

## L. Restart Durability

1. Restart the workstation once through MultiTerm.
2. Restart the phone once through its registered Termux procedure.
3. Require the same project inventory after each restart.
4. Require all format markers to remain epoch `3`.
5. Require all relay convergence roots to return to their pre-restart values.
6. Require no retained journal, dirty entity, pending delivery, missing bucket, format exception, or duplicate process group.
7. Repeat one lazy-content read from each direction.

---

## M. Rollback

1. Stop both servers and disable automatic restart.
2. Reset relay state for every participating project while nodes are offline.
3. Restore each project only from its node-local rollback directory.
4. Restore the catalog `.decision-os` data from the matching node backup.
5. Restore the pre-cutover Decision OS code revision.
6. Do not join post-cutover epoch-3 writes into restored legacy state.
7. Keep the failed epoch-3 roots and reports as incident evidence.

---

## N. Closeout Evidence

1. Installed code commit on workstation and phone.
2. Redacted configuration presence report.
3. Complete catalog inventory for both nodes.
4. Relay reset responses.
5. Node and project migration reports.
6. Rollback backup paths.
7. Protocol, schema, epoch, object-integrity, and semantic-inventory verification.
8. Workstation, phone, and relay root table.
9. Explicit conflict inventory.
10. Bidirectional exact-hash content proof.
11. Restart durability proof.
12. Commit hashes whose bodies record `WHAT:` and `WHY:`.
