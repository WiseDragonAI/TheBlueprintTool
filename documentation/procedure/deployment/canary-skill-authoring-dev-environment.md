## A. Static Canary Topology

1. This procedure is the Linux workstation implementation. The Android phone implementation is [Termux Phone Canary Environment](./canary-termux-phone-environment.md).
2. Do not combine MultiTerm and runit registrations. Select the procedure matching the host that owns ports `50151` and `50152`.
3. The shared invariants are the `dev` branch, isolated worktree, ports, exact-SHA evidence, distinct federation identity, production exclusion, and dev-only cleanup.

---

## B. Workstation Topology

1. **Branch:** `dev`.
2. **Worktree:** `/home/jbb/dev/EditorBP/decision-os/.worktrees/dev`.
3. **Production application:** `http://127.0.0.1:50150/`.
4. **Canary application:** `http://127.0.0.1:50151/`.
5. **Local dev relay:** `http://127.0.0.1:50152/`.
6. **Isolation:** production project discovery excludes `.worktrees/dev`; the production catalog must not contain the canary project state.
7. This topology is stable. Admission evidence is not: every health, proof, configuration, and candidate receipt must name the exact current 40-character `origin/dev` SHA.
8. Do not record a fixed SHA in this runbook. Resolve the candidate at verification time:

   ```bash
   git -C /home/jbb/dev/EditorBP/decision-os/.worktrees/dev fetch origin main dev
   git -C /home/jbb/dev/EditorBP/decision-os/.worktrees/dev rev-parse HEAD
   git -C /home/jbb/dev/EditorBP/decision-os/.worktrees/dev rev-parse origin/dev
   git -C /home/jbb/dev/EditorBP/decision-os/.worktrees/dev merge-base --is-ancestor origin/main HEAD
   git -C /home/jbb/dev/EditorBP/decision-os/.worktrees/dev status --short
   ```

9. Before candidate preparation, the mutable dev checkout is intentionally `unbootstrapped`: health reports `releaseSha: ""`, `deliveryProtocol: 0`, and `activeReleasePointer: "unbootstrapped"` and cannot claim an admitted SHA from inherited environment variables. Candidate preparation requires clean `HEAD == origin/dev` and successful `origin/main` ancestry. It creates no delivery journal or lease and performs no production mutation.

---

## C. MultiTerm Ownership

1. Replace `<exact-origin-dev-sha>` with the same current candidate SHA in both registrations.
2. Register the source-defined `env.dev` relay:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process register \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev/federation-relay \
     --cmd './node_modules/.bin/wrangler dev --env dev --local --ip 127.0.0.1 --port 50152 --persist-to .wrangler/state-dev --var DECISION_OS_RELEASE_SHA:<exact-origin-dev-sha> --log-level info --show-interactive-dev-session=false' \
     --port 50152 \
     --url http://127.0.0.1:50152/health \
     --name decision-os-relay-dev \
     --description 'Decision OS isolated local dev federation relay' \
     --auto-restart
   ```

3. The exact candidate command creates or validates the source-owned release marker and settings-owned candidate current pointer:

   ```bash
   node bin/decision-os-delivery.mjs candidate \
     --release-sha <exact-origin-dev-sha> \
     --json
   ```

4. After the first clean preparation has created the marker and pointer, replace the prior mutable registration and register the admitted canary:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process unregister \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev \
     --port 50151

   /home/jbb/dev/multiterm/bin/multiwezterm-process register \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev \
     --cmd 'env PORT=50151 ./bin/decision-os-server.mjs' \
     --port 50151 \
     --url http://127.0.0.1:50151/api/health \
     --name decision-os-workstation-dev \
     --description 'Decision OS exact-SHA dev canary server' \
     --auto-restart

   curl -sS http://127.0.0.1:50151/api/health

   node bin/decision-os-delivery.mjs candidate \
     --release-sha <exact-origin-dev-sha> \
     --json
   ```

