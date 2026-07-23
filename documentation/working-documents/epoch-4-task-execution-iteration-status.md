## A. Iteration Identity

1. **Objective:** execute `documentation/codex-task-assignment-and-replicated-execution-plan-2026-07-23.md` through local implementation, automated verification, served proof, runbooks, migration readiness, and production-readiness evidence.
2. **Implementation branch:** `feature/epoch4-task-execution`.
3. **Base commit:** `0c72b4ed95c12bcfb0a27ddcbf56f4ecfdba5df7`.
4. **Production branch:** `main`.
5. **Current phase:** `J.13 served verification and J.14 cutover preflight`.
6. **Overall state:** `in-progress`.
7. **Production state:** epoch `3` remains active. Epoch `4` is not admitted for production use.

---

## B. Remote Progress Check

1. Fetch the implementation branch without changing the checked-out branch:

   ```bash
   GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' \
     git fetch origin feature/epoch4-task-execution
   ```

2. Read this ledger directly from the fetched branch:

   ```bash
   git show origin/feature/epoch4-task-execution:documentation/working-documents/epoch-4-task-execution-iteration-status.md
   ```

3. Inspect the implementation commits:

   ```bash
   git log --format='%h %cs %s' origin/main..origin/feature/epoch4-task-execution
   ```

4. Inspect changed files:

   ```bash
   git diff --stat origin/main...origin/feature/epoch4-task-execution
   ```

5. **Interpretation:** only rows marked `verified` have passing evidence. `implemented` means source work exists but its complete gate has not passed. `pending` means no completion claim.

---

## C. Plan Gate Ledger

1. **J.1 — Freeze epoch-4 contracts:** `verified`.
   1. Required evidence: shared assignment and execution schemas, phase transition rules, CRDT merge behavior, relay protocol admission, and focused tests.
   2. Implemented atomic assignment, execution metadata, execution lifecycle, execution artifact, and `cancelling` contracts.
   3. Implemented explicit assignment and execution conflict classification.
   4. Implemented relay epoch-4 admission, `state:v4` storage keys, and `FederationRelayV4` Durable Object namespace migration.
   5. Focused backend result: `30` tests passed.
   6. Relay result: `8` tests passed.
   7. Backend and relay typechecks passed.
2. **J.2 — Build the offline migrator:** `verified`.
   1. Accepts epoch-3 current shards and projection captures and publishes protocol, schema, and baseline epoch `4` only after durable conversion.
   2. Requires CLI `--target-epoch 4` and one explicit `--default-assigned-node`; the production runbook uses `workstation` on both nodes.
   3. Assigns every master task to `workstation`; subtasks retain inherited assignment.
   4. Converts canonical execution records, direct queue entries, all pipeline skills, active card intents, and retained thread sessions into execution entities.
   5. Converts every non-terminal legacy attempt to `interrupted`, retains terminal history, links pipeline predecessors, and captures available artifacts by exact hash.
   6. Preserves pipeline definitions while removing mutable run manifests after backup; retires the canonical legacy execution file and direct queue after entity installation.
   7. Reports protocol, schema, epoch, assignment coverage, execution-index validity, missing artifacts, missing objects, semantic inventory, zero journals, checksums, roots, and external rollback paths.
   8. Focused migration result: `11` tests passed.
   9. Backend typecheck passed.
3. **J.3 — Persist task assignment:** `verified`.
   1. The existing creation modal keeps its node tabs, presence, project selection, keyboard behavior, and request routing while persisting the selected node as `assignedNodeId`.
   2. Optimistic task identity is now `projectId`, `ledgerId`, and `cardId`; serving-replica ownership no longer splits one logical task.
   3. Master tasks persist one atomic assignment lane. Subtasks inherit that assignment and reject direct reassignment.
   4. The project-scoped `reassign-task` command resolves assignment conflicts by writing one revision above every observed candidate and rejects non-terminal execution with `task_execution_active`.
   5. CLI-created master tasks require an explicit assignment and retain the separate publication operation.
   6. Internal project-sync and runtime-incident master-task creation supply the local configured node assignment.
   7. The Control Room joins replicas into one task identity and displays assignment label plus online state independently from replica provenance.
   8. Focused backend result: `24` distinct assignment and supporting tests passed.
   9. Focused frontend result: `47` tests passed.
   10. Backend and frontend typechecks passed.
