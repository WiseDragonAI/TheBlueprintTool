## A. Repository Intent

1. **Epoch 4 makes replicated execution entities the only runtime lifecycle authority.** Direct runs, continuations, pipeline skills, voice handoffs, cancellation, recovery, status, and Control Room projection must read the same execution repository.
2. **The offline migrator remains the only legacy-state consumer through cutover.** It must preserve and decode epoch-3 card fields, the process queue, the legacy canonical execution file, and mutable pipeline history while the servers are stopped.
3. **Conversation and evidence survive authority removal.** Provider session history, immutable pipeline topology, JSONL, stderr, telemetry, result artifacts, and exact-hash retrieval remain available without determining lifecycle.

---

## B. J.12 Iteration Intent

1. **Delete duplicate runtime authorities.** Remove `executionIntent`, the process queue, the legacy canonical execution coordinator, card execution leases, mutable pipeline scheduling state, log-derived settlement, and note-backed voice lifecycle.
2. **Preserve compatible endpoint shapes.** Status, launch, cancellation, restart, and artifact endpoints continue returning their established response fields, with lifecycle values derived from replicated execution entities.
3. **Leave migration evidence byte-preserving.** Legacy decoders move behind a migration-only boundary instead of being weakened or removed before `J.14`.

---

## C. Verified Findings

1. **The scheduler still selects two authorities.** `codex-process-scheduler.ts` selects replicated executions and legacy mutable pipeline runs; the latter path calls `runNextPipelineSkill`.
2. **Direct launch controllers still contain complete queue fallbacks.** Thread start and continuation route epoch-4 admissions through `TaskExecutionRouter`, then retain pre-epoch-4 queue admission, card lease, canonical coordinator, and cleanup branches.
3. **Server startup still installs the superseded canonical coordinator.** `create-http-server.ts` migrates the legacy queue into `.decision-os/codex-executions.json`, projects `executionIntent`, publishes a second observation stream, and reprojects active legacy records.
4. **Card projection still writes duplicate authority fields.** `project-card-codex-run.ts` writes `codexActiveRunId`, `codexActiveExecutionId`, current-run fields, and mutable pipeline metadata in addition to durable provider session history.
5. **Pipeline manifests still mutate lifecycle.** `codex-pipeline-runner.ts` writes skill status, process identity, timestamps, and errors, then recalculates business state through `reassessPipelineAfterSkill`.
6. **Status and control endpoints retain fallbacks.** Detailed status, compact status, cancellation, session deletion, and pipeline reads consult queue records, card leases, the legacy coordinator, mutable manifest phase, and log events after checking replicated entities.
7. **Voice notes retain a second execution state machine.** Queue status, run ID, execution ID, requested time, and error are persisted on notes even though admission already has a stable request identity.
8. **Migration requires every legacy representation.** `prepare-epoch4-execution-migration.ts` reads the legacy queue, canonical file, card leases, `executionIntent`, pipeline history, and artifacts to build stopped-server migration output and rollback evidence.

---

## D. Selected Remediation

1. **Make epoch-4 dispatch unconditional.** Public controllers admit through `TaskExecutionRouter`; the scheduler alone invokes process launch from a replicated `starting` execution.
2. **Delete the legacy canonical runtime.** Remove its startup migration, coordinator installation, projection, observation publication, status fallbacks, tests, and runtime schema. Retain a migration-scoped decoder for its file format.
3. **Delete card lifecycle authority.** Remove execution-intent mutations, active lease readers and writers, lease cleanup, startup reconciliation, and frontend lease fallbacks. Keep only `codexThreadRunId`, `codexThreadRunIds`, and their output-file mappings for provider continuity.
4. **Make pipeline manifests topology-only at runtime.** The scheduler reads dependency order and execution identity from the manifest, then derives every lifecycle field from replicated execution records. Restart creates new immutable topology.
5. **Treat logs as diagnostics only.** Child `close` and `error` events settle executions. JSONL, stderr, and telemetry remain append-only evidence and never override replicated phase.
6. **Use one voice execution identity.** Keep transcription fields, `codexQueueRequestId`, launch mode, target card, and pipeline ID for explicit retry. Remove note-backed lifecycle fields and sequence follow-up work with execution predecessors.
7. **Remove frontend aliases last.** Control Room, thread widgets, and run-status requests consume the canonical execution DTO and retained session history after backend fallbacks are gone.

---

## E. Tradeoff Record

1. **Migration code intentionally retains obsolete field names until production cutover.** This is isolated compatibility, not runtime authority; deleting those decoders before `J.14` would make rollback-safe conversion impossible.
2. **Endpoint DTOs retain familiar status and timestamp fields.** Their values become projections of replicated executions, avoiding a simultaneous client contract break while eliminating duplicate persistence.
3. **Provider run IDs remain on cards.** They select conversation history only and cannot grant liveness, cancellation authority, scheduler eligibility, or settlement.
4. **Artifacts remain readable after authority removal.** This preserves diagnosis and result access while forbidding log parsing from changing business state.

---

## F. Verification Decision

1. **Focused regressions must prove authority rejection.** Contradictory queue files, card leases, mutable pipeline phases, and terminal log text must not affect status, cancellation, scheduling, or recovery.
2. **Migration verification must prove compatibility.** Every legacy input remains convertible with byte-preserving backups and a complete report.
3. **Repository checks must find no production consumer of removed authorities.** Migration-only references are explicitly allowed until `J.14`.
4. **Full backend and frontend suites run only after focused authority tests and scoped typechecks pass.**
