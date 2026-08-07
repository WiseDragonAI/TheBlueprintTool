## A. Delivery Authority

1. `bin/decision-os-delivery.mjs`, published as `decision-os-delivery`, is the only end-to-end production release authority.
2. The CLI owns six fixed commands: `bootstrap-node`, `candidate`, `promote`, `status`, `resume`, and `rollback`.
3. `promote` admits one canonical published release-tag pair, deploys one production relay version, activates the configured coordinator node, restarts it through its adopted supervisor, and proves release identity plus federation convergence.
4. Do not use the primary checkout as a release directory. Delivery creates immutable release worktrees and leaves primary checkouts, unrelated working-tree bytes, and staged operator hunks untouched.
5. A production mutation is forbidden until the run journal contains the successful `admit-exact-release` receipt for the requested SHA.

---

## B. Fixed Topology And Inputs

1. The admission topology is fixed:
   1. Production coordinator: `http://127.0.0.1:50150`
   2. Canary application: `http://127.0.0.1:50151`
   3. Dev relay health: `http://127.0.0.1:50152/health`
   4. Production project discovery excludes `.worktrees/dev`.
2. Run the CLI from the catalog root. It reads these fixed local files:
   1. Settings: `<catalog-root>/.decision-os/.settings.json`
   2. Candidate proof input: `<catalog-root>/.decision-os/delivery/candidate-input.json`
   3. Candidate evidence: `<catalog-root>/.decision-os/delivery/candidate-evidence.json`
   4. Bootstrap input: `<catalog-root>/.decision-os/delivery/bootstrap-node.json`
3. CLI flags cannot supply a repository path, release root, relay URL, Cloudflare token, SSH key, node capability, supervisor command, port, environment, evidence path, and recovery path.
4. The ignored settings file owns `deliveryRepositoryRoot`, `deliveryReleaseRoot`, `deliveryCurrentPointer`, `deliveryCandidateCurrentPointer`, `deliveryDecisionOsRoot`, `deliveryNodeId`, `deliverySupervisorProfile`, `deliverySupervisorAdopted`, `deliverySupervisedExit`, `deliveryEmergencyHealth`, `deliveryLocalDispatchToken`, `projectSyncGitSshIdentityFile`, and `federationRelayUrl`.
5. `projectSyncGitSshIdentityFile` is an absolute non-interactive Wise SSH identity. Delivery uses `BatchMode=yes` and disables terminal prompting.
6. Cloudflare delivery is always non-interactive. The CLI first reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from its process environment, then fills missing values from `<deliveryRepositoryRoot>/.env`. On the production workstation the fixed file is `/home/jbb/dev/EditorBP/decision-os/.env`; both credentials are already present, the file is mode `0600`, and Git proves it ignored.
7. Never run `wrangler login`, invoke a Wrangler command that opens a browser, or ask the operator to authenticate Cloudflare through a URL. `delivery_relay_credentials_missing` and Cloudflare authentication rejection are configuration failures and stop delivery.
8. Verify credential presence without printing values. Never print, log, copy, commit, or write either value into candidate evidence, journals, receipts, and incident context.
9. Production Cloudflare mutation runs only through `node bin/decision-os-delivery.mjs promote ...`. The runtime passes the loaded credentials to the repository-pinned Wrangler process; direct Wrangler deployment and rollback commands are not the routine release path.

---

## C. One-Time Node Bootstrap

1. Bootstrap input has this exact owner-controlled shape:

   ```json
   {
     "nodeId": "workstation",
     "decisionOsRoot": "/absolute/catalog/.decision-os",
     "repositoryRoot": "/absolute/decision-os",
     "releaseRoot": "/absolute/decision-os-releases",
     "initialCommit": "<40-character-main-sha>",
     "supervisorProfile": {
       "profile": "multiterm-workstation-v1",
       "managerCommand": "/home/jbb/dev/multiterm/bin/multiwezterm-process",
       "catalogRoot": "/absolute/catalog-root",
       "port": 50150,
       "url": "http://127.0.0.1:50150/",
       "name": "decision-os-workstation",
       "description": "Decision OS production server",
       "automaticRestart": true
     }
   }
   ```

2. Run:

   ```bash
   node /absolute/decision-os/bin/decision-os-delivery.mjs bootstrap-node --json
   ```