4. **J.4 — Install the replicated execution repository:** `verified`.
   1. Project task state now owns one epoch-4 execution repository backed by execution entities and the existing journal, shard, bucket, root, and federation publication path.
   2. Admission is idempotent by `taskId` plus `requestId`; concurrent execution IDs for one request remain explicit blocked diagnostics.
   3. Awaited lifecycle transitions enforce the canonical phase graph, immutable executor, immutable provider session, monotonic timestamps, and revision increments.
   4. Terminal artifact manifests are independently revisioned and contain exact content heads.
   5. Rebuildable indexes cover task, session, pipeline run, phase, executor node, and request identity.
   6. Entity, lifecycle, and request conflicts are excluded from scheduling indexes and remain visible in Control Room diagnostics.
   7. Control Room derives active task placement from execution entities, invalidates by indexed task ID, and retains legacy card-intent reading only for the open legacy-removal gate.
   8. Offline migration now emits the required all-null artifact lane for executions without captured files; the repository indexes every migrated execution.
   9. Focused backend result: `76/76`.
   10. Backend typecheck passed.
5. **J.5 — Install assignment-aware admission:** `verified`.
   1. One `TaskExecutionRouter` resolves every task source to its master and reads the master’s conflict-free assignment before choosing a destination.
   2. Local admission serially persists `preparing`, validates the lineage, active-execution fence, predecessor, session policy hook, and capacity policy hook, then persists `queued`.
   3. Local retries return the original durable receipt by `projectId`, `taskId`, and `requestId`; concurrent direct admissions allow exactly one queued execution.
   4. Connected remote assignment uses the connector’s authenticated node request and the assigned node’s identical local admission path.
   5. Offline assigned nodes return `assigned_node_unreachable` with `assignedNodeId` and create no execution on the requesting node.
   6. Assignment conflict blocks before admission. A local post-`preparing` validation rejection is retained as one durable failed execution.
   7. Non-task execution binds directly to the current node and creates no task assignment state.
   8. The internal admission route requires a currently online authenticated federation peer.
   9. The server no longer includes relay-root equality in the project task-state write predicate.
   10. Focused router and server result: `20/20`.
   11. Backend typecheck passed.
6. **J.6 — Replace direct execution authority:** `verified`.
   1. Direct thread start and continuation now admit one replicated execution entity through `TaskExecutionRouter` and return an immediate durable queued receipt.
   2. The scheduler selects local direct work from the replicated `queued` index, persists `starting`, awaits spawn registration and `running`, then persists the terminal phase.
   3. Direct execution creates neither `.decision-os/codex-process-queue.json` nor `.decision-os/codex-executions.json`.
   4. The node-local process registry owns child handles, process identity, and artifact paths without replicating process state.
   5. The configured node identity remains authoritative for local execution while relay transport is disconnected or incompletely configured.
   6. Admission responses retain deterministic artifact paths and continuation metadata while reporting `startedAt = null` until the scheduler actually spawns the process.
   7. Detailed direct-run status prefers the latest replicated execution lifecycle over stale log activity.
   8. Dispatch rejection settles only the claimed execution as `failed`, records an execution-scoped incident, leaves the scheduler usable, and does not create a child.
   9. Focused direct and compatibility result: `42/42`.
   10. Router and federation regression result: `17/17`.
   11. Backend typecheck passed.
7. **J.7 — Replace pipeline execution authority:** `verified`.
   1. Saved pipeline admission creates every skill execution in one serialized batch and publishes scheduler callbacks only after the complete topology is durable at `queued`.
   2. Every skill records its immediate predecessor. The scheduler claims only a local dependency-ready execution and persists `starting` before process creation.
   3. Spawn registration writes the node-local process registry and awaits replicated `running`; settlement removes the process entry and awaits one replicated terminal phase.
   4. Pipeline, step, and skill status are derived from replicated execution entities. The saved run manifest remains byte-stable with initial `pending` lifecycle fields during execution.
   5. Saved pipelines no longer project card execution leases, task `executionIntent`, background lifecycle persistence, PID, process start identity, and terminal status into the pipeline manifest.
   6. A failed or cancelled execution settles every downstream queued execution as `cancelled` with `pipeline_dependency_failed`.
   7. Exact local cancellation persists `cancelling` before signalling the registered process and applies a bounded `SIGKILL` escalation.
   8. Restart creates a new pipeline run, new execution IDs, `restartOfPipelineRunId`, and per-execution `restartOfExecutionId`. Prior cards, logs, records, and output bytes remain unchanged.
   9. Focused pipeline result: `8/8`.
   10. Scheduler, router, store, and direct regression result: `21/21`.
   11. Backend typecheck passed.
