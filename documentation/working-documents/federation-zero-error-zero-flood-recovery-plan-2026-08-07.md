# Federation Zero-Error, Zero-Flood Recovery Plan

## A. Required End State

1. Production coordinator and Cloudflare Worker run the same immutable release tag and exact main commit.
2. Task-state federation remains compatible with `decision-os-task-state/4`, schema `4`, transport version `1`, existing frame names, and the existing sparse-root calculation.
3. Every valid large state converges between two real nodes through both relay implementations, survives destination reload, and leaves zero dirty entities and zero pending deliveries.
4. An unchanged divergent state receives one bounded repair attempt. Duplicate summaries, duplicate missing requests, reconnects, and socket replacement perform no additional storage scan, entity replay, observer fan-out, or outbound repair traffic.
5. A terminal same-dot/different-value collision pauses only its project repair scope, remains paused across reconnects, records the exact rejected entities, and leaves unrelated projects and routes online.
6. Project startup does not treat an absent mutable Markdown sidecar as an external edit. Missing and inaccessible project files do not create concurrent capture storms.
7. `/api/health`, `/api/diagnostics/incidents`, `/api/delivery/admission-state`, `/api/federation/nodes`, and `/api/federation/replication-status` agree that there are zero active failures, zero paused scopes, zero dirty task-state entities, zero pending deliveries, and complete convergence.

---

## B. Verified Production Failure Snapshot

1. The production coordinator and Cloudflare Worker currently identify release `rel-0.3.12` at main commit `0a14fa39fbaaf0f29a7792b400bbdcd3bd8e96f9`; the Worker version is `3b69391a-6866-4fc2-b954-db9e2d181a89`.
2. The intended `rel-0.3.1` main commit was `5a9e3656ee92960746a1176195c0b77fa6611a44`. Its coordinator was activated, but its Cloudflare Worker was not deployed.
3. Releases `rel-0.3.2` through `rel-0.3.12` were then created while reacting to delivery and federation symptoms. They are historical published refs, not eleven independent product fixes.
4. The System Status 24-hour total was `715` failures: MOH `610`, Ardaria `79`, lys `24`, and two system `EADDRINUSE` failures.
5. The active incident ledger contained `54` records representing `676` active observations: `43` MOH task-content capture records with `559` observations, `6` lys capture records with `24` observations, one Ardaria permission record with `79` observations, two mobile timeout records with `12` observations, and two port-conflict records.
6. MOH's displayed `610` consisted of `559` active `task_content_capture_failed` observations plus `51` recently resolved `task_current_dot_collision` observations.
7. `/api/delivery/admission-state` reported release health as ready with zero delivery-scoped incidents while `/api/health` reported degraded with `54` active incidents. The delivery projection therefore hid failures required by the production-readiness decision.
8. The same admission response reported `18` dirty task-state entities and one pending delivery. MOH was absent from its converged-project list.

---

## C. First Incorrect Transitions

1. Startup reconciliation in `backend/src/business/server/runtime/project-content-runtime.ts` selects every owned task resource with one retained head without first proving that its mutable Markdown file exists.
2. `backend/src/business/refresh/helper/watch-card-content-files.ts` starts capture for all selected resources with one unbounded `Promise.all`.
3. The missing MOH and lys mutable files therefore enter `capture()`, return no content, and record `task_content_capture_failed`. Ardaria's inaccessible mounted path receives `79` concurrent capture attempts and records repeated `EACCES` failures.
4. The first incorrect watcher transition is: `one retained causal head + missing mutable sidecar -> classify as external edit`. A missing sidecar is not an edit and must not enter capture.
5. MOH also contains `18` migration-era execution entities for which local and relay state use the same causal dot with different values. The relay correctly rejects that impossible merge before acknowledging the entity batch.
6. The coordinator retains the rejected entities as dirty because no terminal delivery outcome settles them. Reconnect and retry cannot repair a same-dot/different-value collision and instead replay the same failure.
7. The session-scoped repair record introduced by `rel-0.3.11` makes a reconnect eligible for another full repair. It directly reopens the original flood even when the relay root has not changed.

---

## D. Release Patch Assessment

