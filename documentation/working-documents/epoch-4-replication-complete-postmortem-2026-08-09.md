# Epoch-4 Replication Incident Complete Postmortem — 2026-08-09

## 1. Repository Intent

Decision OS must replicate current causal task state through an epoch-4-compatible relay while keeping mutable Markdown and immutable content objects in a separate content lane. One project, watcher, peer, repair, collision, or persistence failure must pause only its owning scope. Recovery must preserve invalid durable evidence, require explicit operator authority, prove exact relay equality, survive a fresh durable reload, and only then restore normal runtime admission.

## 2. Incident Scope and Outcome

This postmortem covers the production failure chain from the pre-`rel-0.4.2` state through `rel-0.4.8`, including watcher startup, copied-main canaries, relay persistence, cold repair topology, memory attribution, CRDT collisions, restart recovery, incident evolution, release admission, and final production proof.

Final production state after `rel-0.4.8` and restart:

1. Health `ready`.
2. Active incidents `0`.
3. Paused task, federation, watcher, background, and project-runtime scopes `0`.
4. MOH relay convergence `true` with no missing buckets.
5. `runtimeDirty=[]`, `pendingDeliveryIds=[]`, `queuedRelayEntityCount=0`, `activeRepairCount=0`.
6. Content queue depth `0`.
7. Durable MOH root `107dcb74d6dd437812023c15d1023611fb17a621d233ce6ee0cb4a9cdd06b018` reproduced after production restart.
8. Production relay and application aligned on `rel-0.4.8`, main SHA `72f633665cc1453cbc41540c8963079a9ead1dba`, protocol `decision-os-task-state/4`, schema `4`, baseline epoch `4`.

## 3. Executive Root Cause

There was no single bug. The system had an incomplete end-to-end replication state machine and incomplete release proof.

The first architectural error was allowing cold synchronization to use paths that did not share one relay-owned bounded durability, flow-control, ACK, retry, and convergence authority. Around that defect, watcher startup confused remote ownership with local filesystem authorship, persistence amplified each bounded frame into whole-state work, diagnostics treated terminated work as idle, collisions were handled asymmetrically, recovery identities were too weak, durable incident schemas evolved without legacy upgrade, and the final recovery path depended on runtime admission that the pause itself intentionally disabled.

The release process repeatedly proved one component boundary, promoted it, and discovered the next unexercised production transition. `rel-0.4.3` through `rel-0.4.8` were therefore not one fix split cosmetically; each closed a distinct missing state-machine transition.

## 4. Chronology

### 4.1 Pre-0.4.2 and retained production state

1. Production already contained same-dot/different-value MOH entities created by migration writers.
2. The incident ledger records 132 resolved relay-frame dot-collision incidents between `2026-08-08T00:52:50.407Z` and `00:53:13.504Z`.
3. A whole incoming batch could fail on one poisoned entity before a correlated terminal ACK, so independent healthy entities were denied progress.
4. Tests and relay logic did not prove receiver durable application plus exact equal roots as the only completion authority.

### 4.2 `rel-0.4.2` — known degraded release

1. Main SHA: `0f775c7bab28805e24a67f81bd15a30bdccb2af3`.
2. Promoted: `2026-08-08 19:26:51 +07`.
3. A known watcher correction remained uncommitted while the release iteration diverted into editor-lineage work.
4. Startup selected retained one-head resources without proving the mutable Markdown sidecar existed and was readable.
5. Missing remotely owned sidecars entered local capture, threw `task_content_capture_failed`, and paused watcher scopes.
6. The copied-main baseline reproduced 174 incidents: MOH `43`, Decision OS `125`, Lys `6`.
7. Production was released while explicitly degraded, with retained incidents and paused watchers.

### 4.3 Copied real-main baseline

1. Authority was the copied real main state, not dev: eight projects and 9,702 local entity files.
2. Three earlier launches were rejected as fixture-admission failures: missing master Git HEAD, missing project Git identity, and missing `state.json`.
3. Node A published to an empty Termux relay. The relay performed at least 80 growing full-file rewrites of a final approximately 20,055,952-byte relay JSON file.
4. Empty Node B discovered all projects but only four converged.
5. Decision OS stopped at `6,272/7,160`; Search at `0/3`; MOH at `0/614`; Lys at `0/485`.
6. Four 15-second deadlines fired together. Timeout removed active repair bookkeeping, leaving zero queue gauges while roots still differed.
7. Static and telemetry evidence proved B had requested direct owner repair, bypassing the relay's durable bounded repair lane.

### 4.4 `rel-0.4.3` — healthy cold-state mechanics

