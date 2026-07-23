## A. Iteration Identity

1. **Objective:** execute `documentation/codex-task-assignment-and-replicated-execution-plan-2026-07-23.md` through local implementation, automated verification, served proof, runbooks, migration readiness, and production-readiness evidence.
2. **Implementation branch:** `feature/epoch4-task-execution`.
3. **Base commit:** `0c72b4ed95c12bcfb0a27ddcbf56f4ecfdba5df7`.
4. **Production branch:** `main`.
5. **Current phase:** `J.1 — Freeze epoch-4 contracts`.
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

1. **J.1 — Freeze epoch-4 contracts:** `in-progress`.
   1. Required evidence: shared assignment and execution schemas, phase transition rules, CRDT merge behavior, relay protocol admission, and focused tests.
   2. Current evidence: repository inventory completed from base commit `0c72b4ed`.
2. **J.2 — Build the offline migrator:** `pending`.
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

1. The shared task-state constants remain protocol, schema, and baseline epoch `3`.
2. `taskEntityTypes` contains no `execution` entity.
3. Task creation passes the selected node as `replicaNodeId` and optimistic `ownerNodeId`; no assignment lane is persisted.
4. The current task-state write predicate requires relay-root convergence.
5. Direct execution admission writes `.decision-os/codex-executions.json` before the scheduler-visible legacy queue.
6. The scheduler reads `.decision-os/codex-process-queue.json` and mutable pipeline manifests instead of the canonical execution store.
7. Pipeline and direct spawn callbacks can publish `spawned()` without awaiting durable lifecycle settlement.
8. Control Room task identity contains projection-source ownership.
9. Runtime pause policy can block unrelated admissions after one execution failure.

---

## E. Verification Evidence

1. **Documentation structure:** pending first implementation commit.
2. **Focused backend tests:** not run.
3. **Focused frontend tests:** not run.
4. **Relay tests:** not run.
5. **Backend typecheck:** not run.
6. **Frontend typecheck:** not run.
7. **Full repository suite:** not run.
8. **Offline migration fixture proof:** not run.
9. **Two-node convergence proof:** not run.
10. **Served browser proof:** not run.
11. **Restart durability proof:** not run.

---

## F. Update Contract

1. Update this ledger in the same commit that changes a gate status.
2. Record the exact verification command and result before marking a gate `verified`.
3. Push each verified gate commit to `origin/feature/epoch4-task-execution`.
4. Keep failed commands and unresolved defects visible until superseded by passing evidence.
5. Do not mark production cutover complete from local tests.
6. Merge into `main` only after `J.1` through `J.13` are verified.
7. Mark `J.14` verified only from Workstation, Mobile, and relay production evidence.
