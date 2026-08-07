## A. Repository Intent

1. **Decision OS federation** replicates the epoch-4 task-current state between authenticated nodes through the Cloudflare Durable Object relay and the Termux local relay. The required outcome is convergent state without an unbounded transport, storage, CPU, or fan-out cost when a peer remains faulty or divergent.

---

## B. Current Iteration Intent

1. **Prepare a patch that makes flooding impossible by protocol contract.** This investigation establishes the complete feedback paths, proves the deployed implementation contains the repeating transition, and defines the finite-work requirements and adversarial regression boundary before implementation.

---

## C. Verified Evidence

1. **Production runs the vulnerable code.** `GET https://decision-os-federation-relay.ardaria.workers.dev/health` on 2026-08-02 returned release `65cc05a36f34fbf0064ad70f90a7e97cfb69d2eb`, state protocol `decision-os-task-state/4`, and production namespace `decision-os-federations-production`. That release deletes `activeRepairRequests` before each received summary and sends a new missing request whenever bucket mismatch remains in `backend/src/business/federation/helper/federation-task-state-replicator.ts`.

2. **The deployed relay scans and broadcasts for every received summary.** The same release calls `stateBuckets()` in `reconcileStateSummary()`, broadcasts the resulting full summary to every participating socket, and does so without a durable-state-change condition in `federation-relay/src/index.ts`.

3. **A real node and real Worker repeat an unchanged repair.** The isolated Worker WebSocket regression used the real `createFederationTaskStateReplicator`, a real authenticated Worker socket, and a deliberately nonconvergent node store. It observed two `state-missing-request` frames after two unchanged relay summaries. The intentional failing assertion is retained in trace job `trace-1785668170627-7ab1818e-8a7` at `.trace/jobs/trace-1785668170627-7ab1818e-8a7/test_relay-flood-proof.temp.test.ts.stderr.log`: `expected 2 to be 1`.

4. **The issue is deployed, not merely a harness artifact.** The production release source contains the exact two transitions exercised by the isolated Worker regression: summary-to-missing-request at replicator lines 192-207 and missing-request-to-entities-and-summary at relay lines 285-293.

5. **Current trace collection has no protocol observability.** The existing traced replication, Worker, and connector suites completed with empty application telemetry records. `trace-evidence` preserved process outcomes but emitted no frame, storage-scan, Durable Object, WebSocket, or no-progress events. A passing suite currently cannot distinguish convergence from an unbounded convergent loop.

6. **A real Worker fans out an unchanged summary.** A second isolated Worker regression connected three authenticated project participants, sent one unchanged summary from one node, and received three relay summaries. The intentional failing assertion is retained in trace job `trace-1785668770968-006ad269-9a1` at `.trace/jobs/trace-1785668770968-006ad269-9a1/test_relay-fanout-proof.temp.test.ts.stderr.log`: `expected 3 to be 1`.

7. **A real Worker repeats equal-bucket unequal-root summaries.** A third isolated regression connected the real node replicator to the Worker with identical empty bucket manifests and a deliberately inconsistent node root. It observed three node summaries before the assertion, with no entity batch. The retained trace job `trace-1785668867571-770c34df-199` reports `expected 3 to be 1` in `.trace/jobs/trace-1785668867571-770c34df-199/test_relay-root-loop-proof.temp.test.ts.stderr.log`.

8. **A real Worker repeats the reverse repair.** A fourth isolated regression made the real node replicator advertise one claimed bucket while yielding no matching entity to the relay request. The relay issued a second `state-missing-request`; retained trace job `trace-1785668914185-ba1fb61e-688` reports `expected 2 to be 1` in `.trace/jobs/trace-1785668914185-ba1fb61e-688/test_relay-behind-loop-proof.temp.test.ts.stderr.log`.

---

## D. Full Feedback Mechanisms

1. **Node-behind-relay repair loop.** `state-subscribe` yields a relay summary. A divergent node sends `state-missing-request`. The relay lists all requested bucket entities, sends entities, scans every project bucket again to form a summary, then the unchanged divergent node starts the same repair again. Neither endpoint sets a session deadline, attempt limit, duplicate key, or no-progress terminal state.

