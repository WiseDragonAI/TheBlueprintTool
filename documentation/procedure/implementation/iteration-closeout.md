# Iteration Closeout Procedure

## A. Purpose

1. This procedure governs the transition from an implemented Decision OS iteration to a reviewed Git merge, reconciled Task graph, reusable documentation, and separately admitted deployment.
2. It applies to iterations that change browser interactions, backend contracts, durable state, federation, background execution, node lifecycle, relay behavior, and deployment control.
3. The procedure prevents partial focused evidence from becoming a complete-iteration claim.

---

## B. Immutable Closeout Identity

1. Select one clean, pushed feature SHA as the closeout candidate.
2. Fetch `origin/main` and the feature ref immediately before closeout.
3. Record:
   1. candidate SHA
   2. predecessor `origin/main` SHA
   3. branch name
   4. worktree path
   5. repository root
   6. dirty-state result
   7. staged-state result
   8. active Git-operation result
4. Reject closeout on any of these conditions:
   1. dirty worktree
   2. unrelated index entries
   3. unpushed candidate
   4. predecessor not in the candidate ancestry
   5. candidate changed after evidence collection
5. Bind every test result, browser artifact, report, card update, and deployment input to the same candidate SHA.

---

## C. Specification And Task Gate

1. Read the master card, authoritative specification, task list, dependency graph, completeness audit, orchestration registry, implementation cards, test card, report card, and operator thread.
2. Build one requirement-to-evidence matrix with these columns:
   1. requirement ID
   2. owning task ID
   3. owning source symbols
   4. focused check
   5. complete-suite check
   6. served interaction
   7. runtime evidence
   8. deployment evidence
   9. status
3. Mark a requirement complete only when every evidence class required by its behavior has an exact artifact.
4. Reopen any card whose completion claim exceeds its evidence.
5. Keep the master card active until direct operator closeout authorization.

---

## D. Static Review Gate

1. Compare the complete candidate diff with the accepted specification and Task inventory.
2. Trace every changed workflow from entry point through validation, state transition, persistence, asynchronous work, network transport, settlement, diagnostics, and recovery.
3. Review these mandatory boundaries:
   1. request authentication and authorization
   2. durable state validation and invalid-byte preservation
   3. lock lifetime and mutation ownership
   4. asynchronous cancellation and deadline
   5. child-process identity and settlement
   6. federation requester, owner, and project identity
   7. optimistic UI reconciliation
   8. modal focus, close, and browser-history ownership
   9. responsive action reachability
   10. deployment admission, receipts, resume, and rollback
4. Record severity, file, symbol, first incorrect transition, impact, regression boundary, and one selected correction for every finding.
5. Block the verification gate while an in-scope critical and high finding remains open.

---

## E. Focused Verification Gate

1. Add a regression at the first incorrect boundary for every repaired finding.
2. Run the smallest relevant checks through the repository lease.
3. Use one direct command per lease:

   ```bash
   node bin/decision-os-verify.mjs -- <direct-command> [arguments]
   ```

4. Run changed-package typechecks after focused behavior stabilizes:

   ```bash
   node bin/decision-os-verify.mjs -- frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit
   node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit
   node bin/decision-os-verify.mjs -- federation-relay/node_modules/.bin/tsc -p federation-relay/tsconfig.json --noEmit
   node bin/decision-os-verify.mjs -- ledger-cli/node_modules/.bin/tsc -p ledger-cli/tsconfig.json --noEmit
   ```

5. Record the command, exit code, test count, failure count, skipped count, candidate SHA, and evidence file.
6. Do not substitute a source assertion for runtime behavior.

---

## F. Complete Verification Gate

1. Run each complete package suite once after focused checks pass:

   ```bash
   node bin/decision-os-verify.mjs -- npm test --prefix frontend
   node bin/decision-os-verify.mjs -- npm test --prefix backend
   node bin/decision-os-verify.mjs -- npm test --prefix federation-relay
   node bin/decision-os-verify.mjs -- npm test --prefix ledger-cli
   ```

2. Run launcher and CLI suites through the same lease with their direct Node commands.
3. Run the complete browser suite only after reading `BROWSER_RUNBOOK.md` and selecting the injected platform workflow.
4. Attribute every failure to:
   1. candidate regression
   2. pre-existing failure
   3. environment failure
   4. harness failure
5. A pre-existing, environment, and harness classification requires reproduced evidence on the predecessor SHA.
6. Block closeout until every candidate regression passes and every non-candidate failure has a durable evidence record accepted by the operator.

---

## G. Served Interaction Gate

1. Use the registered canary and its isolated relay. Do not launch a production-attached proof node.
2. Record the exact route, browser, viewport, input sequence, network result, DOM result, persisted result, and screenshot or trace.
3. For optimistic persistence, prove:
   1. the UI changes before the request settles
   2. a successful save survives reload
   3. a rejected save reconciles to server-confirmed state
4. For editor interactions, prove:
   1. keyboard focus enters and returns correctly
   2. dirty close blocks without discarding
   3. confirmed close disposes listeners and editor instances
   4. Back navigation performs one transition
   5. close during save and retry settles without stale continuation
   6. mobile actions remain visible and reachable
5. For history, prove:
   1. current draft selection
   2. older and newer navigation
   3. complete historical Markdown
   4. diff disposal after rapid selection
   5. red removal and blue addition semantics with non-color labels
