## A. Repository Intent

1. **Decision OS federation** must converge epoch-4 task-current state between authenticated nodes without allowing one divergent peer to create unbounded relay reads, entity replay, summary fan-out, CPU work, reconnect work, or traffic against unrelated projects.
2. **Compatibility remains fixed:** keep `decision-os-task-state/4`, state schema `4`, transport version `1`, the existing frame types, and the sparse epoch-4 root calculation.

---

## B. Current Iteration Intent

1. **Reproduce the flood with two isolated canary nodes and one temporary relay.** Canary A uses a sanitized copy of the current Decision OS state. Canary B starts with an independent local project and receives Canary A's project as a remote replica.
2. **Prove normal synchronization with a large deterministic state.** The state must exceed `64` entity frames and `8 MiB` of encoded epoch-4 entity payload while occupying all `256` canonical buckets.
3. **Apply the smallest structural correction.** Both the node and relay remember repair work for one relay-root generation and do not repeat it until durable relay state changes.
4. **Repeat the identical proof after the patch.** Permanent divergence must become quiescent while the large healthy replica still reaches the exact source root and survives reload.
5. **Retain the proof as automated regression coverage.** The permanent-divergence, reconnect, large-state convergence, and unaffected-project cases become required tests.

---

## C. Safety Boundary

1. **Use a dedicated implementation worktree based on current `dev`.** The canary code, tests, patch, and permanent documentation remain on one feature branch until every verification gate passes.
2. **Use only temporary directories created by the harness.** Record every runtime root, PID, process group, port, relay state file, log, and evidence directory in one run manifest before starting a process.
3. **Prohibit production attachment before process launch.** Admission rejects the production Worker hostname, production federation ID, production namespace, ports `50150`, `50151`, and `50152`, reused node IDs, reused project IDs, and any copied federation credential.
4. **Keep the existing servers untouched.** Do not stop, restart, navigate, reconfigure, or connect the registered Decision OS servers. Do not register either canary in MultiTerm.
5. **Exclude unrelated background work.** Run each canary as a separate node runtime composed from the real epoch-4 store, replicator, and connector with no federated-library runtime, Codex scheduler, content scheduler, project-sync runtime, browser, or production project discovery.
6. **Bound the intentionally failing proof.** The pre-patch flood observation runs for `5 seconds`, stops after `32` repeated repair rounds, and always tears down the exact canary process groups in test cleanup.
7. **Preserve source bytes.** The harness reads `/home/jbb/.decision-os` only. It never changes that directory and never copies `.settings.json`, `.git`, credentials, runtime processes, caches, trace jobs, uploads, telemetry, incidents, rollback snapshots, pipeline recovery, or project-sync runtime state.

---

## D. Canary Topology

1. **Canary A:** code from the iteration worktree, node ID `flood-canary-a-<run-id>`, one project copied from `/home/jbb/.decision-os`, and an epoch-4 store augmented by the deterministic large-state generator.
2. **Canary B:** the same code revision, node ID `flood-canary-b-<run-id>`, one independent empty local project, and a remote replica store created for Canary A's advertised project.
3. **Temporary relay:** the real relay implementation bound to `127.0.0.1` on an operating-system-assigned port outside `50150` through `50152`, a unique federation ID, unique node credentials, and emission-time counters. Worker runs use isolated Durable Object storage; Termux runs use one isolated relay state file.
4. **Project isolation:** Canary A's copied project ID and Canary B's local control-project ID must be distinct. The harness checks the relay catalog before state traffic begins.
5. **Transport matrix:** run the same scenario first against `FederationRelayV4` through the local Cloudflare worker test pool, then against `termux-local-relay.ts`. Both transports consume the same repair-guard contract and assertion library.

---

## E. Sanitized State Copy

1. **Create a read-only inventory first.** Record the source path, source child-repository revision, byte count, file count, project ID, ledger count, task-current entity count, bucket count, and root hash.
2. **Copy authored project inputs only:** `project.json`, `projects.json`, `projects-canvas.json`, `cards/**`, `threads/**`, `pipeline-prompts/**`, and the ledger files referenced by the project catalog.
3. **Copy canonical epoch-4 state through the store contract.** Open the source `TaskCurrentStateStore`, enumerate its durable entities, and write them through a new canary store. Do not copy live cache directories byte-for-byte.
4. **Verify the copied baseline.** Before augmentation, assert identical entity keys, state hashes, sparse bucket manifest, entity count, and root hash between the source store and Canary A.
5. **Write new canary settings.** The only federation values are the temporary loopback relay URL, unique federation ID, unique node ID, generated credential, and canary label.
6. **Record exclusions in the run manifest.** The manifest must prove that no production relay URL, federation ID, node credential, API key, runtime PID, cache, upload, or incident ledger entered either canary root.

---

## F. Large-State Fixture

