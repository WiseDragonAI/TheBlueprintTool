## A. Iteration Identity

1. **Objective:** execute `documentation/codex-task-assignment-and-replicated-execution-plan-2026-07-23.md` through local implementation, automated verification, served proof, runbooks, migration readiness, and production-readiness evidence.
2. **Implementation branch:** `feature/epoch4-task-execution`.
3. **Base commit:** `0c72b4ed95c12bcfb0a27ddcbf56f4ecfdba5df7`.
4. **Production branch:** `main`.
5. **Current phase:** `J.6 — Replace direct execution authority`.
6. **Overall state:** `in-progress`.
7. **Production state:** epoch `3` remains active. Epoch `4` is not admitted for production use.

---

## B. Remote Progress Check

1. Fetch the implementation branch without changing the checked-out branch:

   ```bash
   GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' \
     git fetch origin feature/epoch4-task-execution
   ```

2. Read this ledger directly from the fetched branch:

   ```bash
   git show origin/feature/epoch4-task-execution:documentation/working-documents/epoch-4-task-execution-iteration-status.md
   ```

3. Inspect the implementation commits:

   ```bash
   git log --format='%h %cs %s' origin/main..origin/feature/epoch4-task-execution
   ```

4. Inspect changed files:

   ```bash
   git diff --stat origin/main...origin/feature/epoch4-task-execution
   ```

5. **Interpretation:** only rows marked `verified` have passing evidence. `implemented` means source work exists but its complete gate has not passed. `pending` means no completion claim.

---

## C. Plan Gate Ledger

1. **J.1 — Freeze epoch-4 contracts:** `verified`.
   1. Required evidence: shared assignment and execution schemas, phase transition rules, CRDT merge behavior, relay protocol admission, and focused tests.
   2. Implemented atomic assignment, execution metadata, execution lifecycle, execution artifact, and `cancelling` contracts.
   3. Implemented explicit assignment and execution conflict classification.
   4. Implemented relay epoch-4 admission, `state:v4` storage keys, and `FederationRelayV4` Durable Object namespace migration.
   5. Focused backend result: `30` tests passed.
   6. Relay result: `8` tests passed.
   7. Backend and relay typechecks passed.
2. **J.2 — Build the offline migrator:** `verified`.
   1. Accepts epoch-3 current shards and projection captures and publishes protocol, schema, and baseline epoch `4` only after durable conversion.
   2. Requires CLI `--target-epoch 4` and one explicit `--default-assigned-node`; the production runbook uses `workstation` on both nodes.
   3. Assigns every master task to `workstation`; subtasks retain inherited assignment.
   4. Converts canonical execution records, direct queue entries, all pipeline skills, active card intents, and retained thread sessions into execution entities.
   5. Converts every non-terminal legacy attempt to `interrupted`, retains terminal history, links pipeline predecessors, and captures available artifacts by exact hash.
   6. Preserves pipeline definitions while removing mutable run manifests after backup; retires the canonical legacy execution file and direct queue after entity installation.
   7. Reports protocol, schema, epoch, assignment coverage, execution-index validity, missing artifacts, missing objects, semantic inventory, zero journals, checksums, roots, and external rollback paths.
   8. Focused migration result: `11` tests passed.
   9. Backend typecheck passed.
3. **J.3 — Persist task assignment:** `verified`.
   1. The existing creation modal keeps its node tabs, presence, project selection, keyboard behavior, and request routing while persisting the selected node as `assignedNodeId`.
   2. Optimistic task identity is now `projectId`, `ledgerId`, and `cardId`; serving-replica ownership no longer splits one logical task.
   3. Master tasks persist one atomic assignment lane. Subtasks inherit that assignment and reject direct reassignment.
   4. The project-scoped `reassign-task` command resolves assignment conflicts by writing one revision above every observed candidate and rejects non-terminal execution with `task_execution_active`.
   5. CLI-created master tasks require an explicit assignment and retain the separate publication operation.
   6. Internal project-sync and runtime-incident master-task creation supply the local configured node assignment.
   7. The Control Room joins replicas into one task identity and displays assignment label plus online state independently from replica provenance.
   8. Focused backend result: `24` distinct assignment and supporting tests passed.
   9. Focused frontend result: `47` tests passed.
   10. Backend and frontend typechecks passed.