1. Feature SHA `b2f239a7`; main SHA `ac550ae20cf9c60af9c48f533d9eee71a89590c9`.
2. Promoted `2026-08-09 12:26:52 +07`.
3. Corrected watcher admission and observation ownership.
4. Routed normal cold repair through relay authority.
5. Added bounded windows, grouped durability, deferred derived work, and better replication timing diagnostics.
6. Proved healthy copied-state cold repair, reconnect, warm silence, and persistence behavior.
7. Did not resolve contradictory production relay state containing real collisions. An empty relay could not exercise that authority conflict.

### 4.5 `rel-0.4.4` — terminal relay-to-node collision protocol

1. Feature SHA `cb3d7e5f`; main SHA `f4456e11794e98943867de2d4f688fc98271514c`.
2. Promoted `2026-08-09 13:43:20 +07`.
3. Added per-entry mixed acceptance and rejection so healthy entities survive beside one poisoned entity.
4. Corrected submitted-hash versus resulting joined-hash ACK semantics.
5. Persisted complete collision evidence and terminal rejected hashes.
6. Added deterministic explicit local-authority successor recovery, restart reconstruction, and lost-ACK behavior.
7. Recovery settled 14 `artifacts` conflicts, then exposed eight `lifecycle` conflicts.
8. It did not claim symmetric node-to-relay publication recovery.

### 4.6 `rel-0.4.5` — sequential collision generation identity

1. Feature SHA `e2491a6d`; main SHA `5c9968044e1b5123e47c615851b7c1023aa37a9e`.
2. Promoted `2026-08-09 13:59:52 +07`.
3. The prior recovery decided that later lifecycle successors were already pending because dirty predecessor hashes used the same entity keys.
4. Fixed pending attribution to require project, entity key, and exact resulting successor hash.
5. Refreshed recovery authority from the active durable incident rather than a stale pause cache.
6. Added an incident-generation guard before resolution.
7. Production then exposed a distinct node-to-relay `metadata` collision.

### 4.7 `rel-0.4.6` — node-to-relay publication collision authority

1. Feature SHA `74c53b64`; main SHA `52732c16554db399b6168c5f76651c7fa6073643`.
2. Promoted `2026-08-09 14:15:54 +07`.
3. Added bounded relay-root authority to rejected publication ACKs.
4. Kept ACKs bounded; an initial idea to embed complete receiver entities was rejected because it could exceed the 512 KiB/1 MiB transport ceilings.
5. Adopted exact receiver bytes from existing durable collision archives by key and receiver hash, recomputed collision coordinates, and bound the evidence to the publication attempt before settlement.
6. Added root-specific terminal suppression and deterministic publication successor recovery.
7. The existing production incident predated these fields and still had `relayRoot:null` and `evidenceKeys:[]`.

### 4.8 `rel-0.4.7` — legacy incident evidence upgrade

1. Feature SHA `2e3015e3`; main SHA `6d766989a43515105a6e0fc425944ce08003120a`.
2. Promoted `2026-08-09 14:31:43 +07`.
3. During explicit recovery only, validated the legacy attempt, delivery, rejection hashes, current submitted entity, archived receiver entity, and exact collision coordinates.
4. Durably adopted the old evidence into the current publication-evidence contract.
5. Refreshed the original incident fingerprint with evidence keys and a validated relay root.
6. Confined recovery-frame store authority to correlated relay ACK and bucket-summary frames.
7. Production still returned immediately because the no-progress pause had correctly excluded MOH from the normal runtime-state map that recovery still required.

### 4.9 `rel-0.4.8` — paused-store recovery bootstrap

1. Feature SHA `5dce64e2`; main SHA `72f633665cc1453cbc41540c8963079a9ead1dba`.
2. Promoted `2026-08-09 14:43:43 +07`.
3. Opened an isolated durable task-current store for explicit recovery without installing normal runtime authority.
4. Ran evidence adoption, deterministic successor publication, relay ACK, exact root equality, flush, fresh reload, and incident-generation validation through that isolated store.
5. Installed normal project runtime only after all durable proof succeeded.
6. Contained installation or incident-resolution failures by removing transient runtime state, retaining original pauses, and recording `federation_repair_runtime_restore_failed`.
7. Explicit recovery returned HTTP 200 and resolved both the primary collision and derived no-progress incidents.
8. A final production restart reproduced the same MOH root and zero incident/queue state.

## 5. Complete Critical Causal Defect List — Fixed