1. `rel-0.3.0`, commit `40cfdf2b`: retain canonical manifest validation, root-aware suppression, sequential bucket reads, and change-only fan-out. Replace its incomplete send-completion ownership with durable convergence ownership.
2. Atomic Markdown synchronization, commit `2e40175f`: retain the atomic content mechanism and correct only its startup admission and concurrency boundaries. This commit introduced the current capture storm but does not require wholesale reversion.
3. Delivery merge ownership, commit `218c03a5`: keep reverted. Production delivery must never repeat the dev-to-main merge workflow.
4. Deploy-only correction, commit `5a2cdc89`: retain. `promote` deploys an already-published tag and performs no merge, commit, tag creation, tag movement, or push.
5. `rel-0.3.1`, commit `293d23b6`: retain tag-based paired `rel-*` and `devrel-*` resolution plus coordinator-only production deployment.
6. `rel-0.3.2`, commit `d0f7d826`: retain sibling merge-parent admission and the fixed production coordinator port.
7. `rel-0.3.3`, commit `914b170b`: revert local-only project exclusion. A missing Git origin does not make a project's task state ineligible for federation.
8. `rel-0.3.4`, commit `f64e9c27`: replace hidden delivery-scoped health with two explicit projections. Admission reports every diagnostic incident, paused scope, dirty entity, pending delivery, and unconverged intended project; only fatal and delivery-runtime failures block the deploy-only command. Product recovery is decided by the complete health projection after deployment.
9. `rel-0.3.5`, commit `a72dacbf`: revert catch-all origin failure handling. Repository inspection failure must remain an explicit failure instead of becoming an empty origin.
10. `rel-0.3.6`, commit `f1a628ec`: replace documentation that declares the invalid exclusions and narrowed health contract.
11. `rel-0.3.7`, commit `f8040f47`: retain bounded entity batches, using the subsequently proven limit of `16` entities.
12. `rel-0.3.8`, commit `c5f617d8`: replace socket-send completion with receiver-application completion. A completed WebSocket write is not proof that the receiver installed the state.
13. `rel-0.3.9`, commit `a03504ab`: retain dirty state until an exact acknowledgment. Add a terminal rejected outcome so irreconcilable entities stop retrying without being deleted locally.
14. `rel-0.3.10`, commit `b324d6bf`: retain one in-flight state transaction per node.
15. `rel-0.3.11`, commit `630baa87`: revert session-scoped repair eligibility completely. Repair ownership must survive reconnects.
16. `rel-0.3.12`: treat as telemetry-only. It diagnosed rejection correlation but did not correct watcher admission, durable repair ownership, or corrupt relay state.
17. Preserve the three main-owned `.decision-os` incident-review gitlink advances from the later releases as historical incident evidence. Do not copy feature-branch Decision OS child state into `dev` and do not reconcile the main child from `dev`.

---

## E. Unauthorized And Unnecessary Expansion

1. The authorized production task was narrow: use the existing tag-based release method to promote the already-approved `0.3.1` work from `dev` to `main`, deploy the matching Cloudflare Worker, and activate only the production coordinator.
2. Changing `promote` to own the `dev`-to-`main` merge was outside that task. It duplicated the canonical merge tool's responsibility and mixed source integration with deployment.
3. Creating `rel-0.3.2` through `rel-0.3.12` while correcting one failed `0.3.1` deployment was outside the requested release identity. Those tags represent reactive iterations, not eleven operator-approved fix releases.
4. Excluding local-only projects from delivery and federation convergence was an unnecessary product-identity change. It altered which projects the system considered real instead of fixing deployment.
5. Catching every repository-origin failure and converting it to an empty origin was an unnecessary error-semantics change. It hid broken repository inspection behind the local-only classification.
6. Narrowing delivery health until `54` active incidents appeared as zero was an unnecessary observability change. Deployment eligibility and complete product health needed separate fields, not suppression of errors.
7. Changing durable repair ownership to session-scoped ownership was an unnecessary federation-architecture reversal. It invalidated the cross-reconnect flood invariant and made a new socket sufficient to repeat unchanged work.
8. Treating socket-send completion as repair completion expanded transport behavior without proving receiver application. The existing `state-converged` outcome was the required completion authority.
9. Adding retries and acknowledgment deadlines before handling terminal same-dot rejection expanded the retry system around an irreconcilable state. No timeout can make the same causal dot accept two values.
10. Telemetry-only release promotion after the rejection cause was already correlated expanded the release chain without restoring a working state.
11. The resulting architecture mixed five independent concerns: Git integration, release identity, deployment, project eligibility, and federation repair. That coupling allowed a deployment failure to change critical runtime behavior.
12. Recovery must reverse only the expansions identified in Section D and retain the valid batching, single-flight, epoch-4 compatibility, atomic Markdown synchronization, and deploy-only tag path. It must not broadly revert unrelated accepted `dev` work.
13. Every implementation hunk must map to one of six authorized recovery outcomes: stop startup capture storms, make unchanged repair work quiescent across reconnects, expose complete health without blocking contained-error deployment, recover the corrupt MOH relay project, prove the existing release and delivery path in isolation, or settle a retained incident through its verified owning success transition.
14. A proposed change outside those six outcomes is rejected before implementation. A new persistence model, release workflow, project-eligibility rule, protocol epoch, migration, retry layer, node topology, UI redesign, and unrelated cleanup are not part of this recovery.
15. Production promotion remains a consumer of the canonical published release tags. It performs deployment only; it never performs any operation already owned by `decision-os-merge-dev`.
16. One reviewed implementation commit, one `dev` integration, one canonical `dev`-to-`main` merge, one operator-approved release identity, and one production deployment are the maximum production mutation chain for this recovery. The isolated dev Worker rehearsal is evidence, restores its prior authority, and does not add a production release.

