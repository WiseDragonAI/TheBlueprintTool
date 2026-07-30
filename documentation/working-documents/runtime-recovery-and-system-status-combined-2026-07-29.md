## A. Repository Intent

1. **Task-state failures must remain project-scoped.** Unrelated projects, HTTP routes, diagnostics, federation traffic, and the server process remain available.
2. **Invalid durable state remains recoverable evidence.** Recovery builds and validates a shadow state, retains an exact rollback archive, then installs the validated state atomically.
3. **Epoch-4 state preserves causal history.** Lifecycle, assignment, relationship order, execution entities, content heads, and thread notes cannot be reconstructed by overwriting the current projection with legacy JSON.

---

## B. Current Iteration Intent

1. Reassess whether `task_state_offline_migration_required` requires a Decision OS server restart.
2. Determine whether the paused MOH project `ZGV2L01PSA` can be reconstructed and resumed while the master server remains online.
3. Select one recovery boundary that preserves MOH's partial epoch-4 state, restores missing legacy task semantics, and avoids an unrelated-project outage.

---

## C. Findings

1. **A server restart is not structurally required.**
   1. `pausedTaskProjects` already rejects MOH task-state access through `taskStateForProject()`.
   2. The master server continues serving unrelated projects and diagnostics.
   3. The project-scoped resume route already deletes one project state instance, recreates its project context, invalidates its Control Room projection, and reconciles federation.
   4. The missing boundary is a project-scoped recovery transaction between pause detection and runtime reinstallation.
2. **The visible diagnostics are derived from the legacy fallback, not independent card corruption.**
   1. MOH's legacy `tasks.json` contains `47` cards, `9` master tasks, and `38` subtask relationships.
   2. All `47` legacy cards lack epoch-4 lifecycle state.
   3. All `9` master tasks lack assignment state.
   4. All `38` subtask relationships lack positions.
   5. `control-room-projection-store.ts` renders those omissions as `invalid_lifecycle`, `missing_assignment`, and `invalid_subtask_position`.
3. **The active MOH root is a partial epoch-4 root, not an empty legacy root.**
   1. The required `format.json` marker is absent.
   2. The root retains `38` version-4 entities: `6` cards, `5` relationships, `2` executions, `12` resources, `7` thread notes, `5` ledger fields, and `1` annotation.
   3. Those entities contain newer MOH work that is absent from the legacy ledger.
   4. Rebuilding only from `tasks.json` would lose that newer state.
4. **The existing read-only migration plan rejects the partial root.**
   1. `prepareTaskCurrentStateMigrationPlan()` treats the active root as legacy when `format.json` is absent.
   2. It rejects the first version-4 entity with `invalid_legacy_task_entity`.
   3. `prepareProjectionSources()` also excludes roots containing current entities, so the partial version-4 root cannot enter through the projection-source path.
5. **The semantic restoration logic already exists.**
   1. `prepareTaskCurrentStateMigration()` derives lifecycle from existing lifecycle state, legacy status, card Markdown, then a deterministic backlog default.
   2. It assigns master tasks to the configured default node and preserves inherited subtask assignment.
   3. It deterministically orders missing relationship positions by existing position then relationship ID.
6. **The durable transaction machinery already exists.**
   1. `runTaskCurrentStateMigrationTransaction()` archives exact source bytes, builds a shadow root, revalidates source fingerprints, journals filesystem swaps, installs sidecars, verifies the installed root, and rolls back a normal failure.
   2. The node controller adds `assertCatalogOffline()`, making the shipped node command process-offline.
   3. The transaction helper itself is not inherently catalog-wide.
7. **Running the current single-project CLI beside the live server is not an acceptable recovery.**
   1. It has no server-owned project recovery lock.
   2. It does not dispose the project watcher and Codex timers before the commit window.
   3. It cannot salvage the partial version-4 root.
   4. It cannot atomically install the reopened `ProjectTaskState`, project context, Control Room slice, and federation state inside the running process.
8. **The current Control Room fallback amplifies one scoped incident.**
   1. The cache records `taskRoot: paused:ZGV2L01PSA`.
   2. It still materializes the legacy ledger as nine invalid queue cards.
   3. A paused authoritative task root should produce one project-level recovery state, not actionable task cards derived from a non-authoritative fallback.
