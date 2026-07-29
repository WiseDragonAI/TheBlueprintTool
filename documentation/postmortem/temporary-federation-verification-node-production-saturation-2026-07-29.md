# Temporary Federation Verification Node Production Saturation Postmortem

## A. Incident Summary

1. **Incident date:** `2026-07-29`.
2. **Intended check:** Determine whether an independent Decision OS node could receive thread `thread-card-282c2358-6900-4d07-96ed-febfb0238ba9` for project `ZGV2L2x5cw`.
3. **Unsafe action:** A complete Decision OS server was launched from `/tmp/decision-os-production-proof-node-N9yEOO` as node `workstation-proof-20260721`, PID `473302`, on port `45931`, then attached to the production federation.
4. **Impact:** The temporary node triggered production-wide federated library synchronization, repeated remote requests, `60,000 ms` timeouts, retries, CPU saturation, unread response backpressure, and production HTTP timeouts. MultiTerm later relaunched production on port `50150`.
5. **Containment:** The exact temporary process group was terminated. Port `45931` stopped listening. Production port `50150` returned `HTTP 200` after the registered MultiTerm server relaunched.
6. **Data boundary:** The temporary root remains available as incident evidence. No project source file was deleted to contain the load.

---

## B. Failed Invariant

1. A verification whose target is one thread must perform work proportional to that thread.
2. A diagnostic process must not join production as a new active participant when read-only production logs and isolated transport fixtures can answer the question.
3. A temporary identity must not reuse an existing project identity.
4. Test activity must not make production health, diagnostics, federation traffic, or unrelated project routes unavailable.

---

## C. First Incorrect Transition

1. The proof harness launched the complete server and supplied production federation connectivity.
2. `create-http-server.ts` calls `synchronizeFederatedLibraries()` from `onStateConnected`.
3. `performFederatedLibrarySynchronization()` requests each online peer's complete skills manifest, retrieves every missing skill snapshot, then retrieves the peer pipeline snapshot.
4. The current runtime exposes no verified startup setting that disables this automatic synchronization for a connected proof node.
5. The requested one-thread observation therefore became a complete peer-library synchronization workload before the thread evidence was inspected.

---

## D. Load Mechanism

1. The proof node requested `/api/federation/skills-manifest` from Workstation and Mobile.
2. Each owner-side federation request reached `handleOwnerRequest()` in `federation-node-connector.ts`, which fetched the owner's local Decision OS HTTP route.
3. Slow manifest generation retained the remote request until the `60,000 ms` deadline.
4. The synchronization controller retried timed-out requests and scheduled later recovery attempts.
5. Concurrent owner requests accumulated local self-connections and unread response bytes while production CPU rose above one core.
6. The proof-node incident ledger recorded `federation_request_timeout` outcomes for Workstation and Mobile manifests. Production route checks then timed out.

---

## E. Identity Collision

1. The proof node used federation node ID `workstation-proof-20260721`.
2. Its generated local project ID was `Lg`.
3. The phone catalog already advertised project ID `Lg`.
4. Explicit replica identity prevents this collision from silently merging owners, but the duplicate project identity made the proof catalog ambiguous and expanded the unrelated synchronization surface.

---

## F. Detection Gaps

1. Startup success on port `45931` was accepted before inspecting every automatic action attached to federation connection.
2. The proof process log contained only the server startup record. The expensive failures were written to the durable incident ledger, so watching stdout alone did not expose the fan-out.
3. No preflight prohibited production relay credentials in a temporary verification root.
4. No admission gate required unique project identity before federation connection.
5. No proof-harness budget constrained peer count, request count, synchronization kind, or concurrent owner requests.
6. Production latency was checked after the proof node had already initiated the complete synchronization workload.

---

## G. Prohibited Verification Pattern