8. **J.8 — Move exceptional launch paths:** `verified`.
   1. Direct skills use the same temporary-pipeline admission, replicated execution topology, global capacity, node-local process registry, and terminal settlement as saved pipelines.
   2. Voice upload persists one retry-stable request identity plus launch mode, card, and pipeline target before handoff. Execution identity and lifecycle exist only in the replicated execution repository.
   3. Voice failure retains transcript and audio evidence, exposes the server-owned execution error, and remains retryable after reconciliation.
   4. Project synchronization pre-admits its complete three-role executor plan and runs every role through the shared scheduler. It has no role-specific capacity semaphore or manual lifecycle transition chain.
   5. A selected remote node installs and validates the immutable federated manifest before execution. Executor-local artifact paths do not alter logical topology identity.
   6. A remote project-sync role executes against its selected checkout while mutating the replicated execution lane of the initiator’s master-task project.
   7. Federated role runtimes participate in the same global scheduler candidate set and running-process capacity count.
   8. Project runtime creation preserves the existing task-state incident boundary and keeps catalog, diagnostics, and Control Room reads online when one task-state scope is paused.
   9. Focused backend result: `32/32`.
   10. Focused frontend voice and thread result: `44/44`.
   11. Backend typecheck passed.
9. **J.9 — Replace control paths:** `verified`.
   1. Card and pipeline cancellation resolve the replicated execution, persist `cancelling`, route to the immutable executor node, and bound local `SIGTERM` to `SIGKILL` escalation.
   2. Session deletion rejects active executions, tombstones every terminal execution atomically, publishes the session resource deletion marker, and retains content-addressed artifacts for convergence-aware collection.
   3. Compact status, detailed status, Control Room, and SSE consume replicated lifecycle phase, phase timestamp, executor, revision, valid actions, and artifact heads.
   4. Active remote detailed status is authenticated-proxied to its executor. Terminal status retrieves missing content lazily by exact SHA-256 and reads the local verified object.
   5. Terminal settlement retains live file paths through immutable artifact-head capture, then removes the node-local process entry.
   6. SSE emits revisioned execution changes. Frontend reconciliation ignores stale lifecycle revisions and renders `cancelling` from its replicated phase timestamp.
   7. Focused backend control-path result: `46/46`.
   8. Focused frontend Control Room result: `3/3`.
   9. Backend and frontend typechecks passed.
10. **J.10 — Replace recovery:** `verified`.
    1. Startup reads locally assigned `starting`, `running`, and `cancelling` executions from replicated epoch-4 state.
    2. Recovery adopts only a registered child whose PID and process-start identity still match.
    3. A missing or stale process settles as `interrupted`; available local JSONL, stderr, and telemetry files are captured before the registry entry is removed.
    4. Locally assigned queued executions wake the shared scheduler.
    5. Server startup, operator component recovery, and pipeline settlement no longer call direct queue recovery, pipeline resume, and card ownership reconciliation.
    6. Late legacy direct-queue entries remain inert.
    7. Focused recovery and scheduler result: `32/32`.
    8. Backend typecheck passed.
11. **J.11 — Complete optimistic frontend behavior:** `verified`.
    1. Thread, continuation, direct-skill, pipeline, master-completion, and voice launches create an idempotency request identity before admission.
    2. Responsive launches immediately project the owning master task into Exec as `preparing`, using its durable assigned node and a local phase timestamp.
    3. Admission receipts rekey pipeline request prefixes to the exact replicated request ID and retain the optimistic projection until the returned execution revision is canonical.
    4. Rejected admission removes only the matching optimistic request, reloads canonical Control Room state, and exposes the server error in the active application surface.
    5. Voice handoff derives `voice:<noteId>` from the durable local note and preserves that identity through late upload rejection.
    6. The direct-skill compatibility response now returns the replicated admission receipts required by frontend reconciliation.
    7. Full frontend result: `534/534`.
    8. Focused direct-skill receipt result: `1/1`.
    9. Backend and frontend typechecks passed.