3. The workstation adapter prepares `releases/<initialCommit>`, atomically initializes `current`, registers MultiTerm with `--cmd "env PORT=50150 <release-root>/current/bin/decision-os-server.mjs"`, preserves port `50150`, requires automatic restart, and writes protocol-1 settings with mode `0600`.
4. Bootstrap uses `--no-launch`. It adopts the supervisor definition without starting, stopping, and restarting the live server inside the bootstrap command.
5. The implemented adapter accepts node ID `workstation` and supervisor profile `multiterm-workstation-v1`.
6. A non-workstation node requires a validated node-owned supervisor adapter. The current CLI returns `unsupported_supervisor_profile` for the phone; do not infer its service manager, stop command, start command, catalog root, and automatic-restart behavior.
7. Production promotion requires only the configured workstation coordinator. Phone and other federation-node supervisor records are outside production delivery admission.

---

## D. Immutable Node Layout

1. `deliveryReleaseRoot` is absolute and contains:
   1. `releases/<mainSha>` — detached immutable Git worktree for one release
   2. `current` — stable symlink to one directory below `releases/`
   3. `release-operation.lock` — finite process-identity node-operation lease
2. `deliveryCurrentPointer` names the stable `current` symlink. The launcher and normal plus emergency `/api/health` report `releaseSha`, `processStartedAt`, `deliveryProtocol`, and `activeReleasePointer`.
3. Node receipts are stored below the stable ignored settings root at `<deliveryDecisionOsRoot>/delivery/nodes/<deliveryId>.json`.
4. One receipt document preserves every exact `{deliveryId, action, targetCommit, expectedCommit}` action. A duplicate exact command returns its immutable receipt without repeating the mutation.
5. Invalid receipt and release-operation bytes remain in place, pause only the node delivery scope, and create an incident. Recovery requires explicit identity-matched reconciliation.
6. An existing `accepted` receipt is not blindly replayed. The node reconciles its exact operation lease and live pointer: a live owner remains locked; a completed target becomes one terminal receipt without another mutation; a settled predecessor permits the same immutable operation to retry; a different pointer fails closed.

---

## E. Canary Candidate Evidence

1. Complete [Canary Skill Authoring Dev Environment](./canary-skill-authoring-dev-environment.md) before creating candidate evidence.
2. Invoke the exact fixed preparation command:

   ```bash
   node bin/decision-os-delivery.mjs candidate \
     --release-tag rel-X.Y.Z \
     --json
   ```

3. `candidate` resolves the paired `rel-X.Y.Z` and `devrel-X.Y.Z` tags, requires them to identify the fetched `origin/main` and `origin/dev` heads, and verifies their exact canonical merge graph. It accepts no SHA, topology, credential, evidence path, marker path, pointer path, server, and environment flag.
4. The command creates or validates the ignored source-owned `.decision-os-release.json` marker and `deliveryCandidateCurrentPointer` only after the candidate is clean and pushed. A dirty development checkout has `releaseSha: ""`, `deliveryProtocol: 0`, and `activeReleasePointer: "unbootstrapped"`; it is not admitted release evidence.
5. `writeDeliveryCandidateEvidence()` is the sole persistence owner for the ignored `<catalog-root>/.decision-os/delivery/candidate-evidence.json` bundle. The `candidate` command calls it atomically without acquiring a delivery lease, creating a run, and creating a journal.
3. Candidate evidence has this top-level shape:

   ```json
   {
     "protocol": 1,
     "releaseSha": "<exact-origin-dev-sha>",
     "relayConfiguration": {},
     "nodeEvidence": [],
     "proofs": []
   }
   ```