---

## F. Minimal Code Correction

1. In `project-content-runtime.ts`, admit startup reconciliation only when the exact mutable content file exists. Keep normal reconciliation for an existing changed file.
2. In `watch-card-content-files.ts`, replace unbounded startup `Promise.all` capture fan-out with sequential bounded processing. One failed resource pauses only its owning project watcher and does not cancel unrelated projects.
3. In `task-content-object-store.ts`, open and stat the source content before creating object-store directories. An absent source beneath an inaccessible project root must not trigger a directory-creation attempt.
4. Keep the existing `16`-entity frame limit, `512 KiB` frame ceiling, one in-flight transaction, exact acknowledgment correlation, canonical manifest validation, sequential bucket reads, root-aware suppression, and change-only project fan-out.
5. Remove session identity from repair admission. Reuse the existing `state:v4:repair` record and its served-bucket evidence for the exact node ID, project ID, relay generation, peer root, and canonical manifest digest; read existing records compatibly and add no replacement persistence model.
6. Keep reconnect ownership in the existing node repair maps. A finite repair deadline records an incident and stops that identity; reconnect does not admit it again. A changed relay generation creates exactly one new eligible identity.
7. Charge each canonical bucket at most once to the repair identity. Duplicate summary and missing-request frames perform zero new storage reads for already charged buckets.
8. Mark repair `converged` only when the existing `state-converged` frame proves receiver application and exact root equality.
9. Extend the existing `state-relay-ack` payload additively with a `rejected` array containing exact entity key, state hash, and stable rejection code. Do not add a new frame type and do not change epoch 4.
10. On a correlated rejected acknowledgment, remove the transport delivery from pending, retain the local durable entity unchanged, record one project-scoped actionable incident through the existing runtime incident ledger, and stop that repair identity across reconnects.
11. Clear the project-scoped terminal-collision incident only after explicit runtime resume re-reads the local state, relay state, and stored rejection, then proves reset or reseed completion and exact root equality. A changed relay generation may admit one new non-terminal repair identity but must not clear a terminal collision incident.
12. Apply the same repair-admission and terminal-incident contract in `federation-relay/src/index.ts`, `federation-relay/src/termux-local-relay.ts`, `shared/federation-repair-guard.ts`, and `backend/src/business/federation/helper/federation-task-state-replicator.ts` without adding a new repair store or state enum.
13. Add adjacent `WHAT:` and `WHY:` comments to every added or modified branch.
14. Keep production promotion factorized as deployment. Make candidate, admission, journal, status, and final receipts retain the complete diagnostic counts without treating contained project failures as deployment failures. The command still rejects Git, credential, Worker, coordinator-supervisor, delivery-runtime, and fatal-process failures.
15. In `create-decision-os-server.ts`, resolve the existing `server-listener` incident only after the registered listener successfully binds its intended host and port. Keep the incident active on `EADDRINUSE` and require the subsequent health probe before recovery evidence is accepted.

---

## G. Permanent Automated Proof

