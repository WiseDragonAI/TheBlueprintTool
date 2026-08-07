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

## E. Minimal Code Correction

1. In `project-content-runtime.ts`, admit startup reconciliation only when the exact mutable content file exists. Keep normal reconciliation for an existing changed file.
2. In `watch-card-content-files.ts`, replace unbounded startup `Promise.all` capture fan-out with sequential bounded processing. One failed resource pauses only its owning project watcher and does not cancel unrelated projects.
3. In `task-content-object-store.ts`, open and stat the source content before creating object-store directories. An absent source beneath an inaccessible project root must not trigger a directory-creation attempt.
4. Keep the existing `16`-entity frame limit, `512 KiB` frame ceiling, one in-flight transaction, exact acknowledgment correlation, canonical manifest validation, sequential bucket reads, root-aware suppression, and change-only project fan-out.
5. Remove session identity from repair eligibility. Persist one repair identity keyed by exact node ID, project ID, relay generation, peer root, and canonical manifest digest.
6. Persist one state for that identity: `active`, `converged`, or `paused`. A finite repair deadline changes `active` to `paused`; reconnect does not change it. A changed relay generation creates exactly one new eligible identity.
7. Charge each canonical bucket at most once to the repair identity. Duplicate summary and missing-request frames perform zero new storage reads for already charged buckets.
8. Mark repair `converged` only when the existing `state-converged` frame proves receiver application and exact root equality.
9. Extend the existing `state-relay-ack` payload additively with a `rejected` array containing exact entity key, state hash, and stable rejection code. Do not add a new frame type and do not change epoch 4.
10. On a correlated rejected acknowledgment, remove the transport delivery from pending, retain the local durable entity unchanged, persist a project-scoped paused repair record, record one actionable incident, and stop automatic retry across reconnects.
11. Clear a paused repair only after an explicit validated runtime resume or a changed relay generation. The resume must re-read local state, relay state, and the stored rejection before installing active runtime state.
12. Apply the same durable repair transition contract in `federation-relay/src/index.ts`, `federation-relay/src/termux-local-relay.ts`, `shared/federation-repair-guard.ts`, and `backend/src/business/federation/helper/federation-task-state-replicator.ts`.
13. Add adjacent `WHAT:` and `WHY:` comments to every added or modified branch.
14. Keep production promotion factorized as deployment. Make candidate, admission, journal, status, and final receipts retain the complete diagnostic counts without treating contained project failures as deployment failures. The command still rejects Git, credential, Worker, coordinator-supervisor, delivery-runtime, and fatal-process failures.

---

## F. Permanent Automated Proof

1. Add a watcher regression in the focused project-content runtime tests: one retained head plus an absent mutable sidecar produces zero capture calls, zero incidents, and ready startup.
2. Add an inaccessible-project regression: one inaccessible root produces one contained project result, zero concurrent capture fan-out, and continued readiness for an unrelated project.
3. Retain the existing-file regression: a present changed Markdown file still reconciles atomically and publishes its new content head.
4. Add a node repair regression: duplicate identical summaries create one missing request; exact root equality emits `state-converged`; a changed relay generation admits one new repair.
5. Add a reconnect regression against `rel-0.3.11` behavior: repeated summaries and missing requests over at least `20` reconnects produce exactly one scan and one response for the unchanged repair identity, with zero observer fan-out.
6. Add a collision regression: one same-dot/different-value entity produces one correlated rejected acknowledgment, one paused project repair, zero retry after reconnect, preserved local bytes, and an unaffected healthy project.
7. Add invalid-manifest coverage: one invalid bucket name rejects the complete request before any storage read.
8. Add deadline coverage: an incomplete repair becomes paused after its finite deadline and remains paused after reconnect.
9. Run the focused test files, backend typecheck, federation-relay typecheck, complete backend suite once, and complete federation-relay suite once through `node bin/decision-os-verify.mjs -- <direct-command>`.

---

## G. Isolated Huge-State Canary Proof