1. **Watcher remote/local authority confusion.** A retained remote head plus absent mutable Markdown was treated as a local filesystem contribution.
2. **Watcher failure fan-out.** Startup reconciliation admitted many resources concurrently and one missing-file class paused whole watcher scopes.
3. **Wrong cold-repair authority.** Remote catalog discovery selected the owner node rather than the relay's durable state.
4. **Missing direct-path backpressure and durability authority.** Direct socket sends had no shared bounded credit, receiver-apply ACK, durable retry, or reconnect continuation.
5. **Persistence amplification.** Each bounded batch triggered synchronous serialization and replacement of the whole growing relay state.
6. **False idle diagnostics.** Repair timeout deleted active work, so zero queue gauges coexisted with unequal roots.
7. **Whole-batch collision atomicity.** One same-dot conflict prevented healthy independent entities from committing or being acknowledged.
8. **Submitted/resulting hash conflation.** ACKs could echo the joined relay hash while the sender required the submitted hash to clear dirty state.
9. **Directional collision asymmetry.** Relay-to-node collision recovery existed before node-to-relay publication recovery.
10. **Insufficient durable terminal evidence.** Incident/restart state lacked the complete entity hashes, collision coordinates, attempt, delivery, direction, and relay-root authority needed for recovery.
11. **Poison-hash reconnect flooding.** A rejected entity remained dirty and could be automatically republished after reconnect.
12. **Lost-ACK ambiguity.** Restart could not always reconstruct the exact accepted/rejected disposition and remaining repair work.
13. **Weak sequential-generation identity.** Key-only attribution confused one collision successor with a later successor on the same entity.
14. **Stale incident authority.** Cached pause state could lag the newest durable incident generation.
15. **Primary/derived incident confusion.** Generic no-progress could obscure the terminal collision that actually required operator recovery.
16. **Legacy evidence incompatibility.** Production incidents created before the new evidence fields could not enter the new recovery path.
17. **Pause/recovery dependency cycle.** Recovery required runtime admission that the no-progress pause intentionally disabled.
18. **Over-broad recovery-store authority.** An intermediate design would have allowed arbitrary federation frames through a paused project; final authority is limited to correlated ACK and summary frames.
19. **Over-broad incident cleanup.** An intermediate design could resolve unrelated incidents sharing the downstream scope; final cleanup proceeds only when all active downstream incidents are no-progress.
20. **Runtime restoration partial failure.** An intermediate design could leave a replacement runtime installed behind retained pauses; final installation and durable incident resolution share one containment boundary.

## 6. Complete Proof and Test Failures

1. The `0.3.0` watcher fixture created readable Markdown and did not exercise retained-head plus startup `ENOENT`.
2. A raw-WebSocket flood proof bypassed the actual connector, replicator, destination store, dirty state, and incident ledger.
3. A 20,000-entity test counted frames without proving destination durable application, close/reopen, and exact roots.
4. A reconnect sentinel treated deliberate receiver interception, null destination state, and no retry as successful suppression.
5. The copied-main empty-relay canary omitted the contradictory production relay authority, so it could prove transport but not real reconciliation.
6. Collision tests initially fabricated rejection frames rather than composing connector, relay storage, incident serialization, restart, recovery, and reload.
7. Worker and Termux parity was incomplete across collision, ACK, restart, and completion semantics.
8. Incident hydration, replicator collision handling, and recovery were initially tested in separate fixtures with incompatible evidence completeness.
9. Zero pending/dirty/queued/active values were used as a success proxy although roots differed after timeout.
10. Focused unit/component passes were promoted as stronger proof than they provided.
11. The first broad remediation changed approximately 8,441 lines across 51 files, mixing protocol, watchers, diagnostics, release tooling, backup, and orchestration. Passing subsets obscured the wrong completion invariant.
12. The full backend suite remained `753/754` twice for unrelated infrastructure defects: a leaked FileHandle/Control Room fatal under concurrency and a worktree CLI path defect in serial execution. Focused replication proof passed, but the suite debt must not be called green.

## 7. Complete Operational and Release Failures

1. A known watcher runtime defect was discovered before `rel-0.4.2` but was not included in the released work inventory.
2. Editor-lineage/release work displaced the production runtime blocker.
3. `rel-0.4.2` was knowingly released with `status:degraded`, retained incidents, and paused watchers.
4. A full-catalog canary ran inside MultiTerm's shared resource scope. `systemd-oomd` killed the shared scope after approximately 21.7 GB RAM plus 1.3 GB swap, interrupting the app and the evidence session.
5. The first broad production copy included unrelated multi-gigabyte runtime/artifact state and changed while production was live; it was invalid and discarded.
6. Three copied-state launches failed fixture admission before a valid baseline was obtained.
7. Fresh dev success was used as evidence for main even while production ran old code or retained different durable relay state.
8. Relay and application release identity were not always treated as one required compatibility boundary.
9. Production required six patch promotions from `0.4.3` through `0.4.8` because each release exercised only the next previously unmodeled boundary.
10. Multiple restarts were necessary for incremental recovery but increased outage and state-transition risk.
11. Restart was initially discussed as a way to clear pauses; durable pauses were valid containment and required explicit re-read, recovery, resolution, and restart proof.