1. Add a watcher regression in the focused project-content runtime tests: one retained head plus an absent mutable sidecar produces zero capture calls, zero incidents, and ready startup.
2. Add an inaccessible-project regression: one inaccessible root produces one contained project result, zero concurrent capture fan-out, and continued readiness for an unrelated project.
3. Retain the existing-file regression: a present changed Markdown file still reconciles atomically and publishes its new content head.
4. Add a node repair regression: duplicate identical summaries create one missing request; exact root equality emits `state-converged`; a changed relay generation admits one new repair.
5. Add a reconnect regression against the `rel-0.3.12` baseline, which retains the `rel-0.3.11` session-scoped behavior: repeated summaries and missing requests over at least `20` reconnects produce exactly one scan and one response for the unchanged repair identity, with zero observer fan-out.
6. Add a collision regression: one same-dot/different-value entity produces one correlated rejected acknowledgment, one paused project repair, zero retry after reconnect, preserved local bytes, and an unaffected healthy project.
7. Add invalid-manifest coverage: one invalid bucket name rejects the complete request before any storage read.
8. Add deadline coverage: an incomplete repair becomes paused after its finite deadline and remains paused after reconnect.
9. Add a listener recovery regression: injected `EADDRINUSE` records `server-listener` and keeps it active; a later successful bind on the intended host and port plus health probe resolves that exact scope.
10. Run the focused test files, backend typecheck, federation-relay typecheck, complete backend suite once, and complete federation-relay suite once through `node bin/decision-os-verify.mjs -- <direct-command>`.

---

## H. Canary Harness Boundary

1. The retained Termux regression in `federation-relay/test/termux-local-relay.node.test.ts` currently permits one replay after relay restart, while its permanent-divergence case never reconnects. It therefore does not prove cross-reconnect quiescence.
2. The retained copied-state test copies one project's `format.json` and `current/` tree. It does not reproduce the production catalog, incident ledger, watcher inputs, pending deliveries, or full project state.
3. Worker huge-state coverage counts protocol frames without applying the complete state into a real destination store, reopening that store, and comparing its manifest and root.
4. `backend/test/delivery/decision-os-delivery.integration.test.ts` injects delivery effects instead of executing the complete release-tag-to-Worker-and-coordinator path. The canary needs one generated, hash-bound receipt for its own proof; it does not replace the existing production candidate evidence schema.
5. Add one fixed `bin/decision-os-release-canary.mjs` CLI. Its `prove --bump <maj|min|fix> --json` command binds `candidateSha` to the current checkout HEAD and owns snapshot, sandbox release, deployment, runtime, and cleanup proof; this recovery uses `fix`. In a published `rel-*` checkout it additionally binds `mainSha` to HEAD and `releaseSha` to the canonical `devrel-*` second parent. It accepts no ref override. Its `cleanup --run-id <id> --json` command removes only resources listed in that run's manifest.
6. Keep `bin/decision-os-delivery.mjs` production-only and deploy-only. The canary CLI must not add production overrides to it and must not accept a Worker name, Durable Object namespace, relay URL, production credential, node identity, release root, branch name, or arbitrary path.
7. Reuse the existing `decision-os-merge-dev`, paired-tag resolver, delivery state machine, delivery journal, node release store, Worker upload and activation helpers, connector, replicator, `TaskCurrentStateStore`, Worker relay, Termux relay, reset route, and runtime recovery route.
8. Add one private source-owned relay target descriptor to the existing helper. Its production default preserves the current Worker name and Wrangler arguments byte-for-byte; only canary code selects the source-defined `env.dev` descriptor, which adds `--env dev`. No target is supplied by the operator.
9. The canonical release contract applies to every repository that adopts the Decision OS parent repository plus `.decision-os` submodule structure. Do not generalize it into an arbitrary-repository release platform, configurable component registry, plugin system, release database, new lease model, deployment migration, or protocol migration.
10. The harness never promotes, resets, restarts, tags, pushes, resolves incidents, connects a new node to, or deploys against production. It prepares evidence for the separate authorized production procedure.
11. Every harness run owns one temporary root, process group, port inventory, generated canary credential set, canary federation identity, dev Worker project identity, Git remotes, logs, and evidence bundle through one manifest. Wrangler `env.dev` uses the existing non-interactive Cloudflare credentials, which the harness neither copies nor owns. Failure retains the bundle for diagnosis; explicit cleanup removes only manifest-owned resources.

---

## I. Immutable Main-State Snapshot