2. **Relay-behind-node repair loop.** A node advertises a summary after local publication. The relay scans its project buckets, asks the node for mismatches, broadcasts its summary to all participants, and the node sends entities followed by another summary. A node that cannot make the relay root advance repeats this conversation without a finite ceiling.

3. **Equal-bucket unequal-root loop.** `mismatchedBuckets()` compares only bucket count and checksum. When buckets match but `payload.root` differs, the node advertises again. The relay does not validate that a received root equals the hash of its supplied manifest and broadcasts again. This is a summary-only loop that needs no missing entities.

4. **Participant fan-out.** Each received summary causes the relay to broadcast a full relay summary to every active project participant even when relay durable state did not change. One faulty node therefore creates work at every healthy node.

5. **Reconnect and catalog re-entry.** Connection establishment and catalog updates call relay reconciliation and project reconciliation. Disconnect clears repair ownership, while the connector retries forever with a capped delay. Reconnect provides a fresh entry point to every unresolved repair.

6. **Duplicate transport work.** Duplicate entity batches are state-merge idempotent but still invoke merge, acknowledgement, and projection scheduling. Worker duplicate batches also transact durable state because neither endpoint has delivery receipt replay protection.

---

## E. Systemic Miss

1. **The protocol has no authority that can declare a repair exhausted.** `activeRepairRequests` is a local set keyed only by peer and project. It is cleared on every summary, never checked as an admission gate, cannot identify a root generation, and does not survive or coordinate the relay response.

2. **The relay treats every valid frame as new work.** The protocol carries no repair identity, expected source root, requested-bucket digest, cursor, attempt, terminal result, or response receipt. The Worker therefore cannot prove a request belongs to a current session, suppress it, replay a cached result, or stop it.

3. **Frame limits do not bound resource work.** A 512 KiB frame can name many buckets. `Promise.all()` starts one `listAll()` per requested bucket, materializes all matching entities, and then `stateBuckets()` lists the entire project again. The HTTP stream limit does not apply to state frames.

4. **The protocol treats repeated comparison as convergence control.** The epoch-3 architecture says summaries repeat until roots match, but gives no finite failure path. The newer incident design requires finite deadlines, single-flight ownership, and bounded request counts. The implementation matches neither requirement.

5. **Both transports drift together.** `federation-relay/src/termux-local-relay.ts` mirrors the Worker reconciliation and unconditional broadcast behavior. A Worker-only patch would leave the local transport on an incompatible and flood-capable protocol.

---

## F. Patch Contract

1. **Preserve the epoch-4 wire contract and enforce repair ownership internally.** Keep `decision-os-task-state/4`, state schema `4`, protocol version `1`, and every existing frame type. Updated nodes attach optional correlation fields inside the existing `payload`; v4 nodes that omit them remain valid. The relay derives the same repair key from authenticated node identity, project, canonical relay root, peer-manifest digest, and requested-bucket digest.

2. **Make the node single-flight.** A node sends one missing request for an active `{peer, project, relayRoot, bucketDigest}` repair lease. Duplicate and delayed summaries do not clear that lease. It settles only on a matching existing `state-converged` frame, changed relay root, expiry, or explicit rejection.

3. **Make the relay authoritative and idempotent.** The relay creates one lease per `{node, project, relayRoot}`. Duplicate v4 subscribe, summary, and missing-request frames return a stored status with zero new bucket scans and zero broadcast. A v4 client that omits correlation fields cannot purchase additional Durable Object reads.

4. **Validate manifests before work.** The relay recomputes and verifies `root === hash(buckets)` for every summary. An inconsistent root creates a scoped protocol incident and produces no reconciliation response.

5. **Bound all repair work.** Enforce the fixed 256-bucket namespace, sequential bucket scanning, entity and byte limits per response, one active lease per node-project-root, a finite deadline, finite frame budget, finite storage-read budget, and a finite outbound-message budget. Legacy v4 requests receive the same bounded reply frames they already understand.

