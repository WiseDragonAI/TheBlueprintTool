## A. Repository Intent

1. **Decision OS keeps replicated execution history authoritative while process files remain node-local.**
2. Terminal execution artifacts are captured by exact SHA-256 under the project task-state object namespace and referenced from the replicated execution artifact lane.
3. Session deletion must preserve causal tombstones long enough for every node to converge without allowing stale-state resurrection.

---

## B. Current Iteration Intent

1. `documentation/codex-task-assignment-and-replicated-execution-plan-2026-07-23.md` section `H.17.3` requires local artifact collection after retention and replicated-root convergence.
2. Verification row `L.33` requires execution tombstones to replicate before artifact collection.
3. Epoch-3 rollback backups and the epoch-3 relay namespace remain retained through the complete production matrix and are never collector targets.

---

## C. Findings

1. **Gap — no artifact collector exists.** `deleteThreadCodexSessionController()` removes the card's session association after `TaskExecutionRepository.deleteSession()` commits execution tombstones and a `codex-session-deletion` resource. It intentionally returns `artifactsRetained: true`; no later code deletes the retained bytes.
2. **Dual ownership prevents safe object deletion.** `ProjectTaskState.finalizeExecutionArtifacts()` publishes file-path resource heads and execution artifact heads for the same bytes. Tombstoning the execution does not tombstone those resource heads.
3. **Card-relative raw-file targets are lost after deletion.** Replicated execution metadata correctly excludes local paths and the controller removes card run-output references. The generated session ID remains durable in the session-deletion resource and can identify exact same-basename files only inside `.decision-os/runs/codex-skills/`.
4. **A content hash is not session-owned.** One immutable object can be referenced by another execution, a conflicted candidate, a card body, a thread body, or a managed asset. Per-session hash deletion without a project-wide reachability mark can corrupt unrelated content.
5. **Relay equality alone is insufficient for automatic timing policy.** The runtime exposes relay convergence, dirty entities, and pending deliveries, but the specification defines no retention duration. Inventing an automatic deadline would create an unverified deletion policy.
6. **Causal tombstones are permanent state.** Collection may delete eligible bytes only. It must never remove execution entities, session-deletion resources, task-state shards, rollback data, federation cache objects, or node-message artifacts.

---

## D. Remediation Path

1. **Use one explicit project-scoped maintenance command.** Add `decision-os-collect-execution-artifacts` with required `--decision-os-root`, `--project-id`, `--node-id`, `--eligible-before`, and `--converged-root` arguments. The operator-provided cutoff marks the end of the retention period without adding a speculative product default.
2. Stop publishing path-based resource heads for execution artifacts. The replicated execution artifact lane becomes their sole reachability root.
3. The command refuses collection unless the local root equals `--converged-root`, the session deletion predates `--eligible-before`, every named execution has one unambiguous tombstone, the session-deletion resource is conflict-free, and the store has zero journals.
4. Before unlinking, mark every hash reachable from all live and conflicted execution artifact candidates plus every resource-head candidate. Delete only unmarked artifact hashes named by eligible tombstoned executions.
5. Locate raw files by the exact durable session basename below `.decision-os/runs/codex-skills/`. Reject unsafe session IDs and never follow a path outside that namespace. Delete every exact `.jsonl`, `.log`, `.md`, and `.jsonl.telemetry.jsonl` match for the eligible session; this also reaches executor-local files when the same command runs independently on each node.
6. Sync affected directories and report exact retained, deleted, and already-absent targets. A failure rejects the command without changing causal state; a retry is idempotent because deletion resources and tombstones remain durable.
7. Run the command only after the production matrix has proved Workstation, Mobile, and relay root equality. Run it independently on each node with that recorded root.

---

## E. Operator Decision Summary

1. **Selected design:** explicit converged-root maintenance command with an explicit retention cutoff.
2. **Tradeoff:** cleanup requires one deliberate operational step. This avoids a replicated garbage-collection queue, a background deletion scheduler, an invented retention duration, and unsafe inference from partial peer visibility.
3. **Required verification:** pre-cutoff retention, root mismatch rejection, journal rejection, tombstone ambiguity rejection, shared-hash retention, exact raw-file namespace validation, eligible deletion, retry idempotency, byte-identical tombstone preservation, and exclusion of rollback plus federation-cache namespaces.