5. The first candidate invocation may exit `2` while the prior mutable canary still reports `unbootstrapped`; its only retained effect is the ignored candidate marker/current pointer. The second invocation performs bounded admission collection and atomically writes candidate evidence after health identifies the exact SHA.
6. MultiTerm owns both dev processes. Do not launch duplicate relay and application processes outside these registrations.
7. A source change invalidates the evidence. Re-verify, push the new exact SHA, repeat the unregister/register/health/candidate sequence, and collect new receipts.

---

## D. Relay Identity

1. `federation-relay/wrangler.toml` defines:
   1. Production Worker `decision-os-federation-relay`
   2. Production Durable Object namespace identity `decision-os-federations-production`
   3. Dev Worker `decision-os-federation-relay-dev`
   4. Dev Durable Object namespace identity `decision-os-federations-dev`
2. Local dev Durable Object state is isolated under `federation-relay/.wrangler/state-dev`.
3. The ignored `federation-relay/.dev.vars.dev` owns the dev-only administrator secret. It must not contain production credentials.
4. The ignored canary `.decision-os/.settings.json` owns dev federation ID, node ID, node credential, node label, and relay URL.
5. Production Worker identity, Durable Object state, federation identity, node credential, relay URL, logs, and delivery evidence are never reused.
6. Dev relay `/health` must report:
   1. `ok: true`
   2. `status: "ready"`
   3. `service: "decision-os-federation-relay"`
   4. `releaseSha: "<exact-origin-dev-sha>"`
   5. `deliveryProtocol: 1`
   6. `protocolVersion: 1`
   7. Current task `stateProtocol`, `stateSchema`, and `baselineEpoch`
   8. `environment: "dev"`
   9. `workerName: "decision-os-federation-relay-dev"`
   10. `durableObjectNamespace: "decision-os-federations-dev"`
7. Wrangler is pinned to `4.111.0`. Validate the package and configuration through the repository verification lease; direct production Wrangler deployment is not a canary operation.

---

## E. Fixed Health And Isolation Evidence

1. Capture application and relay health without restarting production:

   ```bash
   curl -sS http://127.0.0.1:50150/api/health
   curl -sS http://127.0.0.1:50151/api/health
   curl -sS http://127.0.0.1:50152/health
   curl -sS http://127.0.0.1:50150/decision-os/projects
   curl -sS http://127.0.0.1:50150/api/federation/nodes
   curl -sS http://127.0.0.1:50150/api/delivery/admission-state
   curl -sS http://127.0.0.1:50150/api/federation/replication-status
   ```

2. Production `/api/health` must be ready and identify the current `origin/main` release, protocol `1`, process start identity, active `current:<origin-main-sha>` pointer, and zero active incidents.
3. Canary `/api/health` must be ready and identify the exact candidate SHA, protocol `1`, process start identity, `current:<exact-origin-dev-sha>`, and zero active incidents.
4. Production `/decision-os/projects` must contain no project path under `.worktrees/dev`.
5. `/api/federation/nodes` is the topology authority. Every project-owning node must be online and publish exact project IDs plus SHA-256 repository-origin fingerprints. Zero-project authenticated identities are recorded but excluded from activation.
6. `/api/delivery/admission-state` must report for every active target:
   1. Exact `nodeId`, `observedAt`, and `projectIds`
   2. `federationPhase: "connected"`
   3. Zero active and pending executions
   4. Zero process queue depth
   5. Zero paused scopes and fatal incidents
   6. Zero task-state runtime-dirty entities and pending delivery IDs
   7. Zero content queue depth and unavailable content resources
   8. `convergedProjectIds` exactly equal to owned projects
7. `/api/federation/replication-status` must independently show zero runtime-dirty entities, pending delivery IDs, queued content demand, and unavailable content resources, plus converged relay state for every locally owned project.
8. `multiwezterm-process list` must report both dev registrations as enabled, running, and automatically restarted.

---

## F. Verification Lease

1. Run every test and typecheck through the repository-wide lease:

   ```bash
   node bin/decision-os-verify.mjs -- frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit
   node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit
   node bin/decision-os-verify.mjs -- npm test --prefix frontend
   node bin/decision-os-verify.mjs -- npm test --prefix backend
   node bin/decision-os-verify.mjs -- npm run test:browser
   ```

