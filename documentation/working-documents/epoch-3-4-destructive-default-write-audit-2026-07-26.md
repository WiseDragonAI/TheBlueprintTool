## A. Repository Intent

1. Epoch 3 and Epoch 4 make the projected content head authoritative when a card or thread Markdown sidecar is absent on one node.
2. A missing mutable file means **not materialized locally**. It does not mean empty content.
3. A mutation must resolve and verify the active immutable object before it can create watcher-visible mutable bytes.

---

## B. Current Iteration Intent

1. Audit write paths added or retained through the Epoch 3 and Epoch 4 cutovers for the destructive conversion:

   `authoritative content exists` → `local sidecar missing` → `empty/default state` → `new content head`

2. Cover card Markdown, thread messages, voice-note lifecycle updates, queued execution, run-event persistence, images, pipelines, settings, migration, and recovery stores.

---

## C. Confirmed Findings

1. **Critical — every local note mutation can replace a non-materialized thread.**

   `applyLedgerMutation()` hydrates only the mutable sidecar at `backend/src/business/ledger/helper/apply-ledger-mutation.ts:115-127`. `append-note`, `update-note`, `delete-note`, and `restore-note` then default missing notes to `[]` and write that derived array at `:395-485`. The new file is watcher-visible and becomes a new authoritative content contribution.

2. **Critical — voice-note persistence inherits the same destructive path.**

   `applyNotePatch()` hydrates the mutable sidecar, then sends `update-note` through task mutation persistence at `backend/src/business/transcription/controller/start-voice-upload-orchestration-controller.ts:108-144`. If the active thread exists only as an Epoch 4 object, the update creates a thread containing only the voice-note state being patched. This applies to pending upload state, transcription progress, final transcription, error state, and queued-run metadata because they share the same note mutation.

3. **Critical — Codex launch can publish empty card Markdown as well as the one-byte thread.**

   `start-thread-codex-process-controller.ts:169-179` materializes both files before prompt validation. `externalizeCardContent()` creates `''` when card Markdown is absent at `card-content-file.ts:151-168`. `threadContentFile()` writes `[]` as `"\n"` at `start-thread-codex-process-controller.ts:93-98`. A launch attempt can therefore supersede both active heads before validation fails.

4. **High — legacy skill-run event persistence has the same thread replacement fallback.**

   For a run without recognized card ownership, `persistCardSkillRunEvents()` hydrates only the sidecar, defaults to `[]`, appends synthetic events, and writes the result at `backend/src/business/codex/effect/persist-card-skill-run-events.ts:43-112`. Recognized card-owned runs return before this path. The remaining fallback can replace a non-materialized thread with run-event notes.

5. **High — card writes are not atomic.**

   `writeCardDescriptionFile()` writes directly to the watched target with `writeFileSync()` at `backend/src/business/ledger/helper/card-content-file.ts:57-66`. Thread writes use a temporary file plus rename. A process interruption during a card write can leave truncated mutable bytes that the watcher may capture as the next content head.

6. **Architectural smell — reads and remote mutations are safe while local mutations and execution bypass the safe boundary.**

   HTTP card/thread reads call `readTaskContentOnDemand()` at `backend/src/business/server/helper/create-http-server.ts:2706-2725`. Remote task note mutation also obtains and atomically installs missing content before mutation at `:2043-2085`. Local execution, local note mutation, voice persistence, and legacy run-event persistence do not use that boundary.

7. **Test gap — the mutation matrix does not cover an active immutable head with a missing mutable sidecar.**

   Existing tests cover migration retention, remote on-demand content, restore-note sidecar adoption, and missing task identities. They do not exercise missing card/thread sidecars with active heads across append, update, delete, restore, voice lifecycle, Codex start, and legacy run-event persistence.