9. **The current hot-resume path is incomplete for transactional replacement.**
   1. It reopens task state before disposing the old project context.
   2. `disposeProjectContext()` clears SSE clients without ending their responses, so context replacement can leave browser streams orphaned.
   3. It does not invalidate the Control Room project slice.
   4. It starts Codex execution recovery asynchronously through context creation instead of awaiting recovery before incident resolution.
   5. The migration admission marker is catalog-global and read only at startup; online repair needs a dynamically read project-scoped marker.

---

## D. Remediation Path

1. **Implement `recoverProjectTaskState()` as a server-owned, project-scoped transaction.**
2. Acquire one recovery lock for `projectId`.
3. Keep `pausedTaskProjects` populated so every MOH task write and execution admission remains rejected during recovery.
4. Dispose the MOH project context before the commit window, stopping its watcher, runtime timers, adopted-process monitors, cancellation deadlines, and SSE streams.
5. Validate every retained version-4 entity against schema `4`, project identity `ZGV2L01PSA`, causal clocks, hashes, and object references.
6. Prepare the legacy ledger with the canonical lifecycle, assignment, relationship-order, content, and execution migration helpers.
7. Build a shadow epoch-4 store from the prepared legacy baseline.
8. Merge the retained version-4 entities through the canonical task-state join so newer cards, relationships, executions, resources, ledger fields, and thread notes survive.
9. Require zero invalid entities, zero missing local objects, zero journals, valid execution indexes, complete master-task assignments, valid relationship positions, and a stable source fingerprint.
10. Commit through the existing archived, journaled filesystem transaction.
11. Open and validate the installed `ProjectTaskState` before resolving the incident.
12. Atomically reinstall the MOH project context, invalidate the MOH Control Room slice, publish the complete task delta, reconcile federation, await execution recovery, and schedule eligible Codex work.
13. Resolve `project-task-state:ZGV2L01PSA` only after the reopened projection and federation publication succeed.
14. Roll back the transaction and retain the pause when any validation, installation, publication, or reopening step fails.
15. Change the Control Room projection so a paused task root renders one project-level recovery diagnostic and does not materialize legacy fallback cards.

---

## E. Operator Decision Summary

1. **Revised decision:** do not require a Decision OS server restart for this recovery class.
2. **Recovery scope:** pause only MOH task-state mutations during the shadow build and atomic install.
3. **Recovery source:** merge the legacy ledger with the retained partial epoch-4 entities.
4. **Safety boundary:** preserve exact source bytes and use the existing rollback transaction.
5. **Implementation gap:** add partial-v4 salvage plus live project-context reinstallation; do not run the current migration CLI beside production.

## A. Repository Intent

1. **Recoverable state failures stop at their owning scope.** The server, diagnostics, healthy projects, and unrelated execution lanes remain available.
2. **Invalid durable bytes remain evidence.** Recovery validates a shadow result before installing it and retains exact rollback material.
3. **Task Markdown and task-state heads advance causally.** A mutation never treats stale, missing, or conflicting content as empty.
4. **Operator-authored notes remain recoverable.** A rejected response preserves one stable note identity and one retryable intent.

---

## B. Current Iteration Intent

1. Replace restart-based recovery with automatic project-scoped recovery for compatible local task-state damage.
2. Rebuild incompatible derived federation caches without pausing hosted local projects.
3. Eliminate the observed `task_content_local_mismatch` race without adopting arbitrary local bytes.
4. Prevent image uploads from creating unreferenced assets when the owning thread already fails content preflight.
5. Reuse the existing thread-message receipt for image-note retry, reload recovery, and exact backend errors.

---

## C. Verified Findings

1. **The process restart requirement is false.**
   1. `/api/diagnostics/runtime/resume` already replaces one `ProjectTaskState` and one project context.
   2. `runTaskCurrentStateMigrationTransaction()` already owns exact backup, shadow build, source fingerprint validation, atomic installation, and rollback.
   3. The missing code is partial-v4 salvage plus safe live reinstallation for one project.