6. **Broadcast only durable change.** A summary is emitted on subscription, actual relay-root change, and an explicit session terminal response. An unchanged received peer summary never broadcasts to participants.

7. **Persist a compact v4 manifest.** Store the project bucket manifest and root transactionally with state updates under an additive v4 storage key. Summary generation reads that compact record instead of scanning all bucket rows. A lease record prevents a duplicate request from reading it again.

8. **Contain no progress.** Expiry with an unchanged root records durable `federation_repair_no_progress` evidence containing node, project, repair key, roots, digest, counters, and timestamps. It pauses that node-project-root repair across reconnects. Only a changed relay root and explicit operator recovery create a new bounded lease.

9. **Apply the same epoch-4 guard to Cloudflare and Termux.** Extract the shared repair-lease state machine and run transport-specific persistence and socket adapters behind it.

10. **Backpressure state transport.** Put state publication in a bounded cancellable lane with acknowledgement-aware settlement. WebSocket `send()` acceptance is not delivery completion.

---

## G. Required Adversarial Proof Suite

1. **Real node to real Worker permanent divergence.** Hold one node divergent through a real authenticated Worker WebSocket and assert one active session, one missing request, bounded entity pages, bounded scans, bounded outgoing frames, one no-progress incident, and no further traffic after expiry.

2. **Real Worker to real node permanent divergence.** Keep the relay behind a node, then assert the same bounds in the reverse repair direction.

3. **Root integrity.** Send equal buckets with an incorrect root and assert one protocol incident, zero repair scans, zero broadcasts, and no repeat frame.

4. **Duplicate and reordered traffic.** Send duplicate subscribe, summary, missing request, entity batch, terminal summary, delayed terminal summary, and reconnect mid-session. Assert cached output and fixed ceilings for each session.

5. **Abusive selection.** Send the maximum permitted bucket request, one bucket above the maximum, duplicated buckets, and a page boundary. Assert rejection before storage work for invalid selection and exact page counters for valid selection.

6. **Isolation.** Run a healthy second project and a healthy second node during the adversarial repair. Assert their roots converge with no repair incident and no adversarial-session frame or scan attribution.

7. **Emission-time telemetry.** Record `state-subscribe`, `bucket-summary-received`, `repair-started`, `repair-suppressed`, `missing-request-sent`, `entities-replayed`, `terminal-summary-received`, `repair-converged`, `repair-no-progress`, `relay-bucket-scan`, `relay-summary-broadcast`, outbound bytes, and Durable Object row reads at the code that emits or performs each action. The test asserts counters from those records, not only final state.

---

## H. Operator Decision Summary

1. **Do not patch the local set.** Adding a `.has()` check alone masks one node-side loop but leaves the relay vulnerable to an arbitrary authenticated client, the reverse loop, root-only loop, fan-out, repeated scans, and reconnect re-entry.

2. **Implement the epoch-4-compatible, relay-owned finite repair lease with shared Cloudflare and Termux behavior.** Its proof gate is the real node-to-Worker adversarial suite with resource counters and permanent divergence.

---

## I. Remediation Plan

1. **Keep epoch 4 unchanged.** Preserve `decision-os-task-state/4`, schema `4`, transport version `1`, and the existing `state-subscribe`, `state-bucket-summary`, `state-missing-request`, entity, acknowledgement, and convergence frames. No client migration, state-data migration, compatibility cutover, or node upgrade is required for flood containment.

2. **Add an epoch-4 repair guard shared by the Worker and Termux relay.** Create a pure `federation-repair-guard` module that derives one lease key from authenticated node ID, project ID, canonical relay root, peer-manifest digest, and requested-bucket digest. The guard admits the first valid v4 repair transition, records its counters and deadline, suppresses every duplicate, and reaches a durable terminal state. Existing v4 payloads remain valid because the guard derives all required identity from their existing fields.