8. **High — the demanded relay-response acceptance gate was reduced to event deduplication.**

   The local-first master task required events to be revision-aware invalidations and required already-installed revisions to be ignored. Commit `33060294` implemented that narrow event rule in `acceptLedgerInvalidationRevision()`. The function checks only a ledger revision number and accepts every event without a valid positive revision. It does not inspect local pending state, domain lifecycle, the local mutation receipt, the installed content head, or causal acknowledgement of the local intent.

   The gate runs before a refetch in `frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:108-154`. The actual projection installation in `reconcileActiveLedgerState()` rejects only older server revisions and older request sequences. Once the frontend transaction coordinator considers a local request settled, a later numerically newer relay-derived projection remains eligible even when it does not acknowledge the locally committed intent.

   Voice reconciliation has a separate status helper, but `shouldApplyVoiceServerNote()` accepts every higher incoming revision before comparing status ranks at `frontend/src/runtime/voice/helper/voice-transcription-lifecycle.ts:62-69`. A `transcribing` response at revision `5` therefore replaces a local `transcribed` note at revision `4`. The existing regression proves only that revision `2` cannot replace revision `4`.

   Execution invalidation frames carry `phase` and `revision`, but `bind-thread-codex-run-log.ts:156-169` ignores both and refetches on every matching event. There is no shared status-aware acceptance boundary for messages, images, queued executions, pipeline executions, and content-head installation.

---

## D. Audited Paths Without This Defect

1. **Pipeline and process settings stores fail closed on invalid durable JSON.** Their write boundaries validate existing content before replacement.
2. **Epoch 4 remote note mutation fails closed** when the content head is missing, conflicting, or unavailable.
3. **HTTP card/thread reads preserve the projected head** and report synchronizing/conflict state without publishing empty content.
4. **Image deletion does not rewrite Markdown** when the requested image reference is absent.
5. **Execution artifact readers that return empty collections are presentation reads.** The inspected paths do not publish those defaults as task content heads.

---

## E. Remediation Path

1. Add one shared asynchronous `materializeTaskResourceForMutation` boundary for card Markdown and thread Markdown.
2. Require a unique projected content head.
3. Read the immutable object locally, then demand it through federation when absent.
4. Verify the object hash and byte count.
5. Atomically install the exact bytes without creating a new contribution.
6. Return `503` without writing when the object is unavailable. Return `409` without writing when the head is conflicting.
7. Route local note mutations, voice updates, Codex launch, card editing, and legacy run-event persistence through this boundary.
8. Validate execution input before every watcher-visible mutation.
9. Convert card Markdown writes to temporary-file-plus-rename.
10. Add one parameterized regression matrix proving:
    1. no write occurs on unavailable/conflicting content;
    2. existing bytes survive materialization;
    3. the intended mutation preserves unrelated content;
    4. the watcher publishes only the post-mutation head;
    5. a rejected Codex launch publishes no head.
11. Add one projection-install acceptance gate keyed by entity identity and local mutation receipt.
12. Keep locally committed intent installed until an incoming projection causally acknowledges that receipt.
13. Accept only declared forward lifecycle transitions. Keep terminal voice and execution states terminal; an explicit retry creates a new lifecycle revision.
14. Permit rejected-mutation reconciliation to remove local optimistic intent only from the response to that exact mutation receipt.
15. Apply the same gate to event-triggered reads, polling responses, direct mutation responses, and federation refreshes.
16. Add delayed-relay regressions where numerically newer but causally stale `message`, `voice`, `queued execution`, `pipeline`, and content-head projections cannot replace local state.

---

## F. Operator Decision Summary

1. **The one-byte Codex incident is one manifestation of a shared missing-materialization defect.**
2. **The highest-yield correction is the shared pre-mutation materialization boundary.** Fixing only Codex launch leaves messages, voice lifecycle persistence, card Markdown, and legacy run events exposed.
3. Asset synchronization optimization remains a separate master task because asset availability policy and payload replication differ from text-content safety.
4. **The demanded ignore gate is only partially implemented.** Event revision deduplication exists; status-aware, receipt-aware projection installation does not.