2. **The current resume ordering is unsafe and incomplete.**
   1. It removes the project pause before state validation succeeds.
   2. It opens the replacement state before disposing the old context.
   3. `disposeProjectContext()` clears SSE clients without ending their responses.
   4. It omits an explicit Control Room invalidation after replacement.
3. **The MOH recovery source is mixed.**
   1. The legacy ledger owns missing lifecycle, assignment, and relationship-position semantics.
   2. The partial v4 root owns newer entities absent from the legacy ledger.
   3. The current migration planner rejects that partial root because `format.json` is missing while v4 entities exist.
4. **Derived federation cache corruption is not local-project corruption.**
   1. `unsupported_task_current_state_format` currently leaves `federated-task-state:<projectId>` paused.
   2. The cache is rebuildable from relay state.
   3. Its invalid bytes still require an exact quarantine archive.
5. **The Lys image failure is a two-request content race.**
   1. `/api/thread-image-upload` installs original bytes, preview bytes, and resource heads before note admission.
   2. The following `append-note` can fail with `409 task_content_local_mismatch`.
   3. Current tests cover upload and mismatch independently; they do not cover the combined failure sequence.
6. **The mismatch gate is correct but lacks synchronization with its own watcher.**
   1. A direct owned Markdown change is debounced by `watchCardContentFiles()`.
   2. The task PATCH can validate the file before that pending event calls `recordContentContribution()`.
   3. Automatically adopting an unobserved mismatch would weaken corruption protection.
7. **Image-note recovery infrastructure already exists.**
   1. Text notes persist `PendingThreadMessage` before submission.
   2. `commitPendingThreadMessage()` preserves the exact error, stable note ID, manual retry, and reload restoration.
   3. Commit `4035a63b` on `origin/dev` already changes pasted images to reuse that receipt.
8. **Expected request failures currently pollute active incidents.**
   1. `GET /api/tasks/:cardId/execution-state` lets typed `TaskExecutionAdmissionError` escape.
   2. The outer HTTP catch records it as an active `http-request:*` incident.
   3. A missing card is a `404` response, not a paused runtime scope.
9. **Paused-project fallback is misleading.**
   1. `taskProjectionForProject()` falls back to retired aggregate `tasks.json`.
   2. The Control Room then renders invalid task cards from non-authoritative data.
   3. One project recovery diagnostic is the truthful projection while authoritative state is paused.
10. **The Skill Library outage crosses an unrelated component gate.**
   1. `GET /api/codex/server-skills` currently returns `200`.
   2. `GET /api/codex/server-pipelines` returns `503 runtime-scope-paused` for `codex-pipeline-store:/home/jbb/.decision-os/codex-pipelines.json`.
   3. The pipeline store contains stale `contentKind` discriminators that disagree with the current skill catalog.
   4. `loadGlobalLibraries()` awaits skills and pipelines through one `Promise.all`, so the pipeline rejection clears the healthy Skill Library.
11. **A process-wide request gate also exists.**
   1. Every `uncaughtException` and `unhandledRejection` installs `globalRuntimeIncident`.
   2. The request boundary then rejects every non-diagnostic route through `if (globalRuntimeIncident)`.
   3. Keeping a potentially inconsistent process alive in a permanent globally paused state is not supervised fatal recovery.

---

## D. Minimal Remediation Path

1. **Remove cross-component read gates first.**
   1. Load server skills independently from server pipelines.
   2. Keep the Skill Library usable when pipeline listing fails and show one pipeline-specific diagnostic.
   3. Normalize stale pipeline `contentKind` values for read projection without rewriting invalid durable bytes.
   4. Mark only pipelines containing unresolved references as non-admissible.
   5. Keep healthy pipeline reads and executions available.
   6. Persist a corrected discriminator only through the existing explicit pipeline save path.
2. **Replace the global zombie gate with supervised fatal handling.**
   1. Remove the `globalRuntimeIncident` request-admission check.
   2. Catch expected asynchronous failures at their owning operation before they reach process handlers.
   3. For a genuine uncaught process-wide invariant, record fatal evidence and terminate once for the external supervisor.
   4. Keep health and incident evidence available through supervisor-owned logs across restart.
