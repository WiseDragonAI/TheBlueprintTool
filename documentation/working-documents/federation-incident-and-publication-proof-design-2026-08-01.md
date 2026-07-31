## A. Repository Intent

1. **Local authority:** authored skills and runtime diagnostics become durable locally before federation work begins.
2. **Scoped containment:** invalid federation metadata, failed diagnostic persistence, and unacknowledged publication must retain exact evidence without stopping unrelated routes or projects.
3. **Bounded convergence:** peer verification must use finite deadlines, single-flight ownership, and bounded request counts.

---

## B. Current Iteration Intent

1. **A3:** keep an invalid retained federation project catalog byte-identical, expose an active owning incident, and resume only after an explicit successful reread and validation.
2. **A4:** retain incident evidence in the live diagnostic projection when the incident ledger cannot be written, then provide an explicit persistence retry that settles the diagnostic scope only after the write succeeds.
3. **A5:** distinguish local authored-skill durability from peer publication by requiring one remote node to acknowledge the exact imported skill revision.
4. **Excluded states:** ordinary absence of online peers and ordinary relay disconnection remain connection status, not standalone runtime incidents.

---

## C. First Incorrect Transitions

1. **A3 catalog classification:** `createFederationNodeConnector()` reports `read-retained-project-catalog` through `recordStoppedOperation()`, which immediately resolves the incident although `catalogWritable` remains false and the remote catalog remains disabled.
2. **A4 diagnostic durability:** `createRuntimeIncidentLedger().record()` catches a failed `persist()` and returns the new incident, but the next `read()` reloads the older durable document and loses the live incident from diagnostics.
3. **A5 publication authority:** `publishAuthoredSkill()` resolves publication after local pull synchronization. That transition proves neither remote import nor acknowledgement of the authored revision.

---

## D. File And Symbol Changes

1. **`backend/src/business/federation/helper/federation-node-connector.ts` — `loadRetainedCatalog()` and `recoverRetainedCatalog()`. WHAT:** parse into a candidate map, install only a fully valid catalog, preserve invalid bytes, and expose explicit revalidation. **WHY:** a resolved diagnostic cannot coexist with a process-lifetime disabled catalog.
2. **`backend/src/business/federation/runtime/federation-connection-runtime.ts` — connector `onError`. WHAT:** route retained-catalog read and persistence failures to `recordBackgroundFailure('federation-project-catalog', ...)`; keep stopped-operation treatment for transient connector operations. **WHY:** the catalog failure continues affecting availability after the callback returns.
3. **`backend/src/business/server/runtime/resume-background-runtime.ts` and `runtime-recovery-service.ts` — background recovery dispatch. WHAT:** call `recoverRetainedCatalog()` before resolving `background:federation-project-catalog`. **WHY:** recovery must validate and install durable state before reopening the component.
4. **`backend/src/business/server/helper/runtime-incident-ledger.ts` — `retainPersistenceFailure()` and `recoverPersistence()`. WHAT:** install a bounded in-memory `runtime-incident-ledger` incident when persistence fails, serve the pending document through diagnostics, and persist its resolved form only through explicit recovery. **WHY:** a diagnostic storage outage must not erase the incident it prevented from being written.
5. **`backend/src/business/server/runtime/runtime-recovery-service.ts` — `runtime-incident-ledger` recovery dispatch. WHAT:** invoke the ledger persistence recovery before reporting incident resolution. **WHY:** operator recovery must be coupled to successful durable installation.
6. **`backend/src/business/federation/helper/federated-library-cache.ts` — `federatedSkillReceipt()`. WHAT:** validate a safe skill identity and return whether the installed imported marker and local package revision equal the requested revision. **WHY:** normal export manifests intentionally exclude imported packages and cannot serve as peer receipts.
7. **`backend/src/business/federation/http/library-routes.ts` — `POST /api/federation/skills-receipt`. WHAT:** authenticate the source-node identity, pull only the named source snapshot, import only the exact requested revision, and return its installed receipt. **WHY:** the authoring node needs deterministic peer installation proof without a full-library synchronization fan-out.
8. **`backend/src/business/federation/runtime/federated-library-runtime.ts` — `receivePublishedSkill()`, `acknowledgePublishedRevision()`, and `publicationFlights`. WHAT:** perform at most three sequential targeted receipt commands, accept the first exact acknowledgement, deduplicate concurrent publication by skill revision, suppress superseded revisions, and persist failure only after an online peer exhausts the bounded attempts. **WHY:** publication success must be peer-proven without flooding the relay or misclassifying ordinary no-peer state.
9. **Focused tests. WHAT:** inject invalid catalog recovery, incident-ledger write failure and retry, exact/mismatched receipts, acknowledgement retry, duplicate publication, and missing acknowledgement. **WHY:** each regression must fail at its first incorrect transition and prove containment plus final authority.

