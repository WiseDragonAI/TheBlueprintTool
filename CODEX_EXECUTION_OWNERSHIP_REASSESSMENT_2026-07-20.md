## A. Repository Intent

1. **Decision OS owns durable work coordination:** cards, threads, Codex sessions, queue entries, process runtime, artifacts, and operator projections must expose one coherent lifecycle.
2. **Codex execution authority is exact:** a pending or running execution is identified by the tuple `projectId`, `ledgerId`, `cardId`, `runId`, and `executionId`.

---

## B. Current Iteration Intent

1. **Preserve the repair merged by `1f392110`:** retained sessions, exact execution leases, per-run artifact ownership, cache revalidation, stale-response fencing, and active/history separation remain canonical.
2. **Close remaining production gaps:** responsive cancellation must send the active execution, competing launch kinds must serialize admission, cancellation must settle consistently, and every live child must use process-tree termination.
3. **Reduce lifecycle drift:** centralize runtime-run mutation plus child launch, stream ingestion, markers, and settlement ordering used by thread start, continuation, and pipeline execution.
4. **Preserve the verified regression history:** `5ec7fa5a` added persisted execution hydration, `6afa3ac1` removed persisted UI authority, `984c4a1e` introduced execution-segment history on a retained run, and `1f392110` restored safe runtime revalidation without letting card metadata paint live state directly.

---

## C. Findings

1. **Responsive cancellation is rejected before the request:** `frontend/src/app/responsive/thread.js` calls `stopThreadCodexRunController` without `executionId`; the controller requires it and returns `false` without issuing `fetch`.
2. **Admission is not serialized across launch kinds:** continuation yields during status hydration before it writes the card lease, while thread and pipeline launch paths can admit against the same card.
3. **Pending cancellation is not fully settled:** the queue item and card lease are cleared, but the runtime entry lacks `settledAt` and no `codex-run-settled` event is published. Immediate session deletion can wait until timeout.
4. **Process termination differs by ownership path:** adopted runs signal the Unix process group, while in-memory thread and pipeline runs call `child.kill`, which can leave descendants alive.
5. **Execution engines still drift:** thread start, continuation, and pipeline execution separately implement child spawn, stream creation, event ingestion, markers, runtime attachment, and one-shot settlement.
6. **Runtime mutation still drifts:** three modules duplicate runtime lookup, exact-execution updates, child attachment, public projection, notification, and stream-finalization helpers.
7. **Durable schema enforcement is incomplete:** core card fields are typed as independent optionals, queue payload and runtime entries remain untyped records, and request paths do not reject a lone active run or execution identifier.
8. **Task-ledger persistence lost runtime context in settlement paths:** `clearCardCodexExecution` and new-thread-file persistence can bypass the server-owned task projection authority because they do not carry `ledgerId`, `decisionOsRoot`, and `runtime` through the write boundary.
9. **Generated pipeline-card continuation repeated two direct-widget defects:** an accepted queued continuation was painted as running, and Stop reused the pipeline skill's prior execution ID instead of the newly accepted continuation execution.
10. **Served interaction proof remains absent:** no authoritative platform value was provided for the mandatory Chromium runbook, so this iteration cannot make a target-browser interaction claim.

---

## D. Remediation Paths

1. **Responsive action fencing:** pass `data-codex-execution-id` into the shared stop controller and add a mobile routing regression that asserts the complete identity.
2. **Card admission lock:** serialize thread, continuation, direct, and pipeline admission by `decisionOsRoot + ledgerId + cardId`; queue dispatch reuses the admitted lease without re-locking.
3. **Exact terminal transition:** give pending cancellation `finishedAt`, `settledAt`, exact lease clearing, and the same settled event used by running execution.
4. **Process-tree helper:** route in-memory and adopted cancellation through one cross-platform termination function; launch Unix children as detached process groups.
5. **Execution process kernel:** centralize child launch, streams, ingestion, markers, turn publication, one-shot error/close handling, and stream-before-settlement ordering while leaving prompt and pipeline sequencing at their application boundaries.
6. **Runtime store:** centralize exact runtime updates, child attachment, status lookup, safe public projection, and notifications.
7. **Typed ownership contract:** introduce shared execution lease, queue payload, runtime run, lifecycle event, and ownership-state types; validate contradictory active fields at admission.
8. **Authoritative persistence context:** carry task projection identity and runtime through event ingestion and exact lease clearing.
9. **Pipeline-card continuation fencing:** retain the accepted continuation execution ID in its poller, preserve pending status, and send that exact identity through cancellation.
10. **Proof:** add cross-kind concurrency, responsive cancellation, pending-cancel deletion, descendant termination, contradictory ownership, pipeline adoption, pipeline-card continuation, and lifecycle-kernel tests; then run focused tests, package typechecks, and full backend/frontend suites through the verification lease.