4. **J.4 — Install the replicated execution repository:** `verified`.
   1. Project task state now owns one epoch-4 execution repository backed by execution entities and the existing journal, shard, bucket, root, and federation publication path.
   2. Admission is idempotent by `taskId` plus `requestId`; concurrent execution IDs for one request remain explicit blocked diagnostics.
   3. Awaited lifecycle transitions enforce the canonical phase graph, immutable executor, immutable provider session, monotonic timestamps, and revision increments.
   4. Terminal artifact manifests are independently revisioned and contain exact content heads.
   5. Rebuildable indexes cover task, session, pipeline run, phase, executor node, and request identity.
   6. Entity, lifecycle, and request conflicts are excluded from scheduling indexes and remain visible in Control Room diagnostics.
   7. Control Room derives active task placement from execution entities, invalidates by indexed task ID, and retains legacy card-intent reading only for the open legacy-removal gate.
   8. Offline migration now emits the required all-null artifact lane for executions without captured files; the repository indexes every migrated execution.
   9. Focused backend result: `76/76`.
   10. Backend typecheck passed.
5. **J.5 — Install assignment-aware admission:** `verified`.
   1. One `TaskExecutionRouter` resolves every task source to its master and reads the master’s conflict-free assignment before choosing a destination.
   2. Local admission serially persists `preparing`, validates the lineage, active-execution fence, predecessor, session policy hook, and capacity policy hook, then persists `queued`.
   3. Local retries return the original durable receipt by `projectId`, `taskId`, and `requestId`; concurrent direct admissions allow exactly one queued execution.
   4. Connected remote assignment uses the connector’s authenticated node request and the assigned node’s identical local admission path.
   5. Offline assigned nodes return `assigned_node_unreachable` with `assignedNodeId` and create no execution on the requesting node.
   6. Assignment conflict blocks before admission. A local post-`preparing` validation rejection is retained as one durable failed execution.
   7. Non-task execution binds directly to the current node and creates no task assignment state.
   8. The internal admission route requires a currently online authenticated federation peer.
   9. The server no longer includes relay-root equality in the project task-state write predicate.
   10. Focused router and server result: `20/20`.
   11. Backend typecheck passed.
6. **J.6 — Replace direct execution authority:** `pending`.
7. **J.7 — Replace pipeline execution authority:** `pending`.
8. **J.8 — Move exceptional launch paths:** `pending`.
9. **J.9 — Replace control paths:** `pending`.
10. **J.10 — Replace recovery:** `pending`.
11. **J.11 — Complete optimistic frontend behavior:** `pending`.
12. **J.12 — Delete legacy authorities:** `pending`.
13. **J.13 — Run failure and convergence verification:** `pending`.
14. **J.14 — Execute the epoch-4 production cutover:** `pending`.

---

## D. Current Verified Gaps

1. Direct execution launch surfaces still bypass `TaskExecutionRouter` and write `.decision-os/codex-executions.json` before the scheduler-visible legacy queue.
2. The scheduler reads `.decision-os/codex-process-queue.json` and mutable pipeline manifests instead of the replicated execution entities.
3. Pipeline and direct spawn callbacks can publish `spawned()` without awaiting durable lifecycle settlement.
4. The installed legacy coordinator still writes `.decision-os/codex-executions.json` and projects card execution intent until gates `J.6` through `J.8` move its callers.
5. Runtime pause policy can block unrelated admissions after one execution failure.

---

## E. Verification Evidence

1. **Documentation structure:** verified in commit `e39c73df`.
2. **Focused backend tests:** passed `30/30`.
   1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=backend/tsconfig.json node --test --import ./backend/node_modules/tsx/dist/esm/index.mjs backend/test/unit/task-state/task-current-state-core-v4.test.ts backend/test/unit/task-state/task-current-state-join.test.ts backend/test/unit/task-state/task-current-state-store.test.ts backend/test/unit/codex/helper/codex-execution-transition.test.ts`.
3. **Focused frontend tests:** passed `47/47`.
   1. Command: `node bin/decision-os-verify.mjs -- node --test frontend/test-responsive/optimistic-task-projection.test.mjs frontend/test-responsive/mobile-control-room.test.mjs`.
4. **Relay tests:** passed `8/8`.
   1. Command from `federation-relay/`: `node ../bin/decision-os-verify.mjs -- node_modules/.bin/vitest run`.
   2. Discarded command: invoking the relay Vitest binary from repository root selected every repository test and executed no relay test. The corrected working-directory command above passed.
5. **Backend typecheck:** passed.
   1. Command: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit`.