1. Resolve the master Decision OS root from the current delivery settings; on this workstation it is `/home/jbb/.decision-os`. Read its `projects.json` as the authoritative production catalog. The live-state harness remains host-configured even though the canonical merge CLI is repository-reusable.
2. Record a SHA-256 inventory of the master registry and incident ledger plus every registered project's authored Decision OS files and complete task-state tree. Record each source path, file count, byte count, and digest.
3. Preserve the version-`2` registry byte-identically. Its project entries use `relativePath`, so launch the canary from a temporary master root and recreate each registered project at that exact relative path without rewriting the registry or project identities. Record the exact source-to-canary mapping.
4. Reproduce every registered project below that root with reflink copies when supported and byte copies otherwise. Preserve symlinks without following them outside the registered root. Copy authored state and task-state bytes; exclude `.git` directories and `.git` pointer files.
5. Create one minimal scratch Git repository per copied project. Preserve the presence or absence of `remote.origin.url`; when present, use a generated inert canary URL and record only a hash of the source value. This keeps current origin-based behavior without copying Git objects, exposing credentials, or contacting a source remote.
6. Quarantine `.settings.json`, federation credentials, delivery journals, leases, caches, uploads, process state, and production relay configuration outside the runnable canary trees. Generate isolated settings, identities, credentials, ports, and release roots.
7. Inventory the live source again after copying. Accept the snapshot only when the two source inventories and the copied inventory match. A concurrent legitimate write rejects that attempt and causes a bounded retry; the harness never pauses production to obtain a snapshot.
8. Create three lanes from the same accepted snapshot: a baseline lane with a fresh incident ledger, a candidate lane with a fresh incident ledger, and a recovery lane with the copied active incident ledger. Loading the copied ledger before startup would suppress the watcher transitions that the baseline and candidate must compare.
9. Every mutation helper rejects a resolved target outside the manifest-owned root. Inventory the live source after the run and report legitimate production drift separately; the harness must never write a source path.
10. Reproduce the inaccessible-path, catalog-timeout, and duplicate-port conditions through deterministic canary-local fault injection while preserving each original scope, operation, and error code in evidence.
11. Do not claim an exact production relay snapshot. The Worker has a scoped reset route but no read-only Durable Object export, and Wrangler exposes no safe export command.
12. Reconstruct the exact failure class in the isolated relay by taking one copied local epoch-4 entity, retaining its causal dot, changing only its value, and seeding it through ordinary authenticated epoch-4 frames. This deterministic same-dot collision proves containment without adding a production export API, new frame, schema, epoch, migration, pagination surface, or arbitrary storage access.

---

## J. Canonical Release And Deployment Proof

1. Create temporary parent and child bare remotes plus isolated `main` and `dev` clones from the candidate source. Place a main-only child-state sentinel in the isolated main child and a divergent child gitlink in isolated dev.
2. Run the existing merge CLI unchanged from the isolated primary main clone:

   ```bash
   node bin/decision-os-merge-dev.mjs fix --json
   ```

3. Require its receipt to prove main is the first merge parent, admitted dev is the second parent, the main-owned child sentinel and gitlink survive, dev child state is not imported, and paired parent and child tags are created once.
4. Push only to the temporary remotes. Use `resolveDeliveryReleaseTag` to prove the parent `rel-*` and `devrel-*` pair, origin heads, and merge parents. Prove the child tags separately against the temporary child remote and the merge receipt; do not expand the production resolver.
5. Build the deployable release checkout from the resolved parent tag. Require exact parent Git-tree equality including the `.decision-os` gitlink, then initialize the child and require its HEAD to equal that gitlink.
6. Drive the existing delivery state machine against the isolated coordinator and the fixed dev Worker target in this order: prepare coordinator release, upload Worker, activate Worker at `100%`, verify Worker environment and exact main SHA, activate coordinator from the same SHA, verify its new process identity and ready catalog, then reconcile Git, Worker, node, and journal authority.
7. Acquire the existing delivery lease for journal and resume semantics plus the Git-common-directory repository mutation lock for the source repository across every shared `env.dev` mutation. Record and recheck the active dev Worker version before activation. Inject one interruption after Worker activation and require resume to continue from the journal without repeating completed mutations. Then inject one candidate failure and require rollback to restore both isolated authorities.
8. Generate one immutable consolidated canary receipt containing `candidateSha` plus the sandbox merge identities and use its SHA-256 as the harness receipt ID. A release-bound run also contains production `mainSha` and `releaseSha`: the federation proof passed to the unchanged production candidate workflow carries `releaseSha`, while Worker and coordinator deployment evidence carries `mainSha`.
9. Add a permanent rejection test proving the production delivery CLI cannot receive canary endpoints, environments, Worker identities, ports, release roots, or sandbox credentials.

---

## K. Runtime, Flood, And Recovery Proof