3. **Use optional payload correlation only as an acceleration.** Updated nodes add `repairId`, `relayRoot`, `manifestDigest`, and `pageCursor` to the existing payload objects. The Worker recognizes them when present. Nodes that omit them follow the derived legacy lease path with the same bounds and suppression. No new frame type is introduced.

4. **Fix the node-side first incorrect transition.** Replace the current delete-before-check behavior in `federation-task-state-replicator.ts` with a root-aware active lease map. A repeated `state-bucket-summary` with the same remote root and bucket digest is telemetry-only and sends no missing request. Clear the lease only on a matching existing `state-converged`, changed relay root, expiry, or explicit rejection. Apply the equivalent guard to repeated relay missing requests before sending entities and another summary.

5. **Make the relay the last containment boundary for current and old nodes.** Before processing any v4 summary, validate `payload.root === hash(payload.buckets)`. For a valid first summary, compute and retain the lease. For a duplicate summary with unchanged relay root, send nothing and do no bucket scan. For a duplicate missing request, send nothing and do no entity scan. For an invalid manifest, persist `federation_repair_invalid_manifest`, send one bounded rejection, and perform no reconciliation work. This blocks flooding even from an unpatched epoch-4 node.

6. **Eliminate repeated project scans and uncontrolled fan-out.** Add `state:v4:manifest:<project>` containing the canonical 256-bucket summary, root, and root generation. Seed it lazily from existing v4 bucket summaries, then update it inside the current entity persistence transaction. Read that key for summaries. Scan requested entity buckets sequentially, never through `Promise.all()`. Send a summary only to the session owner after subscription, a successful repair response, and a durable root change. Never broadcast in response to an unchanged peer summary.

7. **Enforce fixed epoch-4 work ceilings.** Permit the fixed 256 bucket names, de-duplicate them, reject a noncanonical bucket name before storage work, allow `128` entities and `512 KiB` per existing entity frame, cap a lease at `64` entity frames, `8 MiB` payload, `256` bucket scans, `30 seconds`, and one active node-project-root lease. When a lease reaches a ceiling, persist `federation_repair_no_progress`, send one terminal existing-frame response, and suppress the same node-project-root across reconnects until the relay root changes or explicit recovery clears the incident.

8. **Preserve normal epoch-4 convergence.** A valid first legacy summary receives the existing missing-request and entity-batch conversation. The guard permits all frames required for that one bounded conversation. A matching existing `state-converged` closes the lease. Unchanged repeats are the only frames suppressed.

9. **Add bounded state publication.** Route epoch-4 state frames through one per-socket cancellable queue in `federation-node-connector.ts`. Cap queued frames and bytes, abort it on socket replacement and close, and record a scoped delivery incident on deadline. Existing frame encoding remains unchanged.

10. **Expose emission-time diagnostics.** Persist lease counters when state work begins and when each state frame is emitted. Expose authenticated relay diagnostics and server diagnostics for `state-subscribe`, `bucket-summary-received`, `repair-started`, `repair-suppressed`, `missing-request-sent`, `entities-replayed`, `terminal-summary-received`, `repair-converged`, `repair-no-progress`, `relay-bucket-scan`, `relay-summary-broadcast`, rows read, outbound bytes, and frame count. Feed the backend records into trace evidence.

11. **Make compatibility and boundedness permanent test gates.** Add a real Worker plus real replicator suite containing both updated and legacy epoch-4 payloads. It must prove normal one-pass convergence, node-behind-relay permanence, relay-behind-node permanence, equal-buckets unequal-root rejection, duplicate and delayed summary suppression, duplicate missing-request suppression, reconnect quarantine, root change release, fixed ceilings, and a healthy second project plus node with no attributed traffic. Execute the same matrix against Termux.

12. **Release without a protocol migration.** Run focused tests through `node bin/decision-os-verify.mjs`, scoped typechecks, and the complete backend suite at `--test-concurrency=1`. Deploy the compatible Worker guard while federation remains cut off, verify `/health` still reports epoch 4 and the intended release SHA, run the isolated two-node v4 canary with automatic library synchronization disabled, then re-enable federation only after the canary proves bounded convergence and zero no-progress incidents.
