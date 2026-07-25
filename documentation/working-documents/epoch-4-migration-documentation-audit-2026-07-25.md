# Epoch-4 Migration Documentation Audit

## A. Repository Intent

1. **Decision OS stores task structure, assignment, execution, conversation, and content reachability as convergent project state.**
2. The knowledge base must distinguish current architecture, required behavior, repeatable procedure, incident history, and active verification status.
3. Operator-facing documentation must preserve exact migration safety boundaries and must not turn incomplete Mobile evidence into a completed cross-node claim.

---

## B. Current Iteration Intent

1. Reconcile the Epoch-4 implementation chain from `dba5d483` through merge `3fc1b01f`.
2. Incorporate the operator decisions made during the Workstation migration and the two post-cutover task-thread incidents.
3. Promote stable implementation behavior into canonical architecture and postmortem roles.
4. Correct procedure and progress-ledger statements superseded by the successful Workstation cutover and subsequent repairs.

---

## C. Findings

1. **Gap — no canonical Epoch-4 architecture existed.**
   1. `documentation/documentation/architecture/` documented only Epoch 3.
   2. Assignment, execution, thread-note, artifact, and migration behavior remained distributed across plans, gate ledgers, code, and commits.
2. **Drift — the progress ledger still described Workstation as epoch 3.**
   1. The Workstation transaction completed on `2026-07-24`.
   2. All seven registered projects now use epoch `4`.
3. **Drift — migration admission required generic zero missing content.**
   1. Commit `72761c29` explicitly retains unavailable remote-owned heads as `deferredRemoteObjects`.
   2. Locally owned missing content still blocks admission.
4. **Omission — post-cutover thread consistency repairs had no durable documentation owner.**
   1. Commit `e9f1e61a` repaired scoped note derivation, artifact settlement ordering, and false interruption projection.
   2. Commit `0d4a0338` repaired explicit restoration, note/content-head atomicity, prompt filtering, and authoritative task ownership.
5. **Omission — the operator decisions were not consolidated.**
   1. Workstation-first proof, no extra migrations, no media copying, original-identity note restoration, Markdown consistency, and separation of conversation from execution evidence were only recoverable from the incident sequence.
6. **Gap — the root README still called the task command workflow Epoch 3.**
   1. The linked task-creation procedure already targets an epoch-4 project and retires `.decision-os/tasks.json`.
7. **Omission — accidental note restoration had no recovery procedure.**
   1. `restore-note` requires the exact thread and note identity, reuses existing sidecar content, and returns `note_content_required` when absent content is not supplied.
   2. Operator deletion intent must be verified before resurrection.
8. **Drift — historical architecture analyses read as current behavior.**
   1. The pre-Epoch-4 Codex audit still described `codex-executions.json`, startup migration, and observation-derived interruption.
   2. The task-state-v2 RCA remained accurate incident history but did not identify its current canonical successor.

---

## D. Remediation Paths

1. **Canonical architecture:** Add `documentation/documentation/architecture/epoch-4-task-assignment-execution-and-content.md` and link it from the architecture and KB indexes.
2. **Canonical incident history:** Add `documentation/postmortem/epoch-4-workstation-cutover-2026-07-24.md` and link it from the postmortem index.
3. **Procedure correction:** Distinguish missing local content from audited deferred remote content in the epoch-4 cutover admission criteria.
4. **Status correction:** Record Workstation epoch `4` as verified, retain Mobile and relay gates as open, and add the post-cutover consistency repairs to the authoritative progress ledger.
5. **Entry-point correction:** Update the root task-publication description to Epoch 4 and link the canonical architecture.
6. **Recovery procedure:** Add the exact evidence gate, scoped command, and verification sequence for restoring an accidentally tombstoned note.
7. **Historical labeling:** Mark the Epoch-3 architecture, pre-Epoch-4 Codex audit, implementation plan, and task-state-v2 RCA as historical inputs with links to their current owner.

---

## E. Operator Decision Summary

1. **Workstation is migrated and repaired; the complete cross-node Epoch-4 gate remains open.**
2. Local media remains referenced in place; remote cache duplication remains documented technical debt.
3. Thread Markdown and causal note state now have an explicit shared persistence contract.
4. The next migration action belongs to Mobile only after its read-only preflight and the remaining cutover admission evidence pass.