1. Build identical baseline and candidate fixtures. Both Canary A and Canary B receive the copied catalog and authored project files; only Canary A receives the copied task-state. Canary B starts with empty epoch-4 stores so transfer is observable. Each node has a unique identity, disabled automatic library synchronization, an operating-system-assigned loopback port, and no production federation authority.
2. Preserve every copied production entity byte-identically. Add deterministic synthetic entities in an isolated key namespace through `TaskCurrentStateStore` on Canary A only. Record copied and synthetic counts separately, and require the combined authority to contain at least `20,000` entities, all `256` buckets, more than `64` bounded frames, more than `8 MiB` encoded payload, and more than `32 MiB` durable state.
3. Require baseline and candidate Canary A stores to have identical pre-execution entity hashes, manifest, and root. Require both Canary B stores to be empty. Record the exact `rel-0.3.12` baseline SHA and candidate SHA.
4. Run the `rel-0.3.12` baseline. Require the copied watcher inputs to reproduce their bounded failures and require unchanged federation state to replay after reconnect. Stop immediately after the second unchanged reconnect replay; enforce a finite deadline only as a safety bound.
5. Run the candidate from the identical fixture. Require missing Markdown sidecars to create zero capture attempts and zero incidents, existing changed Markdown to reconcile, and one inaccessible project to pause only its watcher while the healthy control project and diagnostic routes remain online.
6. Route the real Canary A connector and Canary B connector through one unique temporary federation on the actually activated Wrangler `env.dev` Worker. Preserve every copied original project ID inside that federation and place the synthetic key namespace inside one selected copied project. Require Canary A to drain dirty and pending counts to zero; require Canary B to receive every copied entity plus every synthetic entity and produce each exact project manifest and root.
7. Close and reopen Canary B's store. Require exact copied hashes, synthetic hashes, combined count, manifest, and root after reload. Repeat the complete A-full-to-B-empty apply-and-reload proof through the real Termux relay from fresh stores. Keep Miniflare as deterministic unit coverage, not as the deployed Worker proof.
8. Run the deterministic same-dot collision. Require one correlated terminal rejection, one project-scoped runtime incident, preserved local bytes, and zero additional scans, entity frames, summaries, observer traffic, and outbound repair bytes across `20` unchanged reconnects.
9. Disconnect both canaries, reset every manifest-listed copied project in the unique offline dev federation, and reseed each from the copied local epoch-4 authority. Require zero dirty entities, zero pending deliveries, exact per-project root equality, restart persistence, and uninterrupted healthy control-project traffic.
10. Use the separate copied-ledger recovery lane for incident repair. Remove the injected watcher and federation failures, then invoke `/api/diagnostics/runtime/resume` only for the watcher and federation scopes owned by that recovery router. Recover catalog timeouts through a successful authenticated catalog synchronization. Recover `server-listener` only after the registered listener successfully binds the intended host and port and its health probe succeeds. Require the copied ledger to retain historical evidence and report no active canary incident.
11. After convergence, disconnect Canary B, mutate one synthetic entity on Canary A, and let the relay durably advance its generation and root. Reconnect the stale Canary B and require exactly one bounded repair to exact root equality.
12. Before restoring `env.dev`, require its active version to equal the harness-owned deployed version. External version drift is a fail-closed cleanup result and must not overwrite another actor's deployment. With unchanged authority, restore the recorded pre-run version, verify it is active, disconnect both nodes, and reset every manifest-listed project in the unique offline canary federation.
13. Emit one JSON receipt binding the source inventories, copied and synthetic counts, baseline and candidate SHAs, paired tags, Worker versions, coordinator process identities, state roots, incident transitions, reconnect counters, fault injections, authority checks, and cleanup results. The receipt never writes or resolves production incident state.
14. Retain the snapshot inventory test, canonical merge sandbox test, tag-resolution test, exact tagged-tree and child-gitlink test, production-override rejection, byte-fixed production Wrangler argument test, dev Worker deployment test, interruption and rollback tests, watcher baseline and candidate tests, collision and incident test, reset and reseed test, huge-state `env.dev` and Termux apply-and-reload tests, `20`-reconnect test, healthy control-project test, source-write rejection test, external-Worker-drift cleanup test, and manifest cleanup test. Run every check through `node bin/decision-os-verify.mjs`.

---

## L. Development Integration Gate

1. Implement the correction in one isolated feature worktree based on the exact current `dev` head.
2. Review the complete changed-path inventory and every hunk. Exclude unrelated UI work, staged operator hunks, production state, release refs, delivery journals, and `.decision-os` child content not owned by the iteration.
3. Commit the reviewed implementation, tests, and permanent documentation with the required `WHAT:` and `WHY:` commit body.
4. Merge the feature branch into local `dev` with a merge commit only after all focused, typecheck, full-suite, and huge-canary gates pass.
5. Run `node bin/decision-os-dev-integration-check.mjs --feature <reviewed-feature-sha> --json` from `.worktrees/dev`.
6. Push the exact checked `dev` merge SHA with the Wise SSH key, then remove only the completed feature worktree and merged feature branch.
7. Do not perform production mutation at this gate.

