## A. Repository Intent

1. **Decision OS projects ledger cards into one Control Room read model.** Canonical JSON labels identify master tasks and subtasks, `subtask` relationships define task membership, card status defines durable lifecycle, and verified runtime observations define temporary execution state.
2. **Runtime ownership remains attached to the card that launched the work.** `codexActiveRunId` and `codexActiveExecutionId` identify the exact card execution lease; master-task status is a relationship-backed projection over that ownership.

---

## B. Current Iteration Intent

1. **Required behavior:** a master task belongs in Control Room `Exec` whenever its own card or one canonical linked subtask owns a queued, transcribing, or live Codex execution.
2. **Source contract:** `.decision-os/cards/tasks/card-f70126f4-8f8f-4d97-a0f9-34301119ca26.md` states that the active column contains master tasks with at least one subtask currently being processed.
3. **Operator reproduction:** `/home/jbb/dev/copywriting/rudy/.decision-os/article-35.json` links master `card-47834007-6af3-4ec1-b48a-af50ff9c420a` to subtask `card-9e57b1e7-0214-42ef-9379-6d6aefc5082b`. The subtask owns pending run `codex-skill-1784539116754-eff00604`, while the live Control Room projection places the master in `Queue` with `codexStatus: unknown`.

---

## C. Findings

1. **Gap — runtime aggregation stops at the master card.** `backend/src/business/server/helper/control-room-projection-store.ts` calls `runtimeStatus()` with only `input.card`, so it cannot observe execution fields stored on related subtasks.
2. **Drift — relationships drive progress but not execution.** The same projector reads canonical `subtask` relationships to build progress and validate labels after it has already classified runtime state from the master alone. `.decision-os/cards/tasks/card-b8f80843-13e8-4ef2-aa2c-95ab1931353e.md` and `.decision-os/cards/tasks/card-36a28cf8-80c9-4e88-a538-8b098ea93619.md` define relationships and live runtime as the authoritative projection inputs.
3. **Ownership must not be copied into durable master metadata.** Card-level execution leases are cleared and reconciled against the card that launched the run. Duplicating child lease fields onto the master would create two durable owners and make cancellation, continuation, and terminal cleanup ambiguous.
4. **Projection caches require invalidation.** The Control Room projector persists versioned slices. A behavior change without a projector-version bump can retain the old classification until another dependency changes.
5. **Federation can carry the derived owner without a new persistence model.** Existing federation transports `executionObservation`; adding the source `cardId` and owner kind to that observation preserves the selected relationship-backed owner across replicas.

---

## D. Remediation Paths

1. **Selected correction:** resolve the master plus its canonical relationship-backed subtasks, evaluate each card's existing verified runtime lease, select one deterministic active observation with priority `codex-process`, `voice-transcription`, then `codex-queue`, and project that observation onto the master task.
2. **Preserve exact ownership:** expose `executionOwnerCardId` and `executionOwnerKind` in the read model while leaving `codexActiveRunId` and `codexActiveExecutionId` only on the launching card.
3. **Invalidate persisted projections:** advance the projector version to `control-room-v12-subtask-execution-ownership`.
4. **Regression boundary:** verify a running subtask moves its master to `Exec`, a live process wins over another subtask's queue observation, and stale terminal child metadata does not keep the master in `Exec`.

---

## E. Operator Decision Summary

1. **No new durable runtime model is required.** Canonical relationships already define aggregation membership and card execution leases already define ownership.
2. **The structurally correct fix belongs in the server-owned Control Room projector.** It derives master status from child observations without mutating either card's lifecycle or replacing frontend behavior.