4. `relayConfiguration` contains `observedAt`, SHA-256 `configurationHash`, `wranglerVersion: "4.111.0"`, `productionWorkerName`, `devWorkerName`, `productionDurableObjectNamespace`, and `devDurableObjectNamespace`.
5. `proofs` contains exactly one fresh `passed` receipt for each name: `authoring`, `editor`, `direct-path`, `prompt-execution`, and `federation`. Every receipt contains the exact `releaseSha`, `observedAt`, and `receiptId`.
6. `nodeEvidence` records the settings-owned `deliveryNodeId` coordinator observed during candidate proof. Unrelated federation nodes do not participate in production admission. The record contains:
   1. `nodeId`, `observedAt`, and exact `projectIds`. Delivery project identity includes only projects with a verified repository-origin fingerprint; node-local projects remain served but do not enter federation convergence.
   2. `release` with ready health, predecessor `releaseSha`, `processStartedAt`, `deliveryProtocol: 1`, `activeReleasePointer`, and zero `activeIncidentCount`
   3. `federationPhase: "connected"`
   4. Zero `activeExecutionCount`, `pendingExecutionCount`, `pendingProcessQueueDepth`, `pausedScopeCount`, and `fatalIncidentCount`. `pausedScopeCount` includes only paused server-fatal, `delivery:*`, and `delivery-dependency:*` incidents; unrelated contained incidents remain diagnostic and do not block delivery.
   5. Zero `stateRuntimeDirtyCount`, `statePendingDeliveryCount`, `contentQueueDepth`, and `unavailableContentResourceCount`
   6. `convergedProjectIds` exactly equal to the node's synchronizable `projectIds`
7. `promote` independently reads live production topology, selects only the settings-owned `deliveryNodeId`, and collects its fresh authenticated `status` response. A missing or offline coordinator rejects admission; unrelated online and offline federation nodes are ignored.
8. Candidate, topology, health, relay, node, and proof timestamps must be within the admission freshness window. The default maximum age is five minutes.
9. Before `promote`, publish the exact merge and release tags created by `decision-os-merge-dev`. `promote` re-fetches `origin/main` and `origin/dev`, proves the requested SHA equals `origin/dev`, proves `origin/main` has exactly the prior main and requested dev parents in canonical order, proves the protected `.decision-os` gitlink is unchanged, proves the release worktree is clean, rejects active Git operations, and binds the result to the candidate evidence SHA.

---

## F. Admission Receipt

1. `promote` reads:
   1. `GET http://127.0.0.1:50150/api/delivery/admission-state`
   2. `GET http://127.0.0.1:50151/api/delivery/admission-state`
   3. `GET http://127.0.0.1:50152/health`
   4. `GET http://127.0.0.1:50150/api/federation/nodes`
   5. Authenticated `POST http://127.0.0.1:50150/api/federation/nodes/:nodeId/delivery` with action `status` for the settings-owned coordinator
2. Production delivery health must identify the exact first-parent predecessor of the requested `origin/main` merge. Canary and dev relay health must identify the requested `origin/dev` SHA.
3. Dev relay health must report `deliveryProtocol: 1`, `protocolVersion: 1`, the current task-state protocol/schema/baseline, `environment: "dev"`, and the source-defined dev Worker plus Durable Object namespace.
4. Production and dev Worker identities and Durable Object namespaces must differ. Relay configuration must identify pinned Wrangler `4.111.0`.
5. Only the settings-owned coordinator is a production delivery target and must be online. Unrelated federation nodes do not enter admission or activation.
6. The target node set and project origin fingerprints are frozen. A later identity, project set, origin, and membership change returns `delivery_topology_changed`.
7. The durable admission receipt records the evidence hash, topology fingerprint, production SHA, canary SHA, dev relay SHA, relay configuration hash, active-node count, and zero-project-node count before `main` promotion.
8. Any admission rejection exits `2` before `main` push, relay upload, release preparation, pointer change, supervised exit, and restart.

---

## G. Promote

1. Invoke the exact fixed command:

   ```bash
   node bin/decision-os-delivery.mjs promote \
     --release-tag rel-X.Y.Z \
     --server http://127.0.0.1:50150 \
     --json
   ```

2. `--json` is required. `--server` accepts only `http://127.0.0.1:50150`. `--release-tag` is the sole release selector; direct SHA input is rejected.
3. The CLI acquires the delivery lease and shared repository mutation lock, creates the journal, performs read-only Git preflight, and writes the admission receipt before production mutation.
4. Forward execution order is fixed:
   1. Verify Cloudflare credential presence and the ignored credential-file boundary, then list and record the current production relay deployment plus exact predecessor version.
   2. Durably record the already-published exact `mainSha`, its canonical parents, and its protected gitlink without creating a worktree and without running `merge`, `commit`, `tag`, or `push`.
   3. Prepare the immutable `mainSha` release on every admitted node.
   4. Upload the production relay version and record its version ID.
   5. Activate the uploaded relay version at `100%` and verify release/protocol health.
   6. Activate remote nodes in stable node-ID order.
   7. Activate the coordinator last.
   8. Immediately after each durable activation receipt, persist the node as `active` and append it to `activationOrder` before restart, health, catalog, federation, and convergence verification. A later verification failure therefore includes that mutated node in reverse-order compensation.
   9. Require a changed process identity, ready catalog, connected federation, exact active SHA, exact release pointer, and convergence after each node restart.
   10. Re-read `origin/main`, verify its exact merge parents and protected gitlink, list Cloudflare deployments and tagged versions, read live relay health, query authenticated fresh status from every node, re-read topology and convergence, and persist `complete` only when every authority agrees.