---

## M. Release Identity Gate

1. Do not delete, move, overwrite, or silently reinterpret published `rel-0.3.2` through `rel-0.3.12` tags. Their history is required to audit the incident.
2. Do not create another release tag until the operator supplies the one canonical release identity for this recovery. This is the only unresolved operator decision and blocks promotion, not implementation or canary proof.
3. After the operator supplies the one bump token accepted by the canonical CLI, run the canonical merge exactly once from the primary main checkout:

   ```bash
   node bin/decision-os-merge-dev.mjs <operator-approved-bump> --json
   ```

4. Treat the merge tool's JSON receipt as the authority for the main merge, paired `rel-*` and `devrel-*` tags, commit identities, and cleanliness. Do not run redundant Git inspection after success.
5. Publish the exact main merge and paired tags before delivery. The delivery command must never create, move, merge, commit, or push Git refs.
6. Create an isolated checkout at the published parent release tag and run `node bin/decision-os-release-canary.mjs prove --bump fix --json` there. Require receipt `mainSha` to equal the parent release tag SHA and receipt `releaseSha` to equal its canonical `devrel-*` second parent. This exact release-bound receipt supplies the latter identity to the unchanged production candidate workflow and the former to deployment verification.

---

## N. Production Recovery And Deployment

1. Require explicit operator authorization for this section because it stops the production coordinator and deletes the MOH project's relay state.
2. Freeze production reconnects and automatic restarts. Do not run the uncommitted acknowledgment-timeout retry worktree and do not reconnect the existing flood-prone coordinator during recovery.
3. Record the exact production coordinator release, process identity, local MOH entity count, local root, manifest, dirty keys, pending-delivery keys, active incidents, relay deployment ID, and relay MOH root before mutation.
4. Create and verify a byte-preserving backup of the authoritative local MOH epoch-4 state. Record its file count, byte count, hashes, entity count, manifest, and root.
5. Prepare production candidate evidence from the already-published release tag and the exact release-bound canary federation receipt:

   ```bash
   node bin/decision-os-delivery.mjs candidate \
     --release-tag <operator-approved-release-tag> \
     --json
   ```

6. Keep the current coordinator online for deploy-only admission and preparation. Do not force a reconnect and record its complete contained diagnostic state in the candidate receipt.
7. Deploy the fixed Cloudflare Worker and coordinator from the same published tag with the existing deploy-only command:

   ```bash
   node bin/decision-os-delivery.mjs promote \
     --release-tag <operator-approved-release-tag> \
     --server http://127.0.0.1:50150 \
     --json
   ```

8. The deployment journal must prove the fixed Worker version is uploaded and activated before the fixed coordinator is activated. Other federation nodes do not participate in production promotion.
9. Let the fixed coordinator handle the existing MOH collision once. Require one terminal rejected acknowledgment, one project-scoped runtime incident, and no repeated repair traffic. The deploy-only receipt may complete with this contained diagnostic state recorded explicitly.
10. Confirm the coordinator's local backup, release identity, epoch-4 compatibility, clean startup watcher behavior, and paused MOH repair before relay reset.
11. Stop the fixed coordinator through its delivery-settings-owned supervisor. Verify the relay reports no connected participant for the MOH project.
12. Reset only the MOH relay project through the existing authenticated endpoint:

   ```text
   POST /admin/federations/<federation-id>/projects/<moh-project-id>/reset-state
   Authorization: Bearer <ADMIN_SECRET>
   ```

13. Require HTTP `200`, the exact reset receipt, and the empty MOH relay root. HTTP `409 project_nodes_online` is a hard stop; do not bypass it.
14. Restart only the fixed coordinator through the same adopted supervisor. Reseed the empty MOH relay from the authoritative local epoch-4 state in `16`-entity single-flight batches.
15. Require local dirty count and pending-delivery count to reach zero, relay and local roots to match, all `18` previously rejected entity keys to have one terminal outcome, and no repeated repair across reconnect.
16. Treat the reset as the point of no return for automatic rollback. After reset, keep the node disconnected on deployment failure and repair the fixed release; never reconnect the previous flood-prone binary to the empty relay.

---

## O. Incident Recovery