2. Add focused content-authoring, delivery, relay, launcher, and CLI checks before the complete suite. Do not run the same passing check again after documentation-only changes.
3. Before Chromium proof, follow the injected platform section in `BROWSER_RUNBOOK.md`. On this Linux workstation use root `@playwright/test`, `/snap/bin/chromium`, and the documented Linux flags.
4. Browser proof must target the served `50151` canary. It must not control the operator's browser and must not restart production `50150`.

---

## G. Content Authoring Proof

1. Create, save, reload, and inspect history for `federated-skill`, `workspace-skill`, and `pipeline-prompt`.
2. Record the exact identity-scoped request, response, loaded SHA-256 revision, resulting Git commit, committed path allowlist, reload result, and cursor history receipts.
3. Verify one persistent editable CodeMirror view retains draft, undo, selection, search, wrapping, scroll, and focus while metadata, save, recovery, and history state changes.
4. Verify dirty explicit close, Escape, browser Back, route change, and unload use the same discard guard; clean close returns focus to the initiating control.
5. Verify desktop geometry is exactly `80vw` by `95vh` and the responsive dialog remains inside the mobile viewport.
6. Verify read-only content disables mutation, Undo, Redo, and Save while retaining Find, wrapping, selection, copying, focus, and history.
7. Traverse cursor history through `nextCursor: null`. Verify rename-following membership, immutable revision reads, selected full Markdown, adjacent older-to-selected patch, and oldest-to-empty behavior.
8. Verify Pierre uses red removal and blue addition with signs, line numbers, textual labels, focus order, and accessible region/group names.
9. A revision selection remains read-only and performs no automatic restore.

---

## H. Owner Routing And Task Proof

1. Open direct `GET` and `HEAD` Markdown paths for a Task card, current card thread, editable skill, protected skill, and registered prompt.
2. Record HTTP `302`, `Cache-Control: no-store`, no raw Markdown response, and the exact canonical route.
3. Verify missing, symlinked, escaped, stale, unavailable, unregistered, and unowned-thread Markdown targets return `404 markdown_editor_target_not_found`.
4. Verify multiple current owners return `409 markdown_editor_target_ambiguous`.
5. Save Task-card Markdown through `PUT /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/content`.
6. Record the `patch-card` mutation receipt, Task clock, content head, hydrated card revision, focused Git commit, and successful reload.
7. Prove the commit contains only the card Markdown. Runtime task-state and thread files remain excluded.
8. Move the card between zones and prove the zone-independent canonical editor route remains valid.
9. A direct thread path opens the canonical note surface. It does not create a whole-thread CodeMirror persistence path.

---

## I. Prompt And Federation Proof

1. Admit one clean committed prompt and record its exact `contentKind`, `contentRevision`, `contentCommit`, and `promptSnapshot`.
2. Verify local execution injects the snapshot exactly once and does not re-read mutable prompt bytes.
3. Verify authenticated remote execution carries the same immutable snapshot and does not write it to a skill, workspace catalog, cloud-agent catalog, federation library cache, manifest, and snapshot.
4. Verify missing, dirty, uncommitted, stale, kind-mismatched, and disappeared prompt content fails before scheduling and remote installation.
5. Verify prompts remain absent from natural agent and skill discovery.
6. Verify a committed federated skill refreshes the dev manifest and converges through `50152`.
7. Verify workspace skills and prompts remain absent from federation manifests and snapshots.
8. Capture production relay and federation diagnostics before and after without mutating production to manufacture proof.

---

## J. Git And Recovery Proof

1. For each successful create and save, record prior and resulting `HEAD`, exact transaction-bound files, response content revision, response Git revision, and reloaded bytes.
2. A prompt commit contains only prompt Markdown and `.decision-os/codex-pipelines.json`.
3. Stage an unrelated fixture and prove the index object remains byte-identical after each authored transaction.
4. Inject Git `read-tree`, `add`, `write-tree`, `commit-tree`, `update-ref`, and index-reconciliation failures at their first boundary.
5. Verify recoverable failure returns `503 git_revision_pending_recovery`, preserves confirmed owner bytes, creates no false revision, records an incident, and supplies the exact recovery token.
6. Retry the exact revision without repeating the owner mutation. Change current bytes and prove retry returns `409 content_revision_conflict`.
7. Hold the shared repository mutation lock and prove authoring returns `423 repository_mutation_locked` while unrelated health, diagnostics, task, project, and federation routes remain online.
8. Verify cancellation, timeout, bounded stdout/stderr, process settlement, and token/path/output redaction.