1. Create Canary A from the reviewed feature worktree based on current `dev`. Do not use the persistent `dev` worktree and do not register the canary in MultiTerm.
2. Copy the real Decision OS epoch-4 task-current state into an isolated scratch root through `TaskCurrentStateStore`; never copy production settings, credentials, caches, incidents, uploads, runtime files, or live process state.
3. Expand Canary A deterministically through the store API to at least `20,000` entities, all `256` buckets, more than `64` bounded frames, more than `8 MiB` encoded payload, and more than `32 MiB` durable state.
4. Create empty Canary B with unique node and project identities.
5. Connect both nodes only through a temporary isolated relay with generated credentials, an operating-system-assigned loopback port, disabled automatic library synchronization, and no production hostname, federation ID, namespace, credential, or port.
6. Run the unpatched `rel-0.3.11` reconnect fixture for at most five seconds and at most `32` repeated rounds. Preserve the failing counters proving repeated unchanged work, then tear down its recorded process group.
7. Run the same fixture against the patch. Require one admitted repair, one read per requested bucket, zero unchanged observer summaries, and stable counters through `20` reconnects.
8. Run full healthy synchronization through the real node connector and real replicator. Require Canary A to drain dirty and pending counts to zero; require Canary B to apply exactly `20,000` entities and produce the exact source manifest and root.
9. Close and reopen Canary B's store. Require the same entity count, hashes, manifest, and root after reload.
10. Repeat the complete apply-and-reload proof against the real Cloudflare Worker Durable Object test runtime and the Termux relay. Frame counting without destination application and reload is not acceptance evidence.
11. Mutate one source entity after convergence. Require one relay-generation increment and exactly one new bounded repair.
12. Retain the fixture, deterministic generator, fault injection, raw counters, reload assertions, and both relay matrices as permanent tests. Delete only generated scratch roots, relay state, logs, and process groups recorded by the canary manifest.

---

## H. Development Integration Gate

1. Implement the correction in one isolated feature worktree based on the exact current `dev` head.
2. Review the complete changed-path inventory and every hunk. Exclude unrelated UI work, staged operator hunks, production state, release refs, delivery journals, and `.decision-os` child content not owned by the iteration.
3. Commit the reviewed implementation, tests, and permanent documentation with the required `WHAT:` and `WHY:` commit body.
4. Merge the feature branch into local `dev` with a merge commit only after all focused, typecheck, full-suite, and huge-canary gates pass.
5. Run `node bin/decision-os-dev-integration-check.mjs --feature <reviewed-feature-sha> --json` from `.worktrees/dev`.
6. Push the exact checked `dev` merge SHA with the Wise SSH key, then remove only the completed feature worktree and merged feature branch.
7. Do not perform production mutation at this gate.

---

## I. Release Identity Gate

1. Do not delete, move, overwrite, or silently reinterpret published `rel-0.3.2` through `rel-0.3.12` tags. Their history is required to audit the incident.
2. Do not create another release tag until the operator supplies the one canonical release identity for this recovery. This is the only unresolved operator decision and blocks promotion, not implementation or canary proof.
3. After that identity is supplied, run the canonical merge exactly once from the primary main checkout:

   ```bash
   node bin/decision-os-merge-dev.mjs --json
   ```

4. Treat the merge tool's JSON receipt as the authority for the main merge, paired `rel-*` and `devrel-*` tags, commit identities, and cleanliness. Do not run redundant Git inspection after success.
5. Publish the exact main merge and paired tags before delivery. The delivery command must never create, move, merge, commit, or push Git refs.

---

## J. Production Recovery And Deployment

1. Require explicit operator authorization for this section because it stops the production coordinator and deletes the MOH project's relay state.
2. Freeze production reconnects and automatic restarts. Do not run the uncommitted acknowledgment-timeout retry worktree and do not reconnect the existing flood-prone coordinator during recovery.
3. Record the exact production coordinator release, process identity, local MOH entity count, local root, manifest, dirty keys, pending-delivery keys, active incidents, relay deployment ID, and relay MOH root before mutation.
4. Create and verify a byte-preserving backup of the authoritative local MOH epoch-4 state. Record its file count, byte count, hashes, entity count, manifest, and root.
5. Prepare production candidate evidence from the already-published release tag:

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
9. Let the fixed coordinator handle the existing MOH collision once. Require one terminal rejected acknowledgment, one project-scoped paused repair record, and no repeated repair traffic. The deploy-only receipt may complete with this contained diagnostic state recorded explicitly.
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