---

## E. Acceptance Evidence

1. **A3:** invalid catalog bytes remain unchanged; an active background incident exists; valid replacement bytes install only after explicit resume; the incident then resolves.
2. **A4:** failed writes remain visible through `active()` and `snapshot()`; durable bytes remain unchanged; explicit recovery persists both the original incident and the resolved diagnostic-storage incident.
3. **A5:** publication resolves only after one peer returns `acknowledged: true` for the exact revision; mismatch remains an active publication incident; duplicate requests for one revision share a single bounded flight.
4. **Traffic bound:** one publication flight makes no more than three sequential receipt requests and does not invoke full local library synchronization.
5. **Verification:** focused tests, package typechecks, complete backend and frontend suites, and the Linux Chromium test run through `node bin/decision-os-verify.mjs -- ...`.

---

## F. Operator Decision Summary

1. **Selected correction:** persist continuing outages as active scopes and replace inferred publication with exact revision acknowledgement.
2. **No new state store:** the connector, incident ledger, imported-skill marker, and existing internal federation request transport remain authoritative.
3. **No relay flood:** publication acknowledgement is sequential, revision-deduplicated, and capped at three requests.

---

## G. Verification And Failure RCA

1. **Focused proof:** all `40` causal backend tests pass for catalog recovery, incident fallback, exact receipt import, acknowledgement deduplication, and existing authoring behavior.
2. **Complete verification:** backend and frontend typechecks pass; the complete backend suite passes `686/686`; the complete frontend suite passes; the isolated Linux Chromium file passes all `6` scenarios.
3. **Implementation failure:** one patch inserted `federation` twice in a destructuring declaration. The correction moved the existing binding into the recovery-service input without redeclaration.
4. **Fallback failure:** the first pending-ledger writer omitted creation of its `runtime/` parent. The correction creates that directory inside the protected atomic-write boundary.
5. **Expectation drift:** two tests expected immediate publication failure. No-peer now correctly produces no incident; attempted online-peer failure waits for the bounded acknowledgement retries before asserting the incident.
6. **Browser isolation failure:** the original browser helper launched temporary servers from the real repository root, loading live federation settings and producing real workspace mutations. The corrected helper copies authored fixture state into one temporary workspace, excludes local settings and runtime paths, and leaves repository status unchanged after the browser run.
7. **Publication deduplication failure:** the in-flight key was deleted when the first receipt settled, so a duplicate callback that finished Git indexing afterward could open a second request for the already acknowledged revision. The runtime now retains the acknowledged revision per skill; the regression invokes publication again after settlement and still proves one peer request.
8. **Test-runner load failure:** the first complete backend command used three-way file concurrency. Backend integration files create servers, Git repositories, and child processes, so the visible test concurrency multiplied into excessive workstation load. `AGENTS.md` now records the direct leased backend command with `--test-concurrency=1` and prohibits the opaque npm test wrapper for the complete backend suite.
9. **Relative tsconfig tooling failure:** the first single-concurrency command supplied a relative `TSX_TSCONFIG_PATH`; fixtures that launch the ledger shim from a temporary cwd inherited that path and searched below the fixture, producing `45` false failures. The command now expands `$PWD/backend/tsconfig.json` before admission so every child receives one absolute configuration authority.
10. **Backend package-cwd tooling failure:** the root-cwd correction passed `685/686`; the remaining CLI test proved backend tests resolve `../bin` from the package cwd. The authoritative command combines `env --chdir=backend` with the already-expanded absolute tsconfig path.
