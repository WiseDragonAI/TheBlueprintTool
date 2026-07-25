# Epoch-4 Workstation Cutover and Thread Consistency Postmortem

## A. Incident Summary

1. **Objective:** Install replicated task assignment and execution state on Workstation, preserve the seven-project catalog, avoid copying unrelated binary payloads, and prove the workstation path before changing Mobile.
2. **Initial failure:** The first migration path mutated projects serially, could leave a mixed catalog after interruption, and recursively copied GiB of audio, images, caches, runs, settings, and prior rollback data.
3. **Activation failure:** Epoch-4 code ran against epoch-3 durable state, so a new execution became durable but could not start while a legacy card `executionIntent` remained authoritative.
4. **Post-cutover failures:** Scoped thread persistence tombstoned an unrelated operator note, terminal polling could observe an empty log window, active durable execution was displayed as `interrupted`, and stale task ownership allowed synthetic Codex events into the conversation Markdown.
5. **Recovered state:** Workstation completed one verified seven-project epoch-4 transaction. The affected note was restored with its original identity, the legitimate direct agent reply remains live, the thread Markdown and its resource head match, and all seven projects contain zero note tombstones.
6. **Open gate:** Mobile migration, epoch-4 relay deployment, three-party convergence, and cross-node execution evidence remain incomplete.

---

## B. Operator Decisions Preserved

1. **Prove Workstation first.** Mobile does not enter the migration window until the local epoch-4 path is safe and independently verified.
2. **Do not launch extra migrations.** Existing background migration attempts were stopped; no new migration was admitted until the transaction boundary was replaced.
3. **Do not migrate media payloads.** Local audio and images stay at their existing paths and are represented by verified content heads.
4. **Preserve non-operator-deleted notes.** A tombstone produced by system corruption must be causally removed from the original note identity.
5. **Keep Markdown consistent.** The thread sidecar is agent-readable durable content and must change with the authoritative note projection.
6. **Separate conversation from execution evidence.** Synthetic events belong in immutable run artifacts, not in operator-agent thread Markdown.

---

## C. Implementation and Cutover Timeline

1. **`dba5d483` through `89d4d41b`:** Epoch-4 contracts, offline conversion, assignment, execution repository, admission, scheduling, control, recovery, and legacy-authority removal were implemented.
2. **`e3f30293`:** Failure-containment and convergence regressions exposed and corrected first-boundary defects.
3. **`a3638b9a`:** Execution artifact collection gained an explicit converged-root and retention-cutoff boundary.
4. **`c90562c3`:** The destructive project loop was replaced by one node-scoped staged transaction with exact archives, shadow validation, rollback, interruption recovery, and in-place local media references.
5. **`d144d144`:** The recoverable migrator and epoch-4 runtime were merged to `main`.
6. **`db7f9fe6`:** The live execution-intent conflict was recorded as proof that the catalog still required the manual offline migration.
7. **`242a909e`:** Retained remote objects became resolvable from the verified node federation cache.
8. **`72761c29`:** Unavailable remote-owned objects became audited on-demand references instead of migration blockers.
9. **`d51a9395`:** The successful seven-project Workstation migration and restart were recorded.
10. **`e9f1e61a`:** Thread-note derivation, artifact settlement ordering, and active lifecycle projection were repaired.
11. **`0d4a0338`:** Exact note restoration, note-resource atomicity, prompt tombstone filtering, and epoch-4 task-run ownership were repaired.
12. **`3fc1b01f`:** The complete thread consistency repair was merged and pushed to `origin/main`.

---

## D. Failure One — The Migration Boundary Included Unrelated GiB

1. **Failed invariant:** Schema migration work must be proportional to the files it mutates.
2. **First incorrect transition:** The old node controller recursively copied the master `.decision-os` tree and each project `.decision-os` tree before late per-project validation.
3. **Amplification:** Voice uploads, images, historical runs, caches, settings, and prior rollback directories entered the backup even though the migrator did not mutate them.
4. **Observed result:** Interrupted backup directories reached GiB scale and the catalog could be left with some projects at epoch `4` and the remainder at epoch `3`.
5. **Repair:** The replacement transaction prepares every project first, archives only the exact mutation manifest, builds complete shadows, journals every swap, and independently verifies the result.
6. **Regression boundary:** Multi-MiB audio and image fixtures prove their bytes enter neither rollback storage nor epoch-4 project object storage.

---

## E. Failure Two — Binary References Were Confused with Binary Migration

1. **Failed invariant:** A content-addressed state migration needs the verified head, not a second copy of every local payload.
2. **Existing evidence:** Resource heads already carry `key`, `hash`, `bytes`, `changedAt`, and `sourceReplicaId`.
3. **Repair:** Workstation-owned audio, images, and managed assets remain at their workspace paths. Migration verifies those bytes and records the heads.
4. **Remote behavior:** Verified remote cache objects can be installed by exact hash. Missing remote-owned bytes remain in `deferredRemoteObjects` and resolve lazily from their owner.
5. **Remaining debt:** The successful Workstation cutover duplicated `199` phone-owned managed assets totaling `389,746,672` bytes from the federation cache into project epoch-4 storage. This does not block runtime correctness, but the duplicate materialization remains open.