12. **J.12 — Delete legacy authorities:** `verified`.
    1. Deleted the direct process queue, old canonical execution store, coordinator, mutable ownership reconciliation, pipeline resume, card leases, and task `executionIntent` runtime.
    2. Runtime admission, scheduling, status, cancellation, recovery, Control Room, federation projection, and frontend reconciliation read replicated execution entities only.
    3. Pipeline manifests remain byte-stable topology records. Compatibility lifecycle fields retain their initial values for the existing response shape and are never used for admission, scheduling, settlement, cancellation, status, or recovery.
    4. Voice notes retain transcription state and retry-stable launch inputs only. They contain no execution phase, execution ID, run ID, execution timestamp, or execution error.
    5. Legacy queue and canonical execution readers are isolated inside the offline epoch-4 migration boundary. Corrupt bytes remain untouched and produce an actionable migration error.
    6. Provider session history, immutable artifact heads, JSONL, stderr, telemetry, pipeline topology, and endpoint response shapes remain available.
    7. Federated execution now persists `running` before invoking the selected role transport; role-local process launch cannot become a competing lifecycle writer.
    8. Production authority grep found no legacy execution reference outside the migration decoder and the epoch-4 lane rejection contract.
    9. Full backend result: `371/371`.
    10. Full frontend result: `533/533`.
    11. Backend and frontend typechecks passed.
13. **J.13 — Run failure and convergence verification:** `implemented`.
    1. Automated verification rows `1` through `36` have focused passing evidence.
    2. Five first-boundary defects were corrected: voice launch-failure state, deterministic projection clock ordering, mixed direct-child capacity accounting, server-close capacity-wait cancellation, and journal persistence-failure reporting.
    3. Backend typecheck passed.
    4. Frontend typecheck passed.
    5. Backend suite reported `377/378`; its only failure was the new capacity test's fixed child-start delay. The corrected failing scope passed `2/2`.
    6. Frontend suite passed `534/534`.
    7. Served row `37` remains pending because the registered server is running `main` at `369d4158`, not this refactor branch.
14. **J.14 — Execute the epoch-4 production cutover:** `preflight`.
    1. The feature branch includes current `main` at merge commit `742d23c3` and is pushed to `origin/feature/epoch4-task-execution`.
    2. Workstation preflight verified the registered MultiTerm process, epoch-3 health, zero active incidents, seven valid registered projects, zero staged project changes, configured federation credentials, matching relay roots, and no live Decision OS-owned child.
    3. Relay credential admission and the epoch-4 Wrangler dry-run passed without deployment.
    4. Workstation migration requires an explicit backup root on `/media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7`; the migrator default resolves below unwritable `/home`.
    5. The Mobile read-only preflight ended with `federation_outcome_unknown` when Mobile disconnected. Its exact repository state, registered service commands, catalog root, and external backup path remain unverified.
    6. No node process, relay deployment, repository installation, migration state, or durable project state changed during preflight.

---

## D. Current Verified Gaps

1. Served Workstation and Mobile interaction verification remains for `J.13`.
2. No artifact garbage collector exists under `backend/src`; tombstone replication and artifact retention ordering are verified, while an actual deletion pass does not exist.
3. Production migration, relay namespace deployment, node restart, and three-party convergence proof remain for `J.14`.
4. Mobile must reconnect and complete the read-only cutover preflight before the production maintenance window is admitted.
5. Operator authorization is required before either registered server process changes.

---

## E. Verification Evidence

1. **Documentation structure:** verified in commit `e39c73df`.
2. **Focused backend tests:** passed `30/30`.
   1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=backend/tsconfig.json node --test --import ./backend/node_modules/tsx/dist/esm/index.mjs backend/test/unit/task-state/task-current-state-core-v4.test.ts backend/test/unit/task-state/task-current-state-join.test.ts backend/test/unit/task-state/task-current-state-store.test.ts backend/test/unit/codex/helper/codex-execution-transition.test.ts`.
3. **Focused frontend tests:** passed `47/47`.
   1. Command: `node bin/decision-os-verify.mjs -- node --test frontend/test-responsive/optimistic-task-projection.test.mjs frontend/test-responsive/mobile-control-room.test.mjs`.
4. **Relay tests:** passed `8/8`.
   1. Command from `federation-relay/`: `node ../bin/decision-os-verify.mjs -- node_modules/.bin/vitest run`.
   2. Discarded command: invoking the relay Vitest binary from repository root selected every repository test and executed no relay test. The corrected working-directory command above passed.
5. **Backend typecheck:** passed.
   1. Command: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit`.