---

## E. Operator Decision Summary

1. **The `1f392110` repair remains present and materially corrected the reported cache and ownership defects.**
2. **The remaining defects are executable engineering gaps, not unresolved product choices.** This iteration applies the single contract above without changing the existing Codex Log structure or styling.

---

## F. Implemented Ownership Contract

1. **Durable session:** `codexThreadRunId`, `codexThreadRunIds`, and per-run output references remain intact when direct and pipeline executions project onto the same card.
2. **Active execution:** admission writes `codexActiveRunId` and `codexActiveExecutionId` together; contradictory half-leases are rejected; exact settlement clears only the matching tuple.
3. **Serialized admission:** thread start, continuation, direct skill, and pipeline starts share one card-scoped admission lock and return an existing pending or running execution idempotently.
4. **Scheduling and recovery:** queue payloads carry `executionId`; recovery requires the card's exact lease; pipeline manifests retain PID plus process-start identity and adopt a surviving process after restart.
5. **Runtime ownership:** one runtime store owns exact-execution mutation, child attachment, public projection, status lookup, and lifecycle notifications.
6. **Process lifecycle:** thread start, continuation, and pipeline skills use one launch kernel for spawn, logs, JSONL ingestion, segment markers, turn events, stream flushing, and one-shot settlement. Metadata-persistence failure kills the new process group before returning.
7. **Cancellation:** desktop, responsive, generated pipeline-card, direct queue, live runtime, adopted process, and pipeline cancellation all carry exact execution identity. Pending cancellation writes terminal timestamps, clears the lease, and publishes settlement.
8. **Process termination:** in-memory and adopted Unix executions signal the complete detached process group, including descendants; Windows retains direct-child fallback behavior.
9. **Frontend authority:** terminal caches are scoped by project, replica, ledger, card, and run. An active card lease only forces runtime revalidation; it never paints active status. Stale poll generations cannot overwrite a newer execution.
10. **Presentation:** the active execution selects the current run, the Codex Log header reflects the separate active consumer regardless of historical selection, pending work exposes `CANCEL`, running work exposes `STOP`, and closed desktop panels release their consumers.
11. **Server events:** accepted, started, and settled lifecycle events carry run, execution, and status identity. SSE subscriptions capture project and replica scope, replace themselves on scope change, and ignore callbacks from an obsolete subscription.
12. **Artifact ownership:** deletion and promotion resolve the persisted per-run artifact reference; legacy directory discovery is indexed once per reconciliation instead of rescanning for every run.

---

## G. Verification Evidence

1. **Focused frontend lifecycle:** `43/43` passed, including terminal-cache revalidation, stale-response fencing, responsive stop routing, closed-panel cleanup, SSE scope replacement, and generated pipeline-card pending cancellation.
2. **Focused backend lifecycle:** `19/19` passed, including idempotent admission, exact stale cancellation, pending deletion, contradictory leases, pipeline PID adoption, process-tree termination, and spawn-persistence failure cleanup.
3. **Type safety:** frontend and backend TypeScript checks passed through `bin/decision-os-verify.mjs`.
4. **Complete frontend suite:** all `488` tests passed through the repository verification lease.
5. **Complete backend suite:** the complete suite passed serially through the repository verification lease. Its only default-parallel failure was the unrelated voice-orchestration file timing out under aggregate load; that file passed `7/7` in isolation before the serial full-suite pass.
6. **Static hygiene:** `git diff --check` passed.
7. **Interaction claim:** **implemented; automated checks pass; target-browser interaction not yet verified** because the mandatory platform value for Chromium was not injected. The master task must remain active until that operator-facing route is exercised.
