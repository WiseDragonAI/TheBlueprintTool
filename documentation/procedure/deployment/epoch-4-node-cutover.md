## A. Admission State

1. **Current state:** local implementation and automated verification rows `1` through `36` pass. Served verification row `37` remains open.
2. Keep both node servers unchanged until the operator explicitly authorizes the production maintenance window.
3. Do not start migration until the progress ledger records the exact reviewed commit installed on both stopped nodes.
4. Do not admit the maintenance window until Mobile reports its exact registered stop and start commands, repository state, catalog root, and external backup path.
5. Epoch `3` remains the production rollback authority until section `O` passes.

---

## B. Preconditions

1. Record one reviewed epoch-4 commit for installation on Workstation and Mobile.
2. The relay deployment uses the matching epoch-4 protocol.
3. Both Decision OS servers and all Decision OS-owned child processes are stopped.
4. Automatic restart is disabled on both nodes.
5. Each node has its configured federation identity and credential.
6. The repository `.env` contains `ADMIN_SECRET`; verify presence without printing it.
7. Every project repository has no staged operator work.
8. Workstation uses an explicit backup path below `/media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7/decision-os-epoch4-rollbacks`. The migrator's default path resolves below `/home`, which is not writable by the Workstation operator.
9. Require at least `12 GiB` free at the Workstation backup mount before migration.
10. Require both node health routes ready, zero active incidents, and zero paused scopes before quiescence.

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

## D. Reviewed Commit Installation

1. Merge the reviewed feature branch into Workstation `main` with a merge commit containing `WHAT:` and `WHY:`, then push `main`.
2. Install the pushed `origin/main` commit on Mobile.
3. Require `git rev-parse HEAD` to return the same recorded commit on both nodes.
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

---

## F. Migration Admission

1. Require protocol `decision-os-task-state/4`.
2. Require schema `4`.
3. Require baseline epoch `4`.
4. Require one result for every registered project.
5. Require complete task assignment coverage.
6. Require valid execution entity indexes.
7. Require zero missing locally owned objects.
8. Require zero journals.
9. Require a complete byte-preserving external rollback backup.
10. Require the configured node identity in every report.

---

## G. Relay Deployment

1. Deploy epoch-4 relay code against the versioned epoch-4 Durable Object namespace.
2. Preserve the epoch-3 namespace unchanged.
3. Require `/health` to report protocol `decision-os-task-state/4`, schema `4`, and baseline epoch `4`.
4. Keep both nodes offline during relay admission.

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
2. Repoint the relay deployment to the retained epoch-3 namespace.
3. Restore each node from its own external migration backup.
4. Restore the reviewed epoch-3 code commit.
5. Start Workstation, then Mobile.
6. Require epoch-3 roots and projections to match their pre-cutover evidence.
7. Preserve failed epoch-4 state and reports as incident evidence.

---

## N. Closeout Evidence

1. Reviewed code commit installed on both nodes.
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
2. Do not delete epoch-3 backups and namespace while the gate remains open.
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