3. **Correct request and diagnostic classification.**
   1. Catch `TaskExecutionAdmissionError` in execution-state reads and return its declared status and code.
   2. Keep expected domain rejections out of active incident state.
   3. Render one project recovery diagnostic for a paused task root and suppress retired aggregate task cards.
4. **Add automatic local project recovery by composing existing machinery.**
   1. Extend the migration planner to accept a missing-format root containing valid v4 entities as a retained delta source.
   2. Validate every retained entity, project identity, causal register, object reference, and immutable object before shadow construction.
   3. Build the canonical migrated legacy baseline, then merge the retained delta through `TaskCurrentStateStore.merge()`.
   4. Run the existing migration transaction for the affected project only.
   5. Use one in-memory recovery promise per project and the existing admission marker schema with `projectId`; add no recovery database.
   6. Keep task writes paused during shadow work while reads expose the project recovery diagnostic.
   7. Dispose the project context only for the commit and reopen window; end its SSE responses so clients reconnect.
   8. Install and validate the replacement state, reinstall the context, invalidate the project projection, then resolve the incident.
   9. Trigger relay reconciliation after local recovery. Relay unavailability keeps federation degraded and does not roll back valid local state.
   10. A failed validation or local installation retains the pause, incident, archive, and original bytes.
5. **Rebuild incompatible derived caches automatically.**
   1. On `unsupported_task_current_state_format` under `federated-task-state`, move the exact cache root to a timestamped quarantine path.
   2. Create one empty compatible cache and request normal relay reconciliation.
   3. Keep the hosted local project available throughout.
   4. Resolve the cache incident only after the compatible store opens.
6. **Close the content-head race without weakening the gate.**
   1. Give `watchCardContentFiles()` an awaited flush for one exact owned Markdown path.
   2. On `task_content_local_mismatch`, flush only that path and await its queued `recordContentContribution()`.
   3. Re-run materialization once.
   4. Preserve the original `409` when no pending owned watcher event exists.
   5. Preserve `task_content_conflict` when multiple causal heads remain.
7. **Make the image flow recoverable with existing anchors.**
   1. Preflight the projected thread resource inside `/api/thread-image-upload` before creating image files and resource heads.
   2. Preserve the backend upload error code and `contentFile` in the frontend response.
   3. Promote the `4035a63b` image controller change after focused verification.
   4. Persist image Markdown through `PendingThreadMessage`, then commit through `commitPendingThreadMessage()`.
   5. Retry with the same note ID and existing uploaded URL; never upload a second copy for the same pending note.

---

## E. Required Regressions

1. **Online recovery:** a partial v4 root plus legacy omissions recovers without process restart, retains newer v4 entities, restores required fields, and leaves another project writable.
2. **Recovery failure:** an invalid retained entity leaves source bytes unchanged, retains the project pause, and keeps diagnostics online.
3. **Context replacement:** existing SSE responses end, clients reconnect, and the project Control Room slice refreshes.
4. **Relay outage:** local recovery remains installed while federation reports degraded state and retries reconciliation.
5. **Derived cache:** an incompatible phone cache is archived and rebuilt without pausing the hosted project.
6. **Expected HTTP error:** a missing execution-state card returns `404 task_card_not_found` and creates no active incident.
7. **Watcher race:** an exact pending watcher event advances the head, then one append preserves the existing edit and new note.
8. **Unobserved mismatch:** a mismatching file with no pending owned event remains byte-identical and returns `409`.
9. **Image preflight:** failed thread materialization creates no image directory, original, preview, or resource head.
10. **Image retry:** a rejected append retains the image Markdown receipt across reload and retries with the same note ID without re-upload.
11. **Skill containment:** an invalid pipeline store leaves server skills readable and renders one pipeline-specific diagnostic.
12. **Pipeline containment:** one invalid pipeline does not block listing and executing a healthy pipeline.
13. **Fatal boundary:** a contained detached failure leaves unrelated routes available; a genuine process invariant records evidence and exits once for supervised recovery.

---

## F. Over-Engineering Cuts