1. **Generate deterministic epoch-4 entities through `TaskCurrentStateStore.mutate()`.** Do not manufacture storage files or bypass entity validation.
2. **Meet all fixed thresholds:** at least `20,000` entities, all `256` bucket names represented, more than `64` bounded entity frames, more than `8 MiB` of encoded entity payload, and at least `32 MiB` of durable task-current state.
3. **Use stable identities.** Entity IDs derive from an integer sequence and a fixed seed. Continue generating until every bucket is populated and every threshold is satisfied.
4. **Record the fixture authority:** seed, entity count, bucket counts, encoded bytes, frame count, source root, generation time, and file hashes.
5. **Do not impose a total replay cap that truncates valid epoch-4 synchronization.** The flood correction bounds each bucket to one read per relay-root generation while allowing the complete first repair to finish.

---

## G. Pre-Patch Flood Proof

1. **Healthy control first:** connect both nodes, subscribe Canary B to Canary A's project, and prove the complete large state converges once. Assert equal roots, equal entity counts, equal entity hashes, all `256` buckets, and persistence after closing and reopening Canary B's store.
2. **Create permanent divergence at the transport boundary.** Place a loopback WebSocket fault proxy only between Canary B and the relay. Drop the entity batch containing one deterministic sentinel entity while forwarding every other entity batch and every terminal summary. Canary B continues using the real store and merge implementation.
3. **Trigger one repair.** Canary B subscribes to Canary A's project and receives the relay summary.
4. **Capture the repeating transition.** Count `state-bucket-summary`, `state-missing-request`, `state-entity-batch`, bucket scans, entity rows read, outbound bytes, and participant deliveries at their emission or storage boundary.
5. **Prove the bug:** within the bounded observation window, the same relay root and requested-bucket digest produce at least two missing requests, at least two reads of one identical bucket, at least two terminal summaries, and increasing outbound bytes without any root change.
6. **Prove fan-out separately:** keep a healthy control subscriber connected and assert that unchanged repair summaries reach it even though relay durable state does not change.
7. **Preserve the failing mechanism as a regression that initially fails.** The permanent test assertion is one admitted repair per root generation; it must fail against unpatched `dev` and pass after the patch.

---

## H. Minimal Patch Contract

1. **Node repair ownership:** replace `activeRepairRequests` in `federation-task-state-replicator.ts` with one record per peer and project containing the observed relay root and canonical manifest digest. An identical summary performs no publication. A summary proving local-root equality emits `state-converged` and settles the record.
2. **Relay root generation:** maintain a durable integer generation per project. Increment it only when `persistStateEntities()` commits at least one changed entity. Restore it with relay state after restart.
3. **Relay repair ownership:** maintain one durable record per authenticated node, project, and relay-root generation. Store the admitted peer-manifest digest and a `256`-bit served-bucket set inside that record.
4. **Bucket admission:** validate every requested name against lowercase `00` through `ff`, reject the complete request before storage work when any name is invalid, de-duplicate valid names, and read each canonical bucket at most once per repair record.
5. **Duplicate suppression:** an identical summary performs zero bucket-summary scans and zero broadcasts. A repeated missing request reads and sends only buckets not already charged to the current repair record. When no unserved bucket remains, it performs no storage read and sends no state frame.
6. **Change-only summary emission:** a received peer summary can produce a response only to its sender. Project-wide summaries are emitted only after a transaction changes the durable relay root. Existing entity-batch fan-out remains scoped to project participants.
7. **Reconnect behavior:** repair records remain durable across socket replacement. Reconnecting with the same authenticated node ID and unchanged relay-root generation does not reset served buckets.
8. **Compatibility:** do not add a frame type, change the state protocol, change schema `4`, add empty buckets to the sparse manifest, require a cursor, cap total valid first-repair bytes, or require a migration.
9. **Shared implementation:** put key derivation, manifest digesting, bucket validation, served-bucket accounting, and transition decisions in one pure `federation-repair-guard` module. Cloudflare Durable Object storage and the Termux state document provide persistence adapters.
10. **Code comments:** every added or modified branch receives adjacent `WHAT:` and `WHY:` comments according to the repository contract.

---

## I. Post-Patch Proof

1. **Repeat the pre-patch permanent-divergence scenario without changing its fixture, thresholds, fault injection, observation window, or assertions.**
2. **Assert quiescence:** one admitted repair, one read per requested bucket, no repeated terminal summary, no unchanged participant broadcast, and stable counters for at least `2 seconds` after the final admitted frame.
3. **Reconnect Canary B.** Assert the same relay-root generation produces zero additional bucket reads, entity frames, and participant summaries.
4. **Advance Canary A by one durable entity mutation.** Assert the relay generation increments once and exactly one new bounded repair becomes eligible.
5. **Restore Canary B's real merge effect and repeat large-state synchronization from an empty replica.** Assert complete entity equality, exact sparse-manifest equality, equal roots, all thresholds, and persistence after fresh reload.
6. **Run the unaffected-project proof concurrently.** Canary B's independent control project must remain readable and must receive no frames or scan attribution from Canary A's adversarial repair.
7. **Run the complete matrix against both relay transports.** A transport is not accepted from shared-module unit coverage alone.

---

## J. Permanent Test Inventory

