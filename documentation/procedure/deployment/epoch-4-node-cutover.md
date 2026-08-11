## A. Admission State

1. **Current state:** Workstation is verified on epoch `4`, and production relay tag `rel-0.4.0` is deployed. Mobile migration, canonical application activation, and the complete cross-node proof remain open.
2. Keep the Workstation server and Mobile server unchanged until the operator explicitly authorizes the remaining production maintenance window.
3. Runtime start and restart never launch migration. Migration begins only through the explicit offline CLI after operator authorization.
4. Do not create a new transaction while one exists. Reuse the exact backup root only for deterministic recovery or independent verification.
5. Do not start Mobile migration until the progress ledger records the exact reviewed release tag installed on the stopped node.
6. Do not admit the Mobile maintenance window until Mobile reports its exact registered stop and start commands, repository state, catalog root, and external backup path.
7. Retained epoch-3 backups and relay `state:v3:*` keys remain rollback authority until section `O` passes.

---

## B. Preconditions

1. Record one published annotated epoch-4 `rel-X.Y.Z` tag for installation on Workstation and Mobile.
2. The relay deployment uses the matching epoch-4 protocol.
3. Both Decision OS servers and all Decision OS-owned child processes are stopped.
4. Automatic restart is disabled on both nodes.
5. Each node has its configured federation identity and credential.
6. The repository `.env` contains `ADMIN_SECRET`; verify presence without printing it.
7. Every project repository has no staged operator work.
8. Run the read-only Workstation inventory while the server remains online:

   ```bash
   node /home/jbb/dev/EditorBP/decision-os/bin/decision-os-plan-node-migration.mjs \
     --catalog-root /home/jbb \
     --node-id workstation \
     --target-epoch 4 \
     --default-assigned-node workstation
   ```

9. Require exactly seven Workstation projects, including the identity-verified external `Ardaria_57` symlink.
10. Record `archiveBytes`, `referencedWorkspaceBytes`, every project source fingerprint, and available space at the backup mount. Available space must exceed `archiveBytes` plus `25%`.
11. Workstation uses an explicit transaction path below `/media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7/decision-os-epoch4-rollbacks`.
12. The archive contains only task-state metadata and files the migration mutates. Audio, images, caches, settings, historical runs, and prior rollback directories remain at their original paths and enter the transaction only as verified hashes.
13. Require both node health routes ready, zero active incidents, and zero paused scopes before quiescence.

---

## C. Quiescence