6. **Frontend typecheck:** passed.
   1. Command: `node bin/decision-os-verify.mjs -- npm --prefix frontend run typecheck`.
7. **Full backend suite:** ran once after J.8 and reported `395/403`.
   1. The voice durable-identity shape assertion and duplicate runtime-incident boundary were corrected afterward; their focused tests pass.
   2. One compact-status failure requires `J.9`.
   3. Three legacy direct-queue restart and scan expectations require `J.10`.
   4. Startup ownership reconciliation and card execution-intent cleanup expectations require `J.12`.
8. **J.8 focused backend:** passed `32/32`.
   1. Coverage includes direct skill, saved pipeline, federated pipeline runner, local project sync, two-node selected-executor project sync, voice handoff, and remote manifest installation.
9. **J.8 focused frontend:** passed `44/44`.
   1. Coverage includes upload persistence before request settlement, retry-stable project routing, absence of frontend execution-intent creation, and retryable durable execution failure.
10. **Two-node selected-executor proof:** passed.
   1. Node A sent the authenticated role request through the relay.
   2. Node B installed the immutable manifest, used executor-local artifact paths, ran the child in the selected repository, and settled the execution in Node A’s replicated task-project lane.
   3. The canonical pipeline projection converged to `complete` on Node A and Node B retained a clean repository.
11. **Offline migration fixture proof:** passed `11/11`.
   1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=backend/tsconfig.json node --test --import ./backend/node_modules/tsx/dist/esm/index.mjs backend/test/unit/task-state/task-current-state-migration.test.ts backend/test/unit/task-state/migrate-node-task-current-state.test.ts`.
   2. Evidence includes corrupt execution-state byte preservation, epoch-3 shard admission, deterministic assignment, all legacy execution sources, artifact objects, zero journals, complete backup, and legacy-authority retirement.
12. **Two-node convergence proof:** migration fixture passed.
   1. Independently migrated Workstation and Mobile fixtures join to one root, retain content ownership, deduplicate identical assignment and execution effects, and preserve real conflicts.
13. **Served browser proof:** not run.
14. **Restart durability proof:** not run.
15. **Relay typecheck:** passed.
    1. Command from `federation-relay/`: `node ../bin/decision-os-verify.mjs -- node_modules/.bin/tsc -p tsconfig.json --noEmit`.
16. **Dependent compatibility sample:** passed `26/33`; not a gate claim.
    1. Six failures are isolated-worktree child-process loader failures because the temporary fixture resolves `TSX_TSCONFIG_PATH` below its own root.
    2. One substantive failure is the expected open `J.9` gap: compact status still requires card execution fields removed by epoch-4 migration.
17. **Assignment and reassignment tests:** passed.
    1. Assignment-specific project-state and federated-projection result: `4/4`.
    2. Master-task HTTP creation, required assignment, inherited-subtask rejection, reassignment, project-sync creation, runtime-incident creation, and federated Control Room result: `20/20`.
    3. Held Control Room assignment projection result: `1/1`.
    4. Backend typecheck passed after all assignment changes.
15. **Replicated execution repository:** passed `76/76`.
    1. Command from `backend/`: `node ../bin/decision-os-verify.mjs -- node --test --import tsx test/unit/task-state/task-current-state-core-v4.test.ts test/unit/task-state/task-current-state-join.test.ts test/unit/task-state/task-current-state-store.test.ts test/unit/federation/federation-task-state-replicator.test.ts test/unit/task-state/task-execution-repository.test.ts test/unit/server/helper/control-room-projection-store.test.ts test/unit/task-state/project-task-state.test.ts test/unit/task-state/task-current-state-migration.test.ts`.
    2. Evidence covers live federation, offline anti-entropy, deterministic joins, repository idempotency, all derived indexes, awaited transitions, conflicts, migration loading, Control Room projection, and bounded execution invalidation.
    3. Backend typecheck passed.
16. **Assignment-aware admission:** passed `20/20`.
    1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=<absolute-worktree-backend-tsconfig> node --test --import <tsx-loader> backend/test/unit/codex/task-execution-router.test.ts backend/test/unit/server/helper/create-http-server.test.ts`.
    2. Evidence covers master resolution, local relay-independent admission, authenticated remote boundary, exact retry receipts, offline peer rejection without requester state, explicit assignment conflict, contained failed validation, direct-run serialization, complete pipeline topology admission, non-task locality, server installation, and health during relay outage.
    3. Backend typecheck passed.