## 8. Measurement Corrections

1. `20,241,826 currentBytes` was a store diagnostic, not wire payload, Markdown bytes, or RAM.
2. The historical `19.2 MB` figure did not preserve the structural-state/content boundary and was not a valid replication-payload claim.
3. Approximately 20 MB relay JSON, current-shard bytes, encoded state frames, referenced Markdown bytes, and immutable content-object bytes are five separate measures.
4. `9,702` local entity files included held/local-only entities; Rudy demonstrated `265` local versus `263` active replicated entities.
5. The 120-second cutoff was an observation deadline, not an acceptable convergence target.
6. Approximately 27.8 GB virtual size was not RSS.
7. The historic 21.7 GB RAM event belonged to a shared cgroup. No retained per-PID RSS/PSS/V8 heap/external/array-buffer series proves one Node process consumed 20 GB.
8. Observed production RSS was approximately 461 MB. Valid canary point samples were approximately Node A 584 MB, Node B 485 MB, and relay 332 MB, with a relay transient sample around 579 MB. These samples are not peak attribution.
9. Source proves amplification mechanisms: duplicated entity arrays, queued frames, JSON buffers, repeated whole-state serialization, WAL/current-shard writes, deferred observers, and shared-scope process overlap. It does not prove the exact allocator responsible for the historic cgroup peak.
10. Content diagnostics duplicated source aliases, inflating missing counts. One genuine retained-head hole remained: requested immutable hash unavailable while the mutable file had a different hash.
11. The first baseline lacked relay frame/byte counters and therefore could not prove no flooding from queue state alone.

## 9. Architecture Corrections Now Present

1. Relay-owned repair scheduling, per-project fairness, bounded connection credit, and exact ACK release.
2. `512 KiB` maximum encoded state frame, four deliveries per project, sixteen per connection, and sixteen MiB connection credit.
3. Durable accepted/rejected repair records and exact reconnect continuation.
4. Grouped receiver durability and deferred current-shard materialization for enhanced repair.
5. Coalesced observer work outside structural convergence.
6. Watcher filesystem-generation ownership shared between native events and audit.
7. Missing remote sidecars deferred rather than captured as local edits.
8. Separate structural state and content scheduling lanes.
9. Exact accepted/rejected delivery partitions; malformed or partial ACKs fail closed.
10. Durable collision evidence with direction, project, key, attempt, delivery, submitted hash, receiver/resulting hash, collision coordinates, and complete archived entities.
11. Terminal poison-hash suppression reconstructed from incidents and store evidence after restart.
12. Deterministic, idempotent local-authority recovery successors.
13. Exact-hash sequential recovery attribution.
14. Durable active-incident generation guards.
15. Explicit legacy evidence adoption under operator recovery only.
16. Isolated paused-store recovery followed by convergence, flush, fresh reload, then normal runtime installation.
17. Separate primary terminal-collision and derived no-progress scopes.
18. Production relay deployment and application promotion bound to one annotated release tag and exact health fingerprint.

## 10. Architecture Lessons

1. **Model two pipelines.** Causal task state and content objects have different authority, payload, scheduling, and convergence criteria.
2. **Assign one authority per transition.** Relay schedules repair; store owns durable join; ACK releases credit; equal roots prove structural convergence; incident ledger owns pause; explicit recovery owns successor creation.
3. **Use complete generation identity.** Project, direction, relay root, receiver root, attempt, delivery, key, submitted hash, and resulting hash are required. Project-only, key-only, and socket-only identities are insufficient.
4. **Treat collisions as protocol outcomes.** A CRDT collision is not a generic exception. Healthy entries commit, poisoned entries terminate with complete evidence.
5. **Design both directions together.** Every relay-to-node state transition needs the node-to-relay counterpart across success, rejection, lost ACK, disconnect, restart, and recovery.
6. **Separate durable commit from derived effects.** UI, content, materialization, conflict reconciliation, and SSE must not delay structural ACK and root settlement.
7. **Persist progress before acknowledging.** Socket memory is never restart authority.
8. **Pause and recovery require different admission domains.** The recovery path must validate a paused store without reopening normal work prematurely.
9. **Evolve durable incident schemas explicitly.** Every new evidence field requires an upgrade path for retained incidents.
10. **Budget amplification, not corpus size.** Bound frames, encoded bytes, pending deliveries, WAL writes/fsyncs, observer backlog, snapshots, and retry generations.
11. **Prove topology, not availability.** HTTP-ready and WebSocket-connected do not prove correct repair authority or convergence.
12. **Release the complete causal inventory.** A known unintegrated production fix is a release blocker regardless of unrelated passing work.