1. Disable Workstation automatic restart and stop its registered server:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process disable \
     --cwd /home/jbb \
     --port 50150
   ```

2. Run Mobile's preflight-recorded registered stop command. A missing exact command blocks this section.
3. Require both `50150` listeners to be closed.
4. Require no Decision OS-owned child execution to remain live.
5. Keep both nodes stopped through sections `D`, `E`, and `F`.

---

## D. Reviewed Release Installation

1. Merge reviewed `dev` through `decision-os-merge-dev`, publish `main`, and publish the resulting annotated `rel-X.Y.Z` tag.
2. Keep Workstation on canonical published `main`; install the source identified by the same release tag on Mobile through its node-owned update path.
3. Require the release tag to resolve to the reviewed merge and require that release to be installed on both nodes.
4. Do not modify either repository while its Decision OS server is running; the frontend is served directly from the checkout and would otherwise diverge from the loaded backend.

---

## E. Offline Node Migration

1. Workstation runs:

   ```bash
   epoch4_backup_root="/media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7/decision-os-epoch4-rollbacks/workstation-$(date -u +%Y%m%dT%H%M%SZ)"
   test ! -e "$epoch4_backup_root"
   node /home/jbb/dev/EditorBP/decision-os/bin/decision-os-migrate-node.mjs \
     --catalog-root /home/jbb \
     --node-id workstation \
     --target-epoch 4 \
     --default-assigned-node workstation \
     --backup-root "$epoch4_backup_root"
   ```

2. Mobile runs the same installed command with its exact Termux catalog root, `--node-id phone`, `--target-epoch 4`, and `--default-assigned-node workstation`.
3. Mobile supplies one explicit writable backup path outside its catalog root.
4. Keep both servers stopped until both reports pass section `F`.
5. Do not copy migrated state between nodes.
6. The command prepares and validates every project shadow before the first live swap.
7. The transaction retains each legacy task-state root through a same-filesystem rename, journals every swap and sidecar write, and automatically restores completed swaps after a normal failure.
8. Reinvoking the command with the same `--backup-root` rolls back a nonterminal interrupted transaction. Reinvoking a verified transaction returns its independently checked result without copying data again.

---

## F. Migration Admission

1. Require protocol `decision-os-task-state/4`.
2. Require schema `4`.
3. Require baseline epoch `4`.
4. Require one result for every registered project.
5. Require complete task assignment coverage.
6. Require valid execution entity indexes.
7. Require zero missing locally owned content. Locally owned audio and images must resolve through their original path and advertised hash without an object-store copy.
8. Require every unavailable remote-owned object to appear in `deferredRemoteObjects` with its exact key, hash, byte length, and source replica. Deferred remote content resolves through normal exact-hash retrieval after its owner is available.
9. Require zero journals.
10. Require `source-manifest.json` to report `complete: true`, verified hashes for every archived mutation input, and empty `archiveFile` values for referenced media.
11. Require the configured node identity in every report.
12. Run the independent verifier on each node:

    ```bash
    node <decision-os-repository>/bin/decision-os-verify-node-migration.mjs \
      --backup-root <exact-transaction-path>
    ```

13. Require transaction phase `verified`.
14. For every task thread, require the live projected note IDs to equal the legitimate note IDs in the Markdown sidecar.
15. Require no tombstoned note ID to remain agent-visible in Markdown prompt construction.
16. Require every thread resource head hash and byte length to match the sidecar.
17. Read each scoped task thread through `/p/:projectId/api/ledgers/tasks/threads/:threadId` and require the same note identities, roles, order, and bodies as the sidecar after tombstone filtering.

---

## G. Relay Deployment

1. From canonical primary `main`, deploy the published annotated release tag:

   ```bash
   node bin/decision-os-deploy-relay.mjs rel-X.Y.Z --json
   ```

2. Preserve node credential hashes, manifests, labels, and every `state:v3:*` key unchanged. Epoch-4 state uses only `state:v4:*`.
3. Require `/health` to report the tag's resolved compatibility fingerprint, production identity, protocol `decision-os-task-state/4`, schema `4`, and baseline epoch `4`.
4. Record the predecessor deployment and activated Worker version from the command receipt.
5. Relay deployment does not activate application code. Application restarts remain separately authorized node operations.

---

## H. Workstation Publication

1. Start only Workstation through its registered MultiTerm process.
2. Require HTTP `200` from `/`.
3. Require federation phase `connected`.
4. Require every local project root to equal its relay root.
5. Require empty dirty-entity, pending-delivery, and journal inventories.

---

## I. Mobile Join

1. Run Mobile's preflight-recorded registered start command.
2. Require federation phase `connected` on both nodes.
3. Require Workstation, Mobile, and relay roots to match for every project.
4. Require identical task counts, assignment labels, execution histories, and canonical projections.
5. Retain explicit concurrent conflicts.

---

## J. Execution Ownership Proof

1. Disconnect Workstation from the relay.
2. Launch a Workstation-assigned task on Workstation.
3. Require immediate local optimistic placement, local admission, local process execution, durable completion, and server availability.
4. Reconnect Workstation and require automatic relay convergence.
5. From Mobile, launch a Workstation-assigned task while both nodes are connected.
6. Require one execution ID, process ownership only on Workstation, and synchronized active state on both nodes.
7. Stop Workstation connectivity.
8. From Mobile, attempt another Workstation-assigned task.
9. Require `assigned_node_unreachable`, no execution entity, and no Mobile child process.
10. Reassign an idle task to Mobile.
11. Launch it from Workstation and require execution only on Mobile.
12. On both nodes, read `/p/:projectId/api/tasks/:taskId/execution-state` for the same task and require the same complete session-execution hierarchy and default execution identity.
13. Select one active execution and read `/p/:projectId/api/task-executions/:executionId` from its executor and the other node. Require the same execution metadata and presentation events.
14. Select one terminal execution owned by the other node and require exact-hash retrieval of only its JSONL and stderr artifacts before presentation.
15. Inspect the presentation JSON and require no raw tool result field, `stdout`, `stderr`, aggregated output, physical line position, artifact path, content hash, telemetry body, or result body.
16. Use an execution fixture containing a todo update and a comment. Require the latest todo state as typed `todo_list` items and the comment as a chronological `comment` event.

---

## K. Content and Restart Proof

1. Read a Mobile-owned terminal artifact from Workstation by exact hash.
2. Read a Workstation-owned terminal artifact from Mobile by exact hash.
3. Require lazy retrieval without bulk live-log transfer.
4. Restart Workstation once.
5. Restart Mobile once.
6. Require unchanged roots, task counts, assignments, terminal histories, queued ownership, and automatic synchronization.

---

## L. Failure Containment Proof

1. Reject one execution admission and require visible frontend reconciliation.
2. Time out one execution and require exact child termination.
3. Require the incident to remain scoped to that execution.
4. Require unrelated task launches, health, diagnostics, federation, and other projects to remain available.
5. Require invalid durable state bytes to remain unchanged during injected persistence failure.

---

## M. Rollback

1. Stop both nodes.
2. Deploy the reviewed epoch-3 relay code against the same stable `FederationRelay` namespace; it reads the retained `state:v3:*` keys.
3. Execute recorded node rollback independently on each node:

   ```bash
   node <decision-os-repository>/bin/decision-os-recover-node-migration.mjs \
     --backup-root <exact-transaction-path>
   ```

4. Require state `rolled-back`.
5. Restore the reviewed epoch-3 release through a forward corrective release tag.
6. Start Workstation, then Mobile.
7. Require epoch-3 roots and projections to match their pre-cutover evidence.
8. Preserve failed epoch-4 state, transaction journals, and reports as incident evidence.

---

## N. Closeout Evidence

1. Reviewed release tag installed on both nodes.
2. Redacted credential-presence checks.
3. Node migration reports and rollback backup paths.
4. Relay deployment version and health response.
5. Workstation, Mobile, and relay root evidence.
6. Equal task counts and assignment evidence.
7. Offline local execution proof.
8. Authenticated remote execution proof.
9. Assigned-node-unreachable proof.
10. Bidirectional exact-hash artifact proof.
11. Restart durability proof.
12. Failure-containment proof.

---

## O. Production Gate

1. Do not close the cutover while any section `N` evidence is missing.
2. Do not delete epoch-3 backups or relay `state:v3:*` keys while the gate remains open.
3. Do not mark the implementation goal complete before production evidence proves the complete plan.

---

## P. Post-Gate Execution Artifact Collection

1. Run this section only after section `O` passes and the approved artifact-retention period has elapsed.
2. Record one converged project root from the matching Workstation, Mobile, and relay evidence.
3. Stop both registered node servers and verify both `50150` listeners are closed.
4. Run the collector independently on each node:

   ```bash
   node <decision-os-repository>/bin/decision-os-collect-execution-artifacts.mjs \
     --decision-os-root <project>/.decision-os \
     --project-id <project-id> \
     --node-id <node-id> \
     --eligible-before <retention-cutoff-ISO-8601> \
     --converged-root <recorded-project-root> \
     --offline-confirmed
   ```

5. Require the report to name the exact node, project, cutoff, and converged root.
6. Preserve every retained shared hash and every causal tombstone.
7. Start Workstation, then Mobile, through their registered process controls and require unchanged project roots.

---

## Q. Current Production Status

1. **Workstation migration is verified.**
   1. Transaction: `ab0ab732-64d8-464b-b0e7-d2f1266681c4`.
   2. Projects: `7`.
   3. Every project reports `decision-os-task-state/4`, schema `4`, baseline epoch `4`, `missingObjects: 0`, and `journalCount: 0`.
   4. The registered Workstation server returned HTTP `200` after restart.
2. **Workstation content behavior is measured.**
   1. Mutable archive input: `11,576,346` bytes.
   2. Referenced workspace content: `993,873,984` bytes.
   3. Workstation-owned audio and images remained at their source paths.
   4. The cutover installed `199` verified phone-owned cached assets totaling `389,746,672` bytes; deduplicating this remote cache materialization remains open technical debt.
3. **Post-cutover consistency repairs are installed on `origin/main`.**
   1. `e9f1e61a` repairs scoped note derivation, terminal artifact publication ordering, and durable active-phase projection.
   2. `0d4a0338` repairs exact note restoration, thread Markdown content-head persistence, prompt tombstone filtering, and epoch-4 task-run ownership.
   3. Merge `3fc1b01f` contains the complete repair.
4. **The Workstation execution presentation cutover is installed on `origin/main`.**
   1. `d99954eb` adds the task summary resource, exact lightweight execution presentation, todo overlay, comment fidelity, and selected-execution frontend flow.
   2. Merge `724fa0ef` contains the cutover and was verified against the restarted Workstation Rudy task.
5. **The complete production gate remains open.**
   1. Mobile read-only preflight and migration evidence are missing.
   2. The workstation application still reported an unbootstrapped release identity after relay deployment.
   3. Workstation, Mobile, and relay root convergence evidence is missing because Mobile was offline.
   4. Production full-state transfer time and throughput are unmeasured.
   5. Bidirectional assigned-node execution and artifact retrieval evidence is missing.
6. **Epoch-4 relay deployment is complete.**
   1. Release tag: `rel-0.4.0`.
   2. Worker version: `ad1cf3ca-76e7-4e5d-9ec8-e877098f69f0`.
   3. Healthy at `2026-08-08T10:26:45.021Z` with production identity, schema `4`, and baseline epoch `4`.
   4. The following observation recorded no new incidents and zero relay queue, pending delivery, runtime-dirty, active-repair, and content-queue counts.