17. **Replicated direct execution authority:** passed `42/42`.
    1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=<absolute-worktree-backend-tsconfig> node --test --test-reporter=dot --import <tsx-loader> backend/test/unit/codex/helper/launch-codex-execution-process.test.ts backend/test/codex/epoch4-direct-execution-scheduler.test.ts backend/test/codex/start-thread-codex-process-admission.test.ts backend/test/codex/task-codex-session-replication.test.ts backend/test/codex/start-codex-pipeline-run-controller.test.ts backend/test/codex/start-card-skill-process-controller.test.ts backend/test/codex/codex-process-queue.test.ts backend/test/unit/server/helper/create-http-server.test.ts`.
    2. Evidence covers direct start, continuation, immediate queued receipts, deterministic artifact paths, exact session reuse, awaited spawn registration, terminal replicated settlement, absence of both legacy direct-execution files, scheduler reuse after dispatch failure, and legacy fallback compatibility.
18. **Direct authority routing and offline identity regressions:** passed `17/17`.
    1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=<absolute-worktree-backend-tsconfig> node --test --test-reporter=dot --import <tsx-loader> backend/test/unit/codex/task-execution-router.test.ts backend/test/server/federation-node-connector.integration.test.ts`.
    2. Evidence includes configured local identity without relay transport, full federation connector behavior, local and remote routing, idempotency, and rejection containment.
19. **J.6 backend typecheck:** passed.
    1. Command: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit`.
20. **Replicated saved-pipeline authority:** passed `8/8`.
    1. Commands: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsx --tsconfig backend/tsconfig.json --test backend/test/codex/start-codex-pipeline-run-controller.test.ts` and `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsx --tsconfig backend/tsconfig.json --test backend/test/codex/resume-codex-pipeline-runs.test.ts`.
    2. Evidence covers topology-wide admission, strict five-skill dependency order, immutable status projection, failure containment, downstream cancellation, exact local cancellation, linked restart history, retained prior artifacts, server catalog pipelines, and temporary-pipeline compatibility.
21. **Pipeline scheduler and compatibility:** passed `21/21`.
    1. Command: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsx --tsconfig backend/tsconfig.json --test backend/test/codex/epoch4-direct-execution-scheduler.test.ts backend/test/unit/codex/task-execution-router.test.ts backend/test/codex/codex-pipeline-store.test.ts backend/test/codex/codex-pipeline-restart-adoption.test.ts`.
    2. Evidence covers atomic batch idempotency, dependency metadata, direct scheduler compatibility, dispatch failure isolation, store normalization, and retained legacy process adoption.
22. **J.7 backend typecheck:** passed.
    1. Command: `node bin/decision-os-verify.mjs -- npm run typecheck --prefix backend`.
23. **Full backend suite:** failed `389/400`.
    1. Command: `node bin/decision-os-verify.mjs -- npm test --prefix backend`.
    2. The exact remaining failure classes are retained in section `D` and evidence item `7`; no full-suite completion claim is made.
24. **J.9 focused backend control paths:** passed `46/46`.
    1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=<absolute-worktree-backend-tsconfig> backend/node_modules/.bin/tsx --test --test-reporter=dot backend/test/codex/cancel-task-execution.test.ts backend/test/codex/delete-thread-codex-session-controller.test.ts backend/test/codex/read-compact-run-status-controller.test.ts backend/test/codex/read-task-execution-run-controller.test.ts backend/test/codex/epoch4-direct-execution-scheduler.test.ts backend/test/codex/start-card-skill-process-controller.test.ts backend/test/codex/federated-pipeline-execution.integration.test.ts backend/test/server/control-room-projection.integration.test.ts backend/test/server/federation-node-connector.integration.test.ts backend/test/unit/server/helper/create-http-server.test.ts backend/test/unit/task-state/task-execution-repository.test.ts`.
    2. Evidence covers local and remote cancellation, exact-hash artifact retrieval, session tombstones, compact and detailed status, terminal artifact barriers, execution SSE, Control Room projection, and two-node executor routing.