1. **`backend/test/unit/federation/federation-task-state-replicator.test.ts`:** identical relay summaries create one missing request; local equality emits convergence and settles the node record; changed relay root admits one new repair.
2. **`federation-relay/test/relay-flood-proof.test.ts`:** real `FederationRelayV4`, two real node processes, loopback sentinel fault proxy, copied-state fixture, large healthy convergence, permanent divergence, duplicate summary suppression, repeated missing-request suppression, reconnect retention, root-generation release, and unaffected participant isolation.
3. **`federation-relay/test/termux-local-relay.node.test.ts`:** execute the same shared scenario against the local relay process and verify persistence across relay restart.
4. **`federation-relay/test/federation-repair-guard.test.ts`:** canonical manifest digests, canonical bucket validation, duplicate accounting, cumulative served-bucket accounting, generation changes, and deterministic durable serialization.
5. **Retain raw mechanism counters in assertion failures.** A failed test reports root generation, node, project, manifest digest, served buckets, scan count, row count, frame count, and outbound bytes.

---

## K. Verification Sequence

1. **Baseline:** run the retained flood regression against unpatched `dev` through `node bin/decision-os-verify.mjs`; preserve the intentional failure showing repeated work.
2. **Focused patch checks:** run the repair-guard unit test, node-replicator unit test, Worker flood-proof test, and Termux flood-proof test through the repository verification lease.
3. **Typechecks:** run the backend and federation-relay typechecks once after source stabilization.
4. **Complete suites:** run the complete backend suite at `--test-concurrency=1` and the complete federation-relay suite once.
5. **Evidence:** use `trace-evidence start-tests` only for the fixed Worker and Termux flood-proof files, wait for `evidence_ready`, then wait for `complete`. Preserve the job IDs and use their emission-time counters for the causal report.
6. **Diff review:** review every changed path and hunk, verify no staged operator hunk was touched, and confirm the canary run manifest contains no production credential or endpoint.
7. **Cleanup:** terminate only recorded temporary process groups, verify their ports are closed, retain the automated tests and intended documentation, and delete generated canary roots, relay state, logs, and temporary evidence copies.

---

## L. Acceptance Criteria

1. **The bug is reproduced before modification** by repeated identical repair work with no root change.
2. **The patched permanent-divergence run becomes idle** after one repair attempt for the relay-root generation.
3. **Every canonical bucket is read at most once** per authenticated node, project, and relay-root generation, including after reconnect.
4. **Healthy nodes receive no unchanged-summary fan-out.**
5. **The complete large state synchronizes** with exact entity, sparse-manifest, and root equality and remains equal after Canary B reloads.
6. **Cloudflare and Termux pass the identical behavioral matrix.**
7. **Epoch 4 remains compatible:** protocol, schema, frames, and root hashing do not change.
8. **Production remains untouched:** no production relay request, server restart, browser interaction, credential reuse, or durable-state mutation occurs.

---

## M. Operator Decision Summary

1. **Proceed with one isolated two-node canary harness and one shared repair guard.** The proof first demonstrates the existing loop, then demonstrates quiescence and full large-state convergence after the patch.
2. **Keep the patch narrow.** This iteration does not add protocol pagination, a global publication queue, a new incident workflow, a state migration, or a production deployment.

---

## N. Executed Evidence

1. **Baseline flood reproduced against untouched `dev`.** Trace job `trace-1785842500577-d1967b2e-12e` ran the retained permanent-divergence canary with the implementation root pinned to `.worktrees/dev`. One deliberately dropped sentinel produced `32` identical missing requests and `31` repeated sentinel replays before the fixed safety ceiling stopped the node.
2. **The same test became quiescent after the patch.** Trace job `trace-1785842522612-1fc0c41e-dcf` used the same fixture and fault boundary against the iteration worktree. It produced exactly `1` missing request and `1` sentinel replay; reconnect produced no additional request, replay, or unchanged observer summary.
3. **The copied Decision OS state synchronized between two real node runtimes.** Trace job `trace-1785842548381-783b4a92-ae2` copied the source epoch-4 `format.json` and `current/` tree into Canary A, opened it through `TaskCurrentStateStore`, expanded `7,160` source entities to `20,000` through `mutate()`, and transferred it through the isolated Termux relay to Canary B.
4. **Huge-state thresholds passed.** The encoded active state was `44,253,149` bytes across all `256` buckets. Canary A and a freshly reloaded Canary B both produced root `92d77b84cf276dbf7c9665eea7516a4838a0da77ea0d0c7d94a1d673723883ad` with `20,000` entities.
5. **Worker large-state coverage passed.** Trace job `trace-1785842183203-be7f4e60-850` transferred `20,000` entities larger than `32 MiB` through `FederationRelayV4` in more than `64` bounded frames and passed duplicate-summary plus reconnect bucket-suppression coverage.
6. **Repository verification passed.** Backend typecheck passed; federation-relay typecheck passed; the complete Worker suite passed `14/14`; the complete backend suite passed `721/721`; the focused node replicator suite passed `18/18`; and the normal Termux suite passed its three enabled tests.
7. **Production isolation held.** The canaries used operating-system-assigned loopback ports, generated credentials, temporary relay files, and temporary task-state roots. The registered Decision OS servers, production relay, browser, and source state were not mutated.
