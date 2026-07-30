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