6. Served interaction evidence is mandatory for every changed browser state machine.

---

## H. Failure And Recovery Gate

1. Inject failure at the first persistence, process, network, and async boundary changed by the iteration.
2. Prove the owning scope pauses without taking health, diagnostics, unrelated projects, and federation traffic offline.
3. Prove invalid durable bytes remain byte-identical.
4. Prove incident evidence includes scope, component, operation, code, message, timestamps, count, and task context.
5. Prove deadlines clear timers and listeners.
6. Prove cancellation reaches downstream fetches, streams, child processes, and queued work.
7. Prove explicit recovery re-reads and validates durable state before atomically installing recovered runtime state.
8. Prove restart adoption uses matching PID and start-time identity.

---

## I. Card Reconciliation Gate

1. Update Tasks only through project-scoped `PATCH /p/:projectId/decision-os/tasks` commands.
2. Never edit `.decision-os/tasks.json`, `.decision-os/task-state/**`, and task-state object files directly.
3. Update each implementation card with:
   1. implemented boundary
   2. exact candidate SHA
   3. focused evidence
   4. complete-suite evidence
   5. served evidence
   6. remaining limitation
4. Update the test card with the complete verification matrix.
5. Update the implementation report card with operator-readable outcomes and proof boundaries.
6. Put detailed analysis, specifications, inventories, audits, and reports in subtasks.
7. Keep the master body as the current executive summary only.
8. Append one truthful agent note to every materially updated card.
9. Verify canonical card content, positioned relationships, held-state absence, and relay convergence.
10. Do not mark the master `done` without direct operator authorization.

---

## J. Documentation Gate

1. Update current architecture for delivered source behavior.
2. Update required specs for accepted invariants.
3. Update operator procedures with exact commands, safety boundaries, recovery, and escalation.
4. Write a postmortem when the iteration had a contradicted success claim, unsafe transition, production impact, data-risk window, and substantial closeout failure.
5. A postmortem must identify:
   1. failed invariant
   2. first incorrect transition
   3. causal mechanism
   4. impact and data boundary
   5. detection gaps
   6. corrective actions
   7. prevention rules
   8. evidence index
6. Update every affected documentation index.
7. Validate relative links and stale command references.

---

## K. Commit And Merge Gate

1. Inspect the exact diff and staged subset.
2. Preserve unrelated dirty work and every protected staged hunk.
3. Commit the verified candidate with a concise subject and a body containing:

   ```text
   WHAT: <changed behavior, data contract, documentation, or operational boundary>

   WHY: <incident, invariant, operator decision, or verified need>
   ```

4. Verify the complete message:

   ```bash
   git show -s --format=%B HEAD
   ```

5. Push the candidate branch with the approved SSH identity.
6. Re-fetch and verify that the pushed candidate SHA is unchanged.
7. Merge into the primary checkout with a merge commit whose body states:
   1. exact candidate SHA
   2. exact predecessor SHA
   3. verification report path
   4. served evidence path
   5. deployment state
8. The merge message must say `not deployed` until the deployment gate produces terminal production evidence.
9. Push `main`, verify the remote ref, remove the isolated worktree, and delete the merged feature branch.

---

## L. Deployment Admission Gate

1. Treat deployment as a separate operator decision after Git integration.
2. Require every production target to report delivery protocol `1`, stable supervisor adoption, ready health, exact predecessor release, zero blocking workload, and converged owner state.
3. Require trusted candidate proof generated by the fixed candidate command.
4. Require request-bound coordinator authorization across relay transport.
5. Require a successful durable admission receipt for the exact release SHA before the first production mutation.
6. Execute the fixed production delivery command:

   ```bash
   node bin/decision-os-delivery.mjs promote --release-sha <candidate-sha> --json
   ```

7. Observe the journal with:

   ```bash
   node bin/decision-os-delivery.mjs status --delivery-id <delivery-id> --json
   ```

8. Accept deployment only when the terminal journal status is `complete` and final authority agrees across Git, relay, every node, catalog, federation, and convergence.
9. Keep `paused`, `partial`, `rolled-back-runtime`, and `compensation-failed` distinct from success.
10. Record the exact production evidence in the deployment card and implementation report.

---

## M. Stop Conditions

1. Stop before merge when an open Task gate contradicts the merge claim.
2. Stop before merge when the candidate SHA changed after evidence collection.
3. Stop before deployment when one node remains protocol `0`.
4. Stop before deployment when one supervisor adapter is missing.
5. Stop before deployment when proof provenance is not trusted.
6. Stop before deployment when remote requester authority cannot reach the owner.
7. Stop after a contradicted interaction claim and perform causal review before another implementation attempt.
8. Stop when a staged hunk conflicts with required work and request operator direction.

---

## N. Required Closeout Record

1. Every closeout report must include:
   1. repository root
   2. branch and worktree
   3. candidate SHA
   4. predecessor SHA
   5. requirement matrix path
   6. focused verification path
   7. complete verification path
   8. served evidence path
   9. card reconciliation result
   10. documentation paths
   11. merge commit
   12. pushed ref
   13. deployment state
   14. production evidence path
   15. remaining blockers
2. Report `integrated, not deployed` when only the Git gate is complete.
3. Report `deployed, production-proven` only after terminal delivery evidence and live authority agree.
