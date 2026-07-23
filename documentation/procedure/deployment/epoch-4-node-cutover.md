## A. Admission State

1. **Current state:** blocked by local implementation gates `J.1` through `J.13`.
2. Do not run this procedure until the progress ledger marks those gates `verified`.
3. Epoch `3` remains the production rollback authority until section `N` passes.

---

## B. Preconditions

1. Workstation and Mobile use the same reviewed epoch-4 commit.
2. The relay deployment uses the matching epoch-4 protocol.
3. Both Decision OS servers and all Codex child processes are stopped.
4. Automatic restart is disabled on both nodes.
5. Each node has its configured federation identity and credential.
6. The repository `.env` contains `ADMIN_SECRET`; verify presence without printing it.
7. Every project repository has no staged operator work.

---

## C. Offline Node Migration

1. Workstation runs:

   ```bash
   node /home/jbb/dev/EditorBP/decision-os/bin/decision-os-migrate-node.mjs \
     --catalog-root /home/jbb \
     --node-id workstation \
     --target-epoch 4 \
     --default-assigned-node workstation
   ```

2. Mobile runs the same installed command with its exact Termux catalog root, `--node-id phone`, `--target-epoch 4`, and `--default-assigned-node workstation`.
3. Keep both servers stopped until both reports pass section `D`.
4. Do not copy migrated state between nodes.

---

## D. Migration Admission

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

## E. Relay Deployment

1. Deploy epoch-4 relay code against the versioned epoch-4 Durable Object namespace.
2. Preserve the epoch-3 namespace unchanged.
3. Require `/health` to report protocol `decision-os-task-state/4`, schema `4`, and baseline epoch `4`.
4. Keep both nodes offline during relay admission.

---

## F. Workstation Publication

1. Start only Workstation through its registered MultiTerm process.
2. Require HTTP `200` from `/`.
3. Require federation phase `connected`.
4. Require every local project root to equal its relay root.
5. Require empty dirty-entity, pending-delivery, and journal inventories.

---

## G. Mobile Join

1. Start Mobile through its registered Termux process.
2. Require federation phase `connected` on both nodes.
3. Require Workstation, Mobile, and relay roots to match for every project.
4. Require identical task counts, assignment labels, execution histories, and canonical projections.
5. Retain explicit concurrent conflicts.

---

## H. Execution Ownership Proof

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

## I. Content and Restart Proof

1. Read a Mobile-owned terminal artifact from Workstation by exact hash.
2. Read a Workstation-owned terminal artifact from Mobile by exact hash.
3. Require lazy retrieval without bulk live-log transfer.
4. Restart Workstation once.
5. Restart Mobile once.
6. Require unchanged roots, task counts, assignments, terminal histories, queued ownership, and automatic synchronization.

---

## J. Failure Containment Proof

1. Reject one execution admission and require visible frontend reconciliation.
2. Time out one execution and require exact child termination.
3. Require the incident to remain scoped to that execution.
4. Require unrelated task launches, health, diagnostics, federation, and other projects to remain available.
5. Require invalid durable state bytes to remain unchanged during injected persistence failure.

---

## K. Rollback

1. Stop both nodes.
2. Repoint the relay deployment to the retained epoch-3 namespace.
3. Restore each node from its own external migration backup.
4. Restore the reviewed epoch-3 code commit.
5. Start Workstation, then Mobile.
6. Require epoch-3 roots and projections to match their pre-cutover evidence.
7. Preserve failed epoch-4 state and reports as incident evidence.

---

## L. Closeout Evidence

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

## M. Production Gate

1. Do not close the cutover while any section `L` evidence is missing.
2. Do not delete epoch-3 backups and namespace while the gate remains open.
3. Do not mark the implementation goal complete before production evidence proves the complete plan.