5. Every external admission collection, relay verification, node verification, final authority read, final verification, and mutation has one durable `started` receipt before invocation and one terminal receipt before dependent progress. Pure local parsing and journal reads do not create redundant phase receipts.
6. Retrying a phase preserves its deterministic started-receipt identity, increments the bounded attempt record, refreshes the finite deadline, and fails closed after the maximum attempt count.

---

## G.1 Release Tag Ownership

1. The standalone `decision-os-merge-dev` workflow solely owns the main merge and annotated parent plus child `rel-*` and `devrel-*` tags.
2. Publish the exact main merge and its tags before invoking production delivery. Production delivery never creates, moves, or pushes Git refs.
3. Production rollback authority is the exact published `mainSha`, delivery journal, Cloudflare predecessor version, and node predecessor receipts.
4. The production node must run the requested release tag's exact first-parent predecessor before candidate admission. When published releases were skipped, advance the node through authenticated protocol-1 `prepare` and `activate` receipts until it reaches that predecessor; this alignment does not deploy the Cloudflare Worker.

---

## H. Status And Exit Contract

1. Read one journal without mutation:

   ```bash
   node bin/decision-os-delivery.mjs status --delivery-id <deliveryId> --json
   ```

2. The single-line JSON summary includes `protocol`, `deliveryId`, `admittedSha`, `priorMainSha`, `mainSha`, `phase`, `status`, `exitCode`, `topologyFingerprint`, relay identities, node identities, activation order, failure, and `updatedAt`.
3. Exit codes are fixed:
   1. `0` — durable `complete`
   2. `2` — usage/admission rejection; no production mutation was admitted
   3. `3` — `paused`, `partial`, `rolled-back-runtime`, interrupted/runtime failure, and non-compensation CLI failure
   4. `4` — `compensation-failed`
4. `rolled-back-runtime`, `paused`, `partial`, and `compensation-failed` are not success.

---

## I. Resume

1. Resume one exact journal:

   ```bash
   node bin/decision-os-delivery.mjs resume --delivery-id <deliveryId> --json
   ```

2. An expired lease is never stolen by a new promotion. Only matching `resume` may replace it after proving the owning process identity is absent.
3. Resume validates the journal, admitted SHA, immutable topology, repository authority, lease identity, relay deployment, node pointers, per-action receipts, process identities, health, and convergence.
4. A stale request acknowledgement and journal-derived healthy fallback are not proof. Live reconciliation re-fetches Git refs and verifies exact merge parents plus ancestry, lists Cloudflare deployments and tagged versions, reads relay health, and issues an authenticated fresh `status` command to every node.
5. Node `status` bypasses duplicate receipt replay, re-reads the active pointer and runtime evidence on every request, and returns the matching terminal `prepare`, `activate`, and `rollback` receipt references.
6. Confirmed operations are not repeated. An interrupted compensation resumes compensation; it does not resume forward delivery.
7. Corrupt journal, lease, receipt, and incident evidence remains byte-identical. The owning delivery pauses and requires validated recovery.

---

## J. Rollback

1. Request runtime rollback for one journal outside the blocked status set: `complete`, `admission-rejected`, and `rolled-back-runtime`.

   ```bash
   node bin/decision-os-delivery.mjs rollback --delivery-id <deliveryId> --json
   ```

2. Rollback first reconciles durable receipts with freshly observed Git, relay deployment, relay health, authenticated node status, pointer, process, health, topology, and convergence authority.
3. Runtime rollback order is exact:
   1. Restore activated nodes in reverse `activationOrder`.
   2. Verify each predecessor pointer, changed process identity, ready catalog, connected federation, and convergence.
   3. Restore the recorded predecessor relay version.
   4. Verify deployment metadata identifies that predecessor version, then query live relay `/health` and require its exact predecessor `releaseSha`, delivery protocol `1`, compatible state protocol, and `environment: "production"`.