1. **Remove a combined upload-and-note transaction.** It would duplicate task mutation, content capture, rollback, and response recovery.
2. **Remove a new recovery service database.** The existing project ID, pause map, incident ledger, transaction journal, and admission marker already own the required identities.
3. **Remove an image upload manifest, orphan registry, pending-image model, cleanup scheduler, and asset database.** `PendingThreadMessage` plus the image URL already preserve the recoverable intent.
4. **Remove automatic adoption of arbitrary mismatching bytes.** Only an observed pending watcher event receives one bounded reconciliation attempt.
5. **Remove rollback on relay publication failure.** Relay state is downstream of a valid local recovery.
6. **Remove a new polling channel.** Existing SSE invalidation and retry controls own refresh.
7. **Remove manifest-pinned snapshot architecture from this iteration.** Epoch 4 already has entity files, journals, immutable objects, bucket manifests, root hashes, and a previous-source archive.
8. **Remove generic conflict-resolution work from this incident.** Preserve explicit conflicts; implement only project recovery and the exact stale-head race.
9. **Remove global in-process pause as fatal recovery.** It creates a permanent outage without restoring process integrity.
10. **Remove all-or-nothing Skill Library loading.** Skills and pipelines already have separate routes and separate durable owners.

---

## G. Bloat Register

1. **Earlier recovery steps 2 through 14 — redundant process detail — compress.** Replace them with the four owned boundaries: prepare, transact, reinstall, reconcile.
2. **“Publish the complete task delta, reconcile federation, await execution recovery, and schedule eligible Codex work” — over-coupled — split.** Local state installation owns recovery success; federation and Codex resume through their existing contained lanes.
3. **“Roll back on publication failure” — incorrect extra scope — delete.** It converts a downstream outage into local data rollback.
4. **Generic validated-snapshot and new-manifest proposals — duplicate persistence — delete.** Existing epoch-4 persistence already answers inventory, integrity, rollback, and root identity.
5. **Image-specific durable objects — duplicate intent state — delete.** The existing pending-message receipt answers retry identity and reload recovery.
6. **Full-project scans and periodic orphan cleanup — off-purpose — delete.** Exact path preflight prevents the reported orphan condition.
7. **`Promise.all` across Skill Library and pipeline catalog — cross-component coupling — rewrite.** Render healthy skills and report the pipeline failure separately.
8. **`runtime-scope-paused` in a read-only Skill Library — misplaced failure state — delete.** The pipeline incident belongs to pipeline diagnostics and affected pipeline admission.

---

## H. Operator Decision Summary

1. **Selected design:** independent read surfaces, owner-scoped admission gates, supervised fatal exit, automatic project recovery, derived-cache rebuild, exact watcher flush, and existing pending-message reuse.
2. **No restart:** recovery installs and reopens one project inside the running server.
3. **No second source of truth:** the plan adds no recovery database, image registry, content manifest, polling system, or generic conflict model.
4. **Promotion boundary:** `origin/dev` already contains the minimal image receipt reuse; it still needs the server preflight, watcher-race correction, exact error test, and canary proof.
5. **Implementation order:** Skill Library containment, fatal-gate removal, diagnostic classification, local recovery, cache rebuild, content race, image recovery, focused tests, typecheck, then one full suite.

## A. Repository Intent

1. **Decision OS must contain recoverable failures to their owning scope.** Unrelated projects, HTTP routes, federation traffic, health routes, and diagnostic routes remain available.
2. **Runtime incidents must be actionable.** The durable ledger retains scope, component, operation, stable code, message, stack, timestamps, occurrence count, and task-specific context.
3. **A displayed pause must describe a real admission boundary.** A derived cache failure must not be presented as a pause of an otherwise available local project.

---

## B. Current Iteration Intent

1. **Reviewed target:** `.worktrees/dev` at `23546cc5`, tracking `origin/dev`; its runtime is serving port `50151`.
2. Commit `28288d1c` added `/status` to show every catalog project's availability and pause state plus grouped active runtime incidents.
3. Commit `e2b672e7` made direct `/status` navigation serve the responsive application.
4. Commit `0a8ae5f5` added a regression for displaying `server-runtime` as an interruption.

---

## C. Findings

