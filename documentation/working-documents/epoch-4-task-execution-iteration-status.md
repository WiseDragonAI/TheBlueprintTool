## A. Iteration Identity

1. **Objective:** execute `documentation/codex-task-assignment-and-replicated-execution-plan-2026-07-23.md` through local implementation, automated verification, served proof, runbooks, migration readiness, and production-readiness evidence.
2. **Implementation branch:** `feature/epoch4-task-execution`.
3. **Base commit:** `0c72b4ed95c12bcfb0a27ddcbf56f4ecfdba5df7`.
4. **Production branch:** `main`.
5. **Current phase:** `J.3 — Persist task assignment`.
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
3. **J.3 — Persist task assignment:** `pending`.
4. **J.4 — Install the replicated execution repository:** `pending`.
5. **J.5 — Install assignment-aware admission:** `pending`.
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

1. Task creation passes the selected node as `replicaNodeId` and optimistic `ownerNodeId`; no assignment lane is persisted.
2. The current task-state write predicate requires relay-root convergence.
3. Direct execution admission writes `.decision-os/codex-executions.json` before the scheduler-visible legacy queue.
4. The scheduler reads `.decision-os/codex-process-queue.json` and mutable pipeline manifests instead of the replicated execution entities.
5. Pipeline and direct spawn callbacks can publish `spawned()` without awaiting durable lifecycle settlement.
6. Control Room still derives active placement from legacy card execution fields; a migrated epoch-4 fixture therefore cannot expose runtime-only active state until gates `J.4` and `J.8`.
7. Control Room task identity contains projection-source ownership.
8. Runtime pause policy can block unrelated admissions after one execution failure.

---

## E. Verification Evidence

1. **Documentation structure:** verified in commit `e39c73df`.
2. **Focused backend tests:** passed `30/30`.
   1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=backend/tsconfig.json node --test --import ./backend/node_modules/tsx/dist/esm/index.mjs backend/test/unit/task-state/task-current-state-core-v4.test.ts backend/test/unit/task-state/task-current-state-join.test.ts backend/test/unit/task-state/task-current-state-store.test.ts backend/test/unit/codex/helper/codex-execution-transition.test.ts`.
3. **Focused frontend tests:** not run.
4. **Relay tests:** passed `8/8`.
   1. Command from `federation-relay/`: `node ../bin/decision-os-verify.mjs -- node_modules/.bin/vitest run`.
   2. Discarded command: invoking the relay Vitest binary from repository root selected every repository test and executed no relay test. The corrected working-directory command above passed.
5. **Backend typecheck:** passed.
   1. Command: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit`.
6. **Frontend typecheck:** not run.
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

---

## F. Update Contract

1. Update this ledger in the same commit that changes a gate status.
2. Record the exact verification command and result before marking a gate `verified`.
3. Push each verified gate commit to `origin/feature/epoch4-task-execution`.
4. Keep failed commands and unresolved defects visible until superseded by passing evidence.
5. Do not mark production cutover complete from local tests.
6. Merge into `main` only after `J.1` through `J.13` are verified.
7. Mark `J.14` verified only from Workstation, Mobile, and relay production evidence.