4. Rollback never force-pushes and never rewinds published `main`. The failed merge remains auditable; the next release requires a corrective reviewed commit.
5. Successful compensation ends as `rolled-back-runtime` with exit `3`. A failed compensation records a delivery-scoped incident, ends as `compensation-failed`, retains the delivery lease for matching `resume`, and exits `4`.

---

## K. Durable Evidence And Incidents

1. Coordinator journal: `<catalog-root>/.decision-os/delivery/runs/<deliveryId>.json`.
2. Coordinator lease: `<catalog-root>/.decision-os/delivery/lock`.
3. Node receipt index: `<deliveryDecisionOsRoot>/delivery/nodes/<deliveryId>.json`.
4. Runtime incident ledger: `<catalog-root>/.decision-os/runtime-incidents.json`; node-scoped delivery incidents use the node's stable Decision OS root.
5. Journals, receipts, and leases use sibling temporary files, file synchronization, directory synchronization, and atomic rename.
6. The lease is released only for `complete`, `admission-rejected`, and `rolled-back-runtime`. `paused`, `partial`, and `compensation-failed` retain it for matching `resume`.
7. A live lease rejects another delivery. Resume requires matching delivery ID and SHA, absent owner process, valid journal, and positive live reconciliation.
8. Incident evidence records delivery scope, component, phase, operation, stable code, message, stack, delivery ID, node ID, release SHA, timestamps, and occurrence count.
9. Inspect `status`, the journal, node receipt indexes, `/api/health`, `/api/diagnostics/incidents`, `/api/delivery/admission-state`, `/api/federation/nodes`, and `/api/federation/replication-status` before selecting resume or rollback.

---

## L. Node Transport Boundary

1. Coordinator dispatch uses `POST /api/federation/nodes/:nodeId/delivery` with a settings-owned local bearer capability.
2. Remote delivery uses authenticated federation transport to `POST /api/internal/delivery`. The connector mints a target-bound, request-bound, one-use capability; caller-supplied delivery-capability headers are removed.
3. Both endpoints accept only:

   ```json
   {
     "deliveryId": "<stable-id>",
     "action": "prepare",
     "targetCommit": "<40-character-sha>",
     "expectedCommit": "<40-character-sha>"
   }
   ```

4. `action` is `preflight`, `prepare`, `activate`, `status`, or `rollback`. The request cannot contain a shell command, filesystem path, port, URL, environment value, credential, process command, and supervisor instruction.
5. Request bodies are limited to `4096` bytes. Delivery HTTP requests have a `30,000` ms deadline; remote delivery responses are limited to `64 KiB`.
6. Client disconnect, response close, server close, federation replacement, timeout, and operator cancellation propagate through request parsing, federation transport, bounded Git, release preparation, relay operations, and node commands.
7. Git, Wrangler, dependency, and supervisor processes have finite deadlines, bounded output, process identity, cancellation, `SIGTERM`/`SIGKILL` escalation, and guaranteed settlement.
8. One recursive delivery redactor applies to nested errors, contexts, receipts, command evidence, and CLI JSON. Tokens, authorization values, private-key references, API tokens, bearer values, sensitive arguments, physical recovery paths, and unbounded stdout/stderr are excluded or redacted.

---

## M. Relay Authority

1. Routine relay list, version upload, activation, health verification, and rollback belong to the delivery CLI.
2. The delivery helper executes pinned Wrangler `4.111.0` with fixed argument arrays from the immutable release worktree.
3. Direct Wrangler use is limited to read-only diagnosis and operator-directed recovery after preserving the delivery journal and incident evidence. It is not a parallel deployment procedure.
4. Relay-specific boundaries are documented in [Federation Relay](../../../federation-relay/README.md).

---

## N. Canary Cleanup Boundary

1. Canary cleanup removes only the `dev` application on `50151`, local dev relay on `50152`, and retained dev-only state after evidence capture.
2. Canary cleanup never stops production `50150`, changes a production node pointer, deploys relay traffic, edits a delivery journal, and substitutes for `decision-os-delivery rollback`.
3. Use [Canary Skill Authoring Dev Environment](./canary-skill-authoring-dev-environment.md) for dev cleanup and this runbook's rollback command for an admitted production delivery.