---

## K. Candidate Evidence Bundle

1. After the complete automated and served proof passes, write the strict `<catalog-root>/.decision-os/delivery/candidate-input.json`, then invoke:

   ```bash
   node bin/decision-os-delivery.mjs candidate \
     --release-sha <exact-origin-dev-sha> \
     --json
   ```

   The CLI performs fresh admission collection and atomically delegates the final bundle to `writeDeliveryCandidateEvidence()`.
2. The bundle must name the exact pushed `origin/dev` SHA and include:
   1. Distinct production/dev relay configuration plus pinned Wrangler evidence
   2. Exact project-owning node admission evidence
   3. Fresh passed receipts for `authoring`, `editor`, `direct-path`, `prompt-execution`, and `federation`
3. The writer does not import the run owner, lease owner, and journal owner. Candidate preparation therefore creates no delivery run and cannot authorize production mutation by itself.
4. Invalid top-level shape, protocol, SHA, relay identity, node identity, duplicate node identity, node timestamp, missing proof, duplicate proof, non-passed proof, and proof timestamp fail as `delivery_candidate_evidence_invalid`. A document above the delivery size bound fails as `delivery_candidate_evidence_too_large`. Both failures precede replacement of the prior bundle.
5. The explicit fixed `promote --release-sha` invocation is the operator's admission action.

---

## L. Promotion Gate

1. Require one clean pushed candidate where `HEAD == origin/dev`, current `origin/main` is an ancestor, all required checks pass, and candidate evidence matches that exact SHA.
2. Require every active project-owning node to expose delivery protocol `1` and adopted supervisor evidence.
3. The workstation bootstrap owner is `multiterm-workstation-v1`. Production promotion remains blocked until the operator provides the phone's exact node-owned supervisor record and its validated adapter exists.
4. Production delivery uses only:

   ```bash
   node bin/decision-os-delivery.mjs promote \
     --release-sha <40-character-origin-dev-sha> \
     --server http://127.0.0.1:50150 \
     --json
   ```

5. Bootstrap, promote, status, resume, runtime rollback, journals, exit codes, and incident diagnosis are defined in [Production Delivery Protocol](./production-delivery-protocol.md).
6. Do not manually merge `dev`, push `main`, deploy the production Worker, repoint a node release, stop a server, and restart a server outside that protocol.

---

## M. Dev-Only Cleanup

1. Stop and remove the canary application:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process unregister \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev \
     --port 50151
   ```

2. Stop and remove the local dev relay:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process unregister \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev/federation-relay \
     --port 50152
   ```

3. Preserve `.wrangler/state-dev` when it is referenced by evidence or an incident. Remove it only after recording the result.
4. Remove the `dev` worktree only after both dev registrations are absent and candidate work is no longer required.
5. Canary cleanup never stops production `50150`, changes production configuration, changes a production release pointer, deploys relay traffic, edits a delivery journal, deletes production state, and replaces production rollback.
6. An admitted production delivery is reversed only with `decision-os-delivery rollback` under [Production Delivery Protocol](./production-delivery-protocol.md).

---

## N. Readiness Claim Boundary

1. HTTP `200` and `status: "ready"` prove only that the canary process can answer its health route.
2. A release-admitted canary must also report the exact non-empty candidate `releaseSha`, `deliveryProtocol: 1`, the expected immutable active release pointer, zero blocking incidents, zero dirty release-owned state, and the admitted relay identity.
3. Browser evidence must be captured from that exact release SHA after merge-conflict resolution and final source integration.
4. Focused authoring scenarios do not replace served pipeline-prompt execution, the complete suite, remote authority checks, and delivery recovery proof.
5. Until every requirement in [Iteration Closeout Procedure](../implementation/iteration-closeout.md) passes, report the environment as `canary available; candidate not admitted`.