---

## F. Failure Three — Epoch-4 Code Started Before Epoch-4 State

1. **Failed invariant:** Runtime authority and durable state epoch must change together.
2. **First incorrect transition:** The server loaded new execution code while cards still contained epoch-3 `executionIntent`.
3. **Observed behavior:** Execution `codex-execution-1784858311933-3bfdb13a` was durable but remained pending because the old intent conflicted with the new authority.
4. **Repair:** The operator authorized one catalog-wide offline migration and registered-server restart. Migration retired legacy authority and retained old incomplete attempts as terminal `interrupted` evidence.
5. **Durable rule:** Migration does not replay a stale Run request. The operator submits a fresh request after verified activation.

---

## G. Failure Four — One Scoped Write Owned the Whole Thread

1. **Failed invariant:** A note contribution must change only its declared note identity and the resulting thread content head.
2. **First incorrect transition:** Task projection persistence stripped hydrated task notes before deriving entity changes, then a thread-scoped command compared the complete thread.
3. **Observed behavior:** The first Codex event could interpret an unrelated surviving operator note as absent and emit its tombstone.
4. **Repair:** Task-ledger projection remains hydrated for command derivation, and note commands now carry exact `threadNoteIds`.
5. **Recovery:** Note `note-1784791403013-05c625b03abe1` was restored through `restore-note` with its original identity and body `test`.
6. **Prevention rule:** Aggregate or thread-level omission is never note-deletion authority. Deletion and restoration require an exact note ID.

---

## H. Failure Five — Markdown and Causal State Could Diverge

1. **Failed invariant:** The agent-readable Markdown and the authoritative note/resource projection must settle together.
2. **Observed behavior:** A note could remain in the Markdown while its epoch-4 entity was tombstoned. The inverse could also leave a live note without the current Markdown content head.
3. **Repair:** Every note mutation captures the rewritten Markdown and persists its resource head in the same epoch-4 batch as the note entity.
4. **Write safety:** Markdown replacement uses a temporary file and rename.
5. **Prompt safety:** Tombstoned note IDs are excluded when building the agent prompt even when stale sidecar content exists.
6. **Recovery proof:** The repaired thread Markdown contains exactly the restored operator note and the legitimate direct agent reply. Its live content-manifest hash matches the current file.

---

## I. Failure Six — Execution Evidence Polluted Conversation State

1. **Failed invariant:** Lifecycle telemetry is not operator-agent conversation.
2. **First incorrect transition:** Skill-run event persistence read stale task ownership from `tasks.json` and admitted synthetic Codex event notes into the task thread.
3. **Impact:** Thirty synthetic events expanded one thread Markdown to `314,201` bytes, including nested copies of command output.
4. **Repair:** Task ownership reads the authoritative epoch-4 projection. Lifecycle artifacts remain in the immutable Codex JSONL.
5. **Data repair:** The thirty synthetic notes were removed from conversation Markdown without deleting the `311,575`-byte run JSONL or its terminal `turn.completed` evidence.
6. **Result:** The repaired Markdown is `399` bytes and contains exactly two legitimate notes.

---

## J. Failure Seven — Settlement and Projection Created False Empty or Interrupted States

1. **Terminal log gap:** The process registry entry was removed before immutable artifact capture, so terminal polling could temporarily have neither a live file path nor an artifact head.
2. **Repair:** Settlement retains process paths through terminal lifecycle persistence and artifact finalization, then removes the process entry.
3. **False interruption:** Federated Control Room projection replaced durable `starting` and `running` with `interrupted` whenever a transient process observation was absent.
4. **Repair:** Durable execution lifecycle remains the visible phase. Restart recovery owns the explicit transition to `interrupted` after process identity verification fails.

---

## K. Verification and Current Boundary

1. **Migration transaction:** `ab0ab732-64d8-464b-b0e7-d2f1266681c4` and its independent verifier returned `verified`.
2. **Catalog:** All seven Workstation projects report protocol, schema, and baseline epoch `4`, with `missingObjects: 0` and `journalCount: 0`.
3. **Thread repair tests:** Affected tests passed `30/30`; backend typecheck passed; the complete backend suite passed `402/402`.
4. **Live note audit:** All seven projects contain zero note tombstones after the scoped repair.
5. **Server:** The registered Workstation server returned HTTP `200` after the operator-owned restart.
6. **Claim boundary:** These facts prove Workstation migration and the repaired task-thread path. They do not prove Mobile cutover, relay epoch-4 deployment, three-party convergence, or bidirectional assigned-node execution.

---

## L. Durable Prevention Rules

1. **Prepare the complete catalog before mutation.**
2. **Archive the mutation set, not the workspace.**
3. **Reference local binary payloads in place by verified hash.**
4. **Keep unavailable remote content as an audited causal head.**
5. **Derive note changes from exact declared note IDs.**
6. **Persist note entity and Markdown content head in one epoch-4 batch.**
7. **Restore system-corrupted notes with their original identities.**
8. **Keep lifecycle events in immutable execution artifacts.**
9. **Retain process paths until artifact publication completes.**
10. **Let restart recovery, not missing observation, create `interrupted`.**
