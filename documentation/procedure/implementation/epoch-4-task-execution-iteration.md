## A. Scope

1. This procedure executes `documentation/codex-task-assignment-and-replicated-execution-plan-2026-07-23.md`.
2. It owns local development through gate `J.13`.
3. `documentation/procedure/deployment/epoch-4-node-cutover.md` owns gate `J.14`.
4. The authoritative progress ledger is `documentation/working-documents/epoch-4-task-execution-iteration-status.md`.

---

## B. Worktree and Branch

1. Develop in:

   ```text
   /home/jbb/dev/EditorBP/decision-os/.worktrees/epoch4-task-execution
   ```

2. Use branch:

   ```text
   feature/epoch4-task-execution
   ```

3. Preserve the operator-owned dirty state in the primary checkout.
4. Commit only iteration source, tests, runbooks, and KB changes.

---

## C. Gate Execution

1. Implement gates in order from `J.1` through `J.12`.
2. Add change-specific tests with each gate.
3. Run the smallest relevant test through the repository verification lease:

   ```bash
   node bin/decision-os-verify.mjs -- <direct-test-command> <arguments>
   ```

4. Update the progress ledger with the exact passing command.
5. Commit the gate with `WHAT:` and `WHY:` paragraphs.
6. Push the branch after each verified gate.
7. Complete `J.13` only after focused tests, package typechecks, full suite, migration fixtures, failure injection, offline local execution, cross-node dispatch fixtures, and served interaction proof pass.

---

## D. Cross-Node Progress Publication

1. The implementation branch is the publication channel while production remains on `main`.
2. Push only committed gate evidence:

   ```bash
   GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' \
     git push origin feature/epoch4-task-execution
   ```

3. The other node reads progress through the commands in the status ledger.
4. Do not copy working-tree files between nodes.
5. Do not run epoch-4 code on the other node before local gate `J.13` passes.

---

## E. Verification Discipline

1. Run focused tests after the corresponding code stabilizes.
2. Run backend typecheck once after backend code stabilizes.
3. Run frontend typecheck once after frontend code stabilizes.
4. Run the full suite once after all focused tests pass.
5. Use no more than three-way test parallelism on Mobile.
6. Record failures in the status ledger when they invalidate a gate.
7. Source inspection, syntax checks, and source-pattern assertions do not prove served interaction behavior.

---

## F. Merge Admission

1. Require every `J.1` through `J.13` ledger row to be `verified`.
2. Require the implementation branch to contain no runtime data, local settings, credentials, caches, rollback directories, run artifacts, and unrelated ledger changes.
3. Require every implementation commit to contain `WHAT:` and `WHY:` paragraphs.
4. Merge the feature branch into the primary checkout with a merge commit.
5. Push `main`.
6. Remove the worktree and delete the merged feature branch.
7. Keep the production cutover gate open until the deployment runbook passes.