1. Do not delete, truncate, rewrite, or manually mark incident files resolved. Recovery must validate the owning durable state first.
2. After the startup patch is active, resume each exact MOH and lys `project-watcher:<project-id>` scope through `POST /api/diagnostics/runtime/resume` with a resolution that names the validated file inventory and patch release.
3. Resume Ardaria's watcher scope only after the mounted project root is readable and the exact formerly failing files can be opened and stated without `EACCES`.
4. Recover the two mobile timeout scopes only after one complete authenticated skills-then-pipelines synchronization succeeds and a subsequent catalog notification completes without another timeout.
5. Resolve the two `server-listener` `EADDRINUSE` scopes through the listener's owning success transition only after the registered service binds the intended host and port, no duplicate listener exists, and one HTTP health probe succeeds.
6. Resume the MOH federation repair scope only after the scoped relay reset, local reseed, exact root equality, zero dirty entities, zero pending deliveries, and persistence across coordinator restart have all passed.
7. For each watcher and federation scope owned by runtime recovery, call the existing endpoint with the exact persisted scope string:

   ```http
   POST /api/diagnostics/runtime/resume
   Content-Type: application/json

   {"scope":"<exact-scope>","resolution":"<verified recovery evidence>"}
   ```

8. Require HTTP `200` and the returned resolved incident IDs for those scopes. HTTP `409` means validation failed and the scope remains active. Mobile timeout and duplicate-port incidents must settle through the owning synchronization and listener paths in items 4 and 5; do not send them to the runtime recovery endpoint.

---

## P. Final Acceptance And Observation

1. Require the coordinator and Worker to report the same approved release tag, exact main SHA, delivery protocol `1`, task-state protocol `4`, schema `4`, and production environment.
2. Require `/api/health` to report ready with zero active incidents and zero paused scopes.
3. Require `/api/diagnostics/incidents` to report zero active records while retaining resolved historical evidence.
4. Require `/api/delivery/admission-state` to expose the same complete zero-error diagnostic state as `/api/health` while retaining its separate deploy-blocking result. It must not omit local-only projects or contained watcher failures from the response.
5. Require MOH, lys, and Ardaria watchers to be active with no new capture, collision, permission, timeout, and port-conflict incident.
6. Require federation dirty count, pending-delivery count, queued delivery count, and unavailable-resource count to be zero.
7. Require every intended project, including local-only projects with configured federation state, to appear converged with exact local and relay roots.
8. Require the retained huge-state proof receipt to show at least `20,000` combined entities, separate copied and synthetic counts, every copied entity hash preserved, all `256` buckets, more than `32 MiB` durable state, exact destination reload equality, and zero repair work through `20` unchanged reconnects on both relay implementations.
9. Observe production for ten continuous minutes. Require no new incident, no root change without a local mutation, no repeated repair identity, no unchanged observer fan-out, and stable Worker request and storage-read counters.
10. Declare recovery complete only when all nine checks pass together. A healthy deployment receipt without zero errors and convergence is not completion.

---

## Q. Execution Order

1. Correct startup watcher admission and bounded processing.
2. Correct durable repair ownership and terminal rejection handling.
3. Implement the fixed canary harness and its immutable evidence receipt.
4. Prove canonical merge, paired tags, main child preservation, deploy ordering, interruption resume, and rollback in the sandbox.
5. Prove the pre-patch flood and watcher failures with the bounded baseline.
6. Prove candidate quiescence, incident recovery, scoped reset and reseed, and full huge-state synchronization on Worker and Termux relays from the identical snapshot.
7. Merge the reviewed feature into `dev`, run the fixed integration check, push `dev`, and clean the feature worktree.
8. Obtain the single operator-approved release bump.
9. Merge `dev` to `main` once with `decision-os-merge-dev` and publish its paired tags.
10. Run the harness from an isolated checkout of that exact release tag and retain its release-bound federation receipt.
11. Obtain explicit destructive-recovery authorization.
12. Freeze the coordinator, back up MOH, deploy the fixed tag, reset only MOH relay state, and reseed from local authority.
13. Validate and recover every active incident through its owning recovery path.
14. Complete the ten-minute zero-error and zero-flood observation gate.

---

## R. Supersession Boundary

1. This document supersedes `federation-flood-two-node-canary-and-fix-plan-2026-08-04.md` as the recovery authority.
2. The earlier document's executed canary evidence remains historical evidence, but it did not prove durable receiver application in the Worker path, did not prevent session-scoped repair eligibility, did not correct startup watcher admission, and did not recover corrupt production relay state.
3. This document authorizes documentation and implementation planning only. The harness may use the isolated dev Worker target but may not mutate production. Production stopping, relay reset, release promotion, and incident resumption retain their explicit gates above.