25. **J.9 focused frontend Control Room:** passed `3/3`.
    1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=<absolute-worktree-frontend-tsconfig> frontend/node_modules/.bin/tsx --test frontend/test/runtime/control-room-voice-transcribing-before-launch.integration.test.ts frontend/test/runtime/control-room-initial-hydration.integration.test.ts`.
    2. Evidence covers replicated lifecycle precedence, `cancelling` presentation, and phase-timestamp stopwatch behavior.
26. **J.9 typechecks:** passed.
    1. Backend command: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit`.
    2. Frontend command: `node bin/decision-os-verify.mjs -- frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit --typeRoots backend/node_modules/@types`.
27. **Full backend suite after J.9:** passed `405/410`; five later-gate assertions remain.
    1. Command: `node bin/decision-os-verify.mjs -- npm test --prefix backend`.
    2. Three failures assert legacy startup queue scanning and claimed-thread resumption that `J.10` replaces with replicated execution recovery.
    3. Two failures assert startup ownership reconciliation and card execution cleanup that `J.12` removes with the remaining legacy authorities.
28. **J.10 focused recovery and scheduler:** passed `32/32`.
    1. Command: `node bin/decision-os-verify.mjs -- env TSX_TSCONFIG_PATH=<absolute-worktree-backend-tsconfig> backend/node_modules/.bin/tsx --test --test-reporter=dot backend/test/codex/recover-task-executions.test.ts backend/test/codex/codex-process-restart-recovery.test.ts backend/test/codex/read-card-skill-run-controller.test.ts backend/test/codex/epoch4-direct-execution-scheduler.test.ts backend/test/codex/start-codex-pipeline-run-controller.test.ts backend/test/codex/resume-codex-pipeline-runs.test.ts backend/test/server/project-sync.integration.test.ts backend/test/unit/server/helper/create-http-server.test.ts`.
    2. Evidence covers exact-process adoption, stale and missing process interruption, terminal artifact capture, startup scheduling from replicated state, canonical multi-project status routing, and legacy queue exclusion.
29. **Full backend suite after J.10:** passed `407/411` before focused classification.
    1. Command: `node bin/decision-os-verify.mjs -- npm test --prefix backend`.
    2. The legacy manifest-resume fixture was replaced with two replicated pipeline executions. Startup preserved the succeeded predecessor and its artifact heads, ran only the queued successor, finalized its artifacts, and left the raw manifest unchanged.
    3. The project-sync `EPIPE` was a suite-load fixture race: the fake child now consumes stdin before completing, while production prompt-delivery failures remain fatal. Its focused integration test passed.
    4. The remaining two deterministic failures assert card ownership and `executionIntent` cleanup removed by `J.12`.
30. **J.10 backend typecheck:** passed.
    1. Command: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit`.
31. **J.12 legacy-authority removal:** passed.
    1. Backend command: `node bin/decision-os-verify.mjs -- npm test --prefix backend`; result `371/371`.
    2. Frontend command: `node bin/decision-os-verify.mjs -- npm test --prefix frontend`; result `533/533`.
    3. Backend typecheck: `node bin/decision-os-verify.mjs -- backend/node_modules/.bin/tsc -p backend/tsconfig.json --noEmit`; passed.
    4. Frontend typecheck: `node bin/decision-os-verify.mjs -- frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit --typeRoots backend/node_modules/@types`; passed.
    5. Production authority grep found no `executionIntent`, card lease, direct queue API, old canonical coordinator, mutable pipeline scheduler, note-backed voice lifecycle, or legacy execution schema import outside migration-only readers and the epoch-4 lane rejection contract.
    6. Migration corruption and byte-preservation result: `9/9`.
    7. Federated role and project synchronization result: `9/9`.

---

## F. Update Contract

1. Update this ledger in the same commit that changes a gate status.
2. Record the exact verification command and result before marking a gate `verified`.
3. Push each verified gate commit to `origin/feature/epoch4-task-execution`.
4. Keep failed commands and unresolved defects visible until superseded by passing evidence.
5. Do not mark production cutover complete from local tests.
6. Merge into `main` only after `J.1` through `J.13` are verified.
7. Mark `J.14` verified only from Workstation, Mobile, and relay production evidence.