## 11. Prevention Controls

1. Maintain one bidirectional protocol matrix covering healthy transfer, duplicate, partial disposition, malformed ACK, collision, lost ACK, disconnect before/after durable write, restart, stale attempt, sequential collision, and legacy incident.
2. Add one production-sized amplification-budget test that asserts peak per-PID RSS/PSS, V8 heap/external/array buffers, queued encoded bytes, WAL bytes, fsync count, observer backlog, frame count, and reconnect amplification.
3. Add invariant telemetry and assertions:
   - pending deliveries imply bounded encoded bytes;
   - terminal rejected hashes never enter the automatic queue;
   - converged means exact equal roots and no relevant dirty state;
   - resolved pause means fresh durable reload succeeded;
   - one relay generation emits at most one terminal broadcast.
4. Create a single immutable release-admission receipt containing both node identities, relay SHA, fixture provenance hash, pre/post roots, abstract-state bytes, content bytes separately, elapsed phase times, peak memory, queue maxima, and incident delta.
5. Preserve watcher tests across native event, audit, server-owned materialization, absent remote content, later content creation, canonical HTTP write, and external deletion.
6. Keep protocol, watcher, diagnostics, deployment, and backup changes as separately admissible diffs.
7. Replace growing incident-shape branching with one normalized durable collision record and one recovery state machine.
8. Require every suppression cache to document its durable reconstruction authority.
9. Add independent oracle or mutation testing for hashes, buckets, joins, and collision evidence; do not rely only on shared production helpers.
10. Add persistence fault injection for `ENOSPC`, `EIO`, partial append, fsync, rename, directory sync, Worker transaction conflict, and crash at every ACK boundary.
11. Add transport fault injection for drop after send/before merge, merge-before-ACK, ACK loss, duplicate ACK, stale delivery, reordered summary, and reconnect generation replacement.
12. Keep copied-real-main state immutable and record fixture provenance. Never augment it and still call it exact.
13. Require both persisted authorities at the same causal cut. An empty relay proves bootstrap, not conflict reconciliation.
14. Label a synthetic causal-class fixture as synthetic; never use it as exact production-state proof.
15. Put canary node, relay, and clients in separate process scopes with per-PID telemetry and hard owned cleanup. Never run a large proof in a shared operator session scope.
16. Measure cold convergence from authenticated subscription/publication boundaries to exact root equality. Exclude result serialization, status-report construction, and content transfer unless specifically measuring those phases.
17. Treat performance gates as fixture-derived limits. Never normalize a 120-second cutoff as acceptable for a few-megabyte abstract state.
18. Block promotion if any known production-causing correction remains uncommitted, unintegrated, undeployed, or unrecovered.
19. Keep the production incident and relay repair records until the exact causal fixture can reproduce the incident class.
20. Track the unrelated full-suite FileHandle and worktree-path failures as test-infrastructure debt; focused replication proof does not erase them.

## 12. Open Debts

The production incident is fixed, but these controls are not yet fully proven as repository-wide completed work:

1. Independent hash/join oracle and mutation testing.
2. Complete transport and persistence fault matrix.
3. Stable per-PID memory/V8 telemetry in the copied-main canary.
4. A reproducible exact production relay-state capture method.
5. One full end-to-end fixture composing watcher startup, real connector, persisted relay authority, two full nodes, both collision directions, lost ACK, sequential recovery, pause, legacy restart, explicit recovery, content, and reload.
6. Resolution of the two unrelated `753/754` full-suite infrastructure failures.
7. Explicit performance acceptance thresholds derived from repeated cold-main measurements.

## 13. Operator Decision Summary

The immediate production failure is closed and restart-proven. The architectural priority is now to stop treating component tests as release proof and build one immutable, production-sized, two-authority, bidirectional state-machine qualification with amplification telemetry and fault injection. Until that exists, future replication releases must state exactly which durable transition remains unexercised rather than claiming global correctness from local green tests.