1. **Critical — the status screen is unavailable during a global runtime pause.** The dev backend exempts only `/api/health` and `/api/diagnostics/incidents` before the `server-runtime` admission gate (`.worktrees/dev/backend/src/business/server/helper/create-http-server.ts:2450-2468,2559`). Direct `/status` HTML and `/decision-os/projects` are behind that gate. The frontend also fetches `/decision-os/projects` before it dispatches the `/status` route and before it requests diagnostics (`.worktrees/dev/frontend/src/app/responsive/application.js:2949-2962,3029-3031`). Startup emergency mode serves only the two JSON endpoints and returns `503` for `/status` (`.worktrees/dev/backend/src/server.ts:37-55`). The highest-impact failures therefore remove the operator-facing diagnostic screen.
2. **Critical — whole-project status overstates derived cache failures.** `projectPauseReasons()` converts every entry in `pausedFederatedTaskProjectIds` into the project-level reason `Federated task state`, then `projectRuntimeRows()` gives that reason precedence over catalog and replica availability (`.worktrees/dev/frontend/src/app/responsive/runtime-status.js:21-58`). The backend scope owns the workstation's derived federation cache under `<server-root>/.decision-os/cache/federation-task-state`, not the local project's authoritative task state (`.worktrees/dev/backend/src/business/server/helper/create-http-server.ts:966-1005`). The current dev canary has no federated-cache pause, but the deterministic projection marks an otherwise available local project **Paused** whenever that cache scope is present.
3. **Critical — unresolved incident is treated as runtime pause.** The ledger has only `paused` and `resolved` statuses (`.worktrees/dev/backend/src/business/server/helper/runtime-incident-ledger.ts:10-25`). The generic request catch records every unclassified exception as an active `paused` incident even though it does not add that request scope to any paused runtime registry (`.worktrees/dev/backend/src/business/server/helper/create-http-server.ts:5602-5660`). `/api/health` then reports `degraded` whenever any ledger entry remains `paused` (`.worktrees/dev/backend/src/business/server/helper/create-http-server.ts:2450-2468`). Live port `50151` reports **7 active incidents**, **zero paused projects**, and **zero paused background components**. The screen reduces that to **2 grouped errors / 13 occurrences** and labels the whole system `Degraded`.
4. **High — several displayed active incidents have no recovery lifecycle.** `/api/diagnostics/runtime/resume` supports project task state, federated task state, background component, project watcher, project runtime, and server runtime scopes (`backend/src/business/server/helper/create-http-server.ts:2327-2416`). It cannot resume or resolve `http-request:*` and `server-listener`. Those entries can remain current indefinitely despite the owning request having settled and the production listener being online.
5. **High — interruption classification is a registry-name join, not impact truth.** `interruptionScopes()` marks every paused federated cache and every paused background component as an interruption (`frontend/src/app/responsive/runtime-status.js:10-18`). A failed optional remote library synchronization is therefore labeled `Interruption`, while the live fatal `server-listener` incident is labeled `Error` because its scope is absent from the hard-coded set.
6. **High — resume can return success before durable recovery is complete.** Pause collections are cleared before validation, unknown `background:*` components reach unconditional success, and `server-runtime` is cleared without validating a recovered process invariant (`.worktrees/dev/backend/src/business/server/helper/create-http-server.ts:2362-2447`). `resolveScope()` returns an empty result after a persistence failure, but the endpoint still returns `200` from the earlier `resumed` flag (`.worktrees/dev/backend/src/business/server/helper/runtime-incident-ledger.ts:254-273`).
7. **High — active incidents can be evicted while their runtime pause survives.** Retention sorts active and resolved entries together, then keeps only the newest `maxIncidents` records (`.worktrees/dev/backend/src/business/server/helper/runtime-incident-ledger.ts:217-223`). Health can therefore lose the incident that explains a still-populated pause registry.
8. **High — the screen discards actionable incident identity and severity.** Grouping retains aggregate severity internally (`.worktrees/dev/frontend/src/app/responsive/runtime-status.js:66-106`), but rendering never displays it and reduces every non-registry-matched incident to `Error` (`.worktrees/dev/frontend/src/app/responsive/application.js:996-1023`). The renderer also drops incident IDs, operation, context, first observation, and resolution information. Operators cannot correlate a card with the durable incident record or see the evidence required to validate recovery.
9. **High — reading a corrupt incident ledger mutates the evidence.** The diagnostic read path renames the invalid canonical file, installs a new incident document, and persists it (`.worktrees/dev/backend/src/business/server/helper/runtime-incident-ledger.ts:129-176`). This violates the repository requirement that invalid durable state remain byte-identical.
10. **Medium — grouping is unstable across message variations and hides distinct failures.** The key is exact `code + message` (`.worktrees/dev/frontend/src/app/responsive/runtime-status.js:69-73`). Message variations split the same owning failure, while identical messages from distinct operations are merged without retaining their incident IDs.
11. **Medium — automated coverage proves helpers and route text, not the rendered screen.** `.worktrees/dev/frontend/test-responsive/runtime-status.test.mjs:7-80` tests one local task-state pause, one synthetic grouped incident, one synthetic server pause, the fetch wrapper, and source-string presence. It does not cover the fatal diagnostic boundary, a federated-cache failure beside a healthy local replica, stale request errors, durable resolution, active-incident retention, fatal severity, incident identity, render output, refresh failure, or status recovery. The backend route test proves only that `/status` returns application HTML during normal admission.
12. **Verified strengths.** Direct routing works while the server runtime is admitted; diagnostics are fetched with `cache: no-store` and route cancellation; DOM text is assigned through `textContent`; resolved incidents are excluded from the frontend; current pause registries are returned by the diagnostic endpoint; the view does not mutate or resume runtime state.