6. **Frontend typecheck:** passed.
   1. Command: `node bin/decision-os-verify.mjs -- npm --prefix frontend run typecheck`.
7. **Full repository suite:** not run.
8. **Offline migration fixture proof:** passed `11/11`.
   1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=backend/tsconfig.json node --test --import ./backend/node_modules/tsx/dist/esm/index.mjs backend/test/unit/task-state/task-current-state-migration.test.ts backend/test/unit/task-state/migrate-node-task-current-state.test.ts`.
   2. Evidence includes corrupt execution-state byte preservation, epoch-3 shard admission, deterministic assignment, all legacy execution sources, artifact objects, zero journals, complete backup, and legacy-authority retirement.
9. **Two-node convergence proof:** migration fixture passed.
   1. Independently migrated Workstation and Mobile fixtures join to one root, retain content ownership, deduplicate identical assignment and execution effects, and preserve real conflicts.
10. **Served browser proof:** not run.
11. **Restart durability proof:** not run.
12. **Relay typecheck:** passed.
    1. Command from `federation-relay/`: `node ../bin/decision-os-verify.mjs -- node_modules/.bin/tsc -p tsconfig.json --noEmit`.
13. **Dependent compatibility sample:** passed `26/33`; not a gate claim.
    1. Six failures are isolated-worktree child-process loader failures because the temporary fixture resolves `TSX_TSCONFIG_PATH` below its own root.
    2. One substantive failure is the expected open `J.4`/`J.8` gap: Control Room still reads card execution fields removed by epoch-4 migration.
14. **Assignment and reassignment tests:** passed.
    1. Assignment-specific project-state and federated-projection result: `4/4`.
    2. Master-task HTTP creation, required assignment, inherited-subtask rejection, reassignment, project-sync creation, runtime-incident creation, and federated Control Room result: `20/20`.
    3. Held Control Room assignment projection result: `1/1`.
    4. Backend typecheck passed after all assignment changes.
15. **Replicated execution repository:** passed `76/76`.
    1. Command from `backend/`: `node ../bin/decision-os-verify.mjs -- node --test --import tsx test/unit/task-state/task-current-state-core-v4.test.ts test/unit/task-state/task-current-state-join.test.ts test/unit/task-state/task-current-state-store.test.ts test/unit/federation/federation-task-state-replicator.test.ts test/unit/task-state/task-execution-repository.test.ts test/unit/server/helper/control-room-projection-store.test.ts test/unit/task-state/project-task-state.test.ts test/unit/task-state/task-current-state-migration.test.ts`.
    2. Evidence covers live federation, offline anti-entropy, deterministic joins, repository idempotency, all derived indexes, awaited transitions, conflicts, migration loading, Control Room projection, and bounded execution invalidation.
    3. Backend typecheck passed.
16. **Assignment-aware admission:** passed `20/20`.
    1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=<absolute-worktree-backend-tsconfig> node --test --import <tsx-loader> backend/test/unit/codex/task-execution-router.test.ts backend/test/unit/server/helper/create-http-server.test.ts`.
    2. Evidence covers master resolution, local relay-independent admission, authenticated remote boundary, exact retry receipts, offline peer rejection without requester state, explicit assignment conflict, contained failed validation, direct-run serialization, complete pipeline topology admission, non-task locality, server installation, and health during relay outage.
    3. Backend typecheck passed.

---

## F. Update Contract

1. Update this ledger in the same commit that changes a gate status.
2. Record the exact verification command and result before marking a gate `verified`.
3. Push each verified gate commit to `origin/feature/epoch4-task-execution`.
4. Keep failed commands and unresolved defects visible until superseded by passing evidence.
5. Do not mark production cutover complete from local tests.
6. Merge into `main` only after `J.1` through `J.13` are verified.
7. Mark `J.14` verified only from Workstation, Mobile, and relay production evidence.