## K. Incident Recovery

1. Do not delete, truncate, rewrite, or manually mark incident files resolved. Recovery must validate the owning durable state first.
2. After the startup patch is active, resume each exact MOH and lys `project-watcher:<project-id>` scope through `POST /api/diagnostics/runtime/resume` with a resolution that names the validated file inventory and patch release.
3. Resume Ardaria's watcher scope only after the mounted project root is readable and the exact formerly failing files can be opened and stated without `EACCES`.
4. Recover the two mobile timeout scopes only after one complete authenticated skills-then-pipelines synchronization succeeds and a subsequent catalog notification completes without another timeout.
5. Resolve the two `EADDRINUSE` scopes only after the registered service owns the intended port, no duplicate listener exists, and one HTTP health probe succeeds.
6. Resume the MOH federation repair scope only after the scoped relay reset, local reseed, exact root equality, zero dirty entities, zero pending deliveries, and persistence across coordinator restart have all passed.
7. For every scope, call the existing endpoint with the exact persisted scope string:

   ```http
   POST /api/diagnostics/runtime/resume
   Content-Type: application/json

   {"scope":"<exact-scope>","resolution":"<verified recovery evidence>"}
   ```

8. Require HTTP `200` and the returned resolved incident IDs. HTTP `409` means validation failed and the scope remains active.

---

## L. Final Acceptance And Observation

1. Require the coordinator and Worker to report the same approved release tag, exact main SHA, delivery protocol `1`, task-state protocol `4`, schema `4`, and production environment.
2. Require `/api/health` to report ready with zero active incidents and zero paused scopes.
3. Require `/api/diagnostics/incidents` to report zero active records while retaining resolved historical evidence.
4. Require `/api/delivery/admission-state` to expose the same complete zero-error diagnostic state as `/api/health` while retaining its separate deploy-blocking result. It must not omit local-only projects or contained watcher failures from the response.
5. Require MOH, lys, and Ardaria watchers to be active with no new capture, collision, permission, timeout, and port-conflict incident.
6. Require federation dirty count, pending-delivery count, queued delivery count, and unavailable-resource count to be zero.
7. Require every intended project, including local-only projects with configured federation state, to appear converged with exact local and relay roots.
8. Require the retained huge-state proof receipt to show `20,000` entities, all `256` buckets, more than `32 MiB` durable state, exact destination reload equality, and zero repair work through `20` unchanged reconnects on both relay implementations.
9. Observe production for ten continuous minutes. Require no new incident, no root change without a local mutation, no repeated repair identity, no unchanged observer fan-out, and stable Worker request and storage-read counters.
10. Declare recovery complete only when all nine checks pass together. A healthy deployment receipt without zero errors and convergence is not completion.

---

## M. Execution Order

1. Correct startup watcher admission and bounded processing.
2. Correct durable repair ownership and terminal rejection handling.
3. Add and pass focused regressions.
4. Prove the pre-patch flood with the bounded retained fixture.
5. Prove patched quiescence and full huge-state synchronization on Worker and Termux relays.
6. Merge the reviewed feature into `dev`, run the fixed integration check, push `dev`, and clean the feature worktree.
7. Obtain the single operator-approved release identity.
8. Merge `dev` to `main` once with `decision-os-merge-dev` and publish its paired tags.
9. Obtain explicit destructive-recovery authorization.
10. Freeze the coordinator, back up MOH, deploy the fixed tag, reset only MOH relay state, and reseed from local authority.
11. Validate and resume every active incident scope.
12. Complete the ten-minute zero-error and zero-flood observation gate.

---

## N. Supersession Boundary

1. This document supersedes `federation-flood-two-node-canary-and-fix-plan-2026-08-04.md` as the recovery authority.
2. The earlier document's executed canary evidence remains historical evidence, but it did not prove durable receiver application in the Worker path, did not prevent session-scoped repair eligibility, did not correct startup watcher admission, and did not recover corrupt production relay state.
3. This document authorizes documentation and implementation planning only. Production stopping, relay reset, release promotion, and incident resumption retain their explicit gates above.