1. Never attach a temporary Decision OS server to the production federation to inspect one card, thread, content object, execution, or log.
2. Never copy production federation settings into a temporary server root.
3. Never start a complete server when the requested evidence exists in the registered server log, durable incident ledger, immutable content cache, task-state entity, or source sidecar.
4. Never use an auto-generated project identity without proving it is unique across the target federation.
5. Never accept a listening socket as proof that a verification server is safe.
6. Never continue a diagnostic after it creates production timeouts, sustained CPU saturation, request accumulation, or new runtime incidents.

---

## H. Gentle Verification Procedure

1. **Resolve the exact evidence target.** Record the project ID, ledger ID, card ID, thread ID, replica owner, and expected content hash.
2. **Read the registered process log first.** Search `/home/jbb/.local/state/multiwezterm/process-logs/jbb-50150.log` for the exact card and thread IDs. For this incident, `message-extraction` records proved that production parsed the target thread and extracted its operator and agent notes.
3. **Read durable local evidence.** Inspect only the exact source sidecar, advertised content head, cached immutable object, and matching incident records. Compare SHA-256 values without requesting the complete catalog.
4. **Use the existing isolated transport fixture for cross-node behavior.** Run the focused `backend/test/server/federation-node-connector.integration.test.ts` through `node bin/decision-os-verify.mjs`. The fixture creates unique temporary projects, two synthetic nodes, an in-process relay, and bounded local HTTP servers without production relay credentials.
5. **Keep live production observation read-only.** Use the already registered production process and its existing connected peers. Do not add a node, provision a credential, change federation settings, open the complete project catalog, or invoke library synchronization.
6. **Require isolation before any future live-node harness.** The harness must use a non-production relay, unique node and project identities, automatic library synchronization disabled before connection, one exact resource request, one in-flight request, a finite deadline, cancellation, and automatic teardown.

---

## I. Containment and Recovery

1. PID `473302` and process group `473302` were resolved before signaling.
2. The exact temporary process group received `SIGTERM`.
3. The temporary PID exited and port `45931` stopped listening.
4. The production process that had been observed as PID `276172` was no longer present after the overload.
5. MultiTerm recorded a new production launch at `2026-07-29 15:35:48` and bound port `50150` with PID `559938`.
6. The recovered production root returned `HTTP 200` in `0.006690` seconds.

---

## J. Corrective Actions

1. **Complete — immediate containment:** Stop the exact temporary process group and confirm port `45931` is closed.
2. **Complete — durable prohibition:** Link this incident from `AGENTS.md` and prohibit production-attached temporary verification servers.
3. **Complete — safe current procedure:** Use exact registered logs and durable resource evidence for live checks; use the isolated connector integration fixture for transport behavior.
4. **Open — proof-harness admission:** Add a test-only harness that refuses production relay URLs and production federation IDs.
5. **Open — synchronization control:** Add a test-only startup contract that disables automatic federated library synchronization before connector startup.
6. **Open — bounded request scope:** Enforce one exact resource request, one in-flight request, finite deadline, propagated cancellation, and automatic process teardown in the proof harness.
7. **Open — identity admission:** Reject a proof node whose node ID or project ID already exists in its isolated relay catalog.

---

## K. Evidence Index

1. **Production process log:** `/home/jbb/.local/state/multiwezterm/process-logs/jbb-50150.log`.
2. **Proof process log:** `/tmp/decision-os-production-proof-node-45931.log`.
3. **Proof incident ledger:** `/tmp/decision-os-production-proof-node-N9yEOO/.decision-os/runtime-incidents.json`.
4. **Proof settings and identity:** `/tmp/decision-os-production-proof-node-N9yEOO/.decision-os/.settings.json`, `project.json`, and `projects.json`.
5. **Automatic synchronization:** `backend/src/business/server/helper/create-http-server.ts`, `onStateConnected`, `synchronizeFederatedLibraries()`, and `performFederatedLibrarySynchronization()`.
6. **Owner-side self-fetch:** `backend/src/business/federation/helper/federation-node-connector.ts`, `handleOwnerRequest()`.
7. **Safe isolated fixture:** `backend/test/server/federation-node-connector.integration.test.ts`.