---

## D. Remediation Paths

1. **Keep the diagnostic UI outside runtime admission gates.** Serve `/status`, its static dependencies, a minimal catalog status projection, `/api/health`, and `/api/diagnostics/incidents` through the failsafe diagnostic boundary.
2. **Separate incident lifecycle from pause lifecycle.** Replace the overloaded active state with explicit `active` incident lifecycle plus an `impact` value derived from the owning runtime boundary. Only a scope installed in an admission gate receives `impact: interrupted`.
3. **Project authoritative status from authoritative boundaries.** Project `Paused` is driven by `project-task-state`, `project-watcher`, `project-runtime`, `background:codex-runtime:<projectId>`, and `server-runtime`. A `federated-task-state:<projectId>` failure is displayed as a replica-cache degradation attached to the affected replica, not as a whole-project pause.
4. **Close settled request incidents automatically.** Expected input and not-found responses bypass incident creation. Unexpected request exceptions are recorded, then resolved when the failed request boundary has stopped without persistent scope damage.
5. **Make recovery atomic and durable.** Re-read and validate durable state, install recovered runtime state, persist incident resolution, then clear the in-memory pause. Genuine fatal server invariants exit through the supervisor and are not resumable in-process.
6. **Protect active incident owners from retention.** Evict resolved history first and retain every incident referenced by a live pause registry.
7. **Preserve corrupt incident bytes.** Keep the canonical invalid file byte-identical, pause the incident-ledger scope, and expose diagnostics from a separate in-memory failsafe record.
8. **Return a status projection from the backend.** Add explicit `impact`, `affectedProjectIds`, `affectedReplicaNodeIds`, and `recoverableScope` fields to the diagnostic response. The frontend renders this contract instead of reconstructing operational impact from scope prefixes.
9. **Keep grouped summaries while preserving evidence.** Group by stable code and owning operation, retain member incident IDs, show highest severity, show first and last observation, and expand to member scopes plus context.
10. **Add contract and rendering regressions.** Prove the status screen remains readable during `server-runtime` and startup failure; a healthy local project stays available when only its federated cache is paused; an authoritative task-state pause marks only its project paused; a settled expected request does not degrade health; active incident owners survive retention; failed persistence keeps recovery paused; fatal severity remains visible; grouped cards retain incident IDs; successful scoped recovery changes the same displayed scope to healthy.

---

## E. Operator Decision Summary

1. **Decision: the screen is not operationally correct yet.** Its route, safe rendering, and basic grouping are sound, but it conflates retained errors, actual runtime pauses, replica-cache degradation, and whole-project availability.
2. **Highest-yield correction:** make the backend publish explicit impact and ownership, then make the frontend a direct projection of that contract.
3. **Do not add restart controls.** Recovery remains scope-specific and validation-gated; the status screen observes and explains it.
