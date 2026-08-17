# Epoch-4 Task Assignment, Execution, and Content

## A. Runtime Scope

1. **Epoch 4 is the active task-state format on Workstation.** Every registered Workstation project uses `decision-os-task-state/4`, schema `4`, and baseline epoch `4`.
2. **Task assignment and execution are replicated domain state.** They join through the same causal current-state store as cards, relationships, thread notes, and content heads.
3. **Process state remains node-local.** Child handles, PIDs, process-start identities, growing JSONL files, stderr files, and timers belong only to the executor node.
4. **Mobile production admission remains open.** The `rel-0.4.0` epoch-4 relay is deployed. The complete gate still requires Mobile migration, two-node production convergence, measured full-state transfer speed, and cross-node execution proof.
5. **Relay identity is epoch-independent.** The stable `FederationRelay` Durable Object namespace owns node credential hashes, manifests, and labels across state epochs. Epoch-3 and Epoch-4 replicated state coexist without collision under `state:v3:*` and `state:v4:*`; changing the state epoch does not rotate credentials.

---

## B. Structural State Contract

1. **Assignment lane:** Each master task card owns one atomic `assignment` value containing `nodeId`, `changedAt`, and `revision`.
2. **Inherited assignment:** Subtasks resolve assignment through their master and reject direct reassignment.
3. **Execution entity:** Each execution owns independent `metadata`, `lifecycle`, and `artifacts` registers.
4. **Canonical phases:** `preparing`, `queued`, `starting`, `running`, `cancelling`, `succeeded`, `failed`, `cancelled`, and `interrupted`.
5. **Execution identity:** Admission is idempotent by project, task, and request identity. Conflicting assignment, lifecycle, request, and entity candidates remain explicit diagnostics and are excluded from scheduling.
6. **Derived indexes:** The execution repository rebuilds indexes for task, provider session, pipeline run, phase, executor node, and request identity from current entities.
7. **Legacy authority removal:** Direct queue state, card `executionIntent`, mutable pipeline lifecycle, card execution leases, and log-derived settlement are migration inputs only. They are not runtime authorities.
8. **Client causal clock:** HTTP task projections and mutation receipts exclude only immutable `migration:*` coordinates. Configured node IDs cannot contain `:`, so every runtime-writer coordinate remains visible while deterministic migration coordinates stay in durable state without entering response headers.

---

## C. Admission, Scheduling, and Recovery

1. **Admission:** `TaskExecutionRouter` resolves the source card to its master, requires one conflict-free assignment, and persists the execution before dispatch.
2. **Local execution:** The assigned node transitions a durable execution through `preparing`, `queued`, `starting`, `running`, and one terminal phase.
3. **Remote execution:** The requesting node sends one authenticated execution request to the assigned node. The assigned node applies the same admission path and remains the only process owner.
4. **Offline local authority:** Relay-root equality is not a local execution prerequisite. A locally assigned task can execute while relay transport is unavailable. A timed-out relay repair records stopped-operation history without pausing the local task-state project.
5. **Unavailable assignment:** An unreachable assigned node returns `assigned_node_unreachable` and creates no substitute execution on the requesting node.
6. **Restart recovery:** Startup reads locally assigned active executions. It adopts a child only when both PID and process-start identity match; stale active state becomes `interrupted` after available artifacts are captured.
7. **Projection rule:** Replicated lifecycle owns the visible phase. Missing process observation does not relabel a durable `starting` or `running` execution as `interrupted`.
8. **Scheduler failure containment:** Global capacity remains available when one project pipeline store cannot be inspected. Queue inspection pauses only that project's `codex-runtime` scope, records the project and store path, and continues selecting healthy project work. Explicit project-runtime recovery re-reads the durable store before restoring that project to scheduling.

---

## D. Thread Notes and Markdown Sidecars

1. **Dual durable representation:** A task-thread note has a causal `thread-note` entity and a Markdown representation under `.decision-os/threads/`. Agents consume the Markdown, while replication and deletion semantics consume the entity state.
2. **Scoped note mutation:** `append-note`, `update-note`, `delete-note`, and `restore-note` own the exact declared note identity. They must not diff every hydrated note in the thread.
3. **Atomic contribution:** A note mutation captures the resulting thread Markdown content head and persists that resource head in the same epoch-4 batch as the note entity.
4. **Atomic sidecar replacement:** Thread Markdown writes use a temporary file followed by rename.
5. **Deletion semantics:** A tombstoned note is excluded from agent prompt construction even when stale Markdown still contains its body.
6. **Explicit restoration:** `restore-note` causally removes the target tombstone. An existing sidecar note keeps its identity and content; an absent sidecar note requires an explicit body.
7. **Operator intent boundary:** A note not deleted by an operator must not remain tombstoned. Recovery uses the exact original note ID instead of creating a replacement identity.

---

## E. Codex Conversation and Artifact Boundaries

1. **Conversation content:** Thread Markdown contains operator notes and direct agent replies.
2. **Execution evidence:** Synthetic Codex lifecycle events remain in immutable run JSONL, stderr, telemetry, result artifacts, and replicated artifact heads. They are not conversation notes.
3. **Task ownership lookup:** Codex event persistence resolves task ownership from the authoritative epoch-4 projection. The retired aggregate `tasks.json` is not execution ownership evidence.
4. **Terminal publication order:** Live run paths remain registered until terminal lifecycle and immutable artifact heads are durable. Terminal polling therefore retains a readable source throughout settlement.
5. **Lazy terminal reads:** A node reads a terminal artifact by exact content hash and fetches missing remote bytes on demand.
6. **Garbage collection:** Execution artifact deletion is an explicit offline operation gated by a retention cutoff and a recorded converged project root.
7. **Card execution-group identity:** A master task and every subtask use the master card ID as `taskId`. An ordinary ledger card uses its own card ID as `taskId`, requires no task relationship, and remains locally assigned. `sourceCardId` identifies the card whose thread launched the execution.
8. **Card summary resource:** `GET /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/execution-state` returns the synchronized session and execution hierarchy for the selected card's execution group. The task-only route remains a compatibility projection. Historical ordinary-card executions with an empty `taskId` are selected by exact ledger and source-card identity without rewriting their durable metadata.
9. **Execution presentation resource:** `GET /p/:projectId/api/task-executions/:executionId` returns one exact execution presentation. The frontend selects an execution from the card summary and never infers a log from the latest session or execution.
10. **Executor-local parsing:** The executor node reads the selected JSONL and stderr segment, normalizes it, coalesces lifecycle updates, and returns presentation events. Physical line positions, artifact paths, content hashes, and parsing cursors remain private backend implementation details.
11. **Lightweight payload:** Presentation events retain agent messages, comments, thinking, diagnostics, run status, tool identity and settlement metadata, file path-action summaries, and typed todo items. They exclude raw tool result bodies, `stdout`, `stderr`, aggregated output, file contents, telemetry, and result artifacts.
12. **Todo and comment fidelity:** The latest selected-execution `todo_list` renders as the persistent Codex Log overlay. `comment` events remain chronological first-class log entries and are not folded into agent messages.
13. **Remote active reads:** A non-executor node proxies an active presentation read to the authenticated executor endpoint `/api/internal/task-executions/:executionId/presentation`.
14. **Remote terminal reads:** A non-executor node fetches only the selected execution's immutable JSONL and stderr objects by exact hash, then builds the same presentation locally. Telemetry and result objects are not fetched for log display.
15. **Frontend replacement rule:** Each refresh installs one complete card summary and one complete selected-execution presentation. The browser does not merge line ranges, retain opaque cursors, parse JSONL, or reconstruct session ownership.
16. **Dynamic gate command:** A running pipeline skill can execute `ledger-cli queue-skill --skill <name> --model <model> --effort <effort>`. The CLI derives the project and calling execution from its injected environment and posts to `/p/:projectId/api/codex/executions/:executionId/queue-skill`.
17. **Immutable successor segment:** The server resolves the selected content kind, persists a temporary two-step run containing the selected skill followed by the exact calling skill, and links its first execution to the active caller. It does not mutate the caller's admitted run.
18. **Single-successor admission:** One calling execution owns at most one dynamic successor run. An exact retry returns the existing run; a different retry returns `dynamic_skill_already_queued`.
19. **Fresh gate context:** Each pipeline-prompt execution receives the canonical master-task Markdown, the complete latest non-deleted operator conversation, and the direct result Markdown of the immediately preceding skill. The returning gate is a new execution with a new Codex context.
20. **Pipeline successor command:** A running thread, continuation, or terminal pipeline execution can execute `ledger-cli queue-pipeline --pipeline <pipeline-id>`. The CLI derives the project and calling execution from its injected environment and posts to `/p/:projectId/api/codex/executions/:executionId/queue-pipeline`.
21. **Saved-pipeline successor admission:** The server derives the ledger, source card, and task from the durable caller, resolves the saved pipeline through normal admission, and links its first execution to the caller through `queuedAfterExecutionId`. A pipeline caller must be the final member of its immutable run, and its resolved step result becomes the successor run's direct initial input. The pipeline starts only after the caller succeeds.
22. **Single-pipeline successor:** One eligible execution owns at most one saved-pipeline successor. An exact retry returns the admitted run; a different pipeline returns `dynamic_pipeline_already_queued`.
23. **Operator reply boundary:** The gate prompt receives the canonical thread identity and uses `ledger-cli answer` for its operator-facing response. The immediately preceding step result remains the direct handoff for the next queued skill.
24. **Immutable presentation policy:** Pipeline admission snapshots `.decision-os/.settings.json` `createPipelineStepCards` into run-manifest `createStepCards`. Only explicit `false` selects cardless execution; a missing field preserves card-backed behavior for legacy manifests.
25. **Card-backed result owner:** When `createStepCards` is enabled, each step writes to its generated card Markdown. The generated card owns execution metadata and lifecycle notifications, preserving the established API and canvas projection.
26. **Cardless result owner:** When `createStepCards` is disabled, card and relationship creation performs no ledger mutation. Each step writes a contained run-owned Markdown artifact at `.decision-os/runs/codex-skills/<safe-ledger-stem>/<run-step-id>.result.md`.
27. **Cardless execution owner:** Cardless task-state metadata, prompt identity, lifecycle notifications, and settlement events use the real source card. Synthetic `outputCardId` values remain immutable topology keys only and do not claim that a card exists.
28. **Scheduler readiness:** Before claiming a local pipeline execution, the scheduler resolves the admitted step result owner. A card-backed run requires its generated card Markdown; a cardless run requires a safe artifact path contained by the project Decision OS root.
29. **Sequential handoff:** The next skill reads the immediately preceding step's resolved Markdown result. A dynamically queued successor locates its predecessor through immutable run topology and reads the predecessor's cardless artifact when no generated card exists.
30. **Result presentation:** Pipeline-run detail reports generated-card availability separately from `outputArtifact.available` and `outputArtifact.bytes`. Consumers must use artifact fields for execution result existence when card generation is disabled.
31. **Remote topology:** Authenticated remote admission includes `createStepCards` in immutable topology comparison and validates request ownership against the selected source-card or generated-card owner.
32. **Failure propagation:** Dynamic successor executions retain the external predecessor identity in durable topology. Failure, cancellation, interruption, and restart recovery cancel every queued descendant across the originating and successor runs.

---

## F. Content Storage Contract

1. **Local workspace content stays in place.** Card Markdown, thread Markdown, audio, images, and managed assets retain causal heads containing key, SHA-256, byte length, timestamp, and source replica.
2. **Migration copies no local media payload.** The rollback archive contains only files the migration can mutate. Local audio and images enter the source manifest as verified references with an empty `archiveFile`.
3. **Remote cached content is selective.** A reachable retained remote object can be verified from the node federation cache and installed by exact hash.
4. **Unavailable remote content is deferred.** A remote-owned head whose bytes are absent remains an audited `deferredRemoteObjects` entry and resolves through normal exact-hash retrieval when its owner is available.
5. **Local absence is fatal.** A missing Workstation-owned object fails migration admission because the node is responsible for those bytes.
6. **No bulk transfer:** State synchronization replicates small content heads. Growing logs and binary payload inventories do not transfer during root convergence.
7. **ID-only subtask authoring:** `ledger-cli subtask-create --master-card-id <id> --title <title>` resolves the local project and `tasks` ledger from Control Room state, then submits one active `create-subtask` mutation containing the new blank Markdown-backed card and canonical relationship. The command rejects Markdown-file input and returns the server-created document path.
8. **Graph-scoped Git commit:** `ledger-cli master-task-commit --master-card-id <id>` resolves the same owner, then the project-scoped task-content route discovers the authoritative relationship-backed graph and commits every master and subtask card Markdown plus its canonical thread Markdown through the authored-file Git transaction. Missing graph documents and graph-owner staged paths are rejected while unrelated index entries remain byte-identical.

---

## G. Offline Migration Transaction

1. **Read-only planning:** `decision-os-plan-node-migration.mjs` inventories the complete registered catalog, prepares every semantic conversion, calculates exact mutable archive bytes, and reports referenced workspace bytes without changing production state.
2. **Catalog-wide preflight:** Every registered project, including identity-verified external symlinks, is prepared before backup or live mutation begins.
3. **Exact archive:** The transaction hashes and archives only task-state roots and sidecars in the mutation manifest. It preserves file modes and absence markers.
4. **Shadow build:** Every epoch-4 project state and rewritten sidecar is built and validated in staging before the first live swap.
5. **Write-ahead commit:** The journal records each state-root swap and sidecar replacement before execution. A normal failure restores completed operations.
6. **Interrupted recovery:** Reusing a nonterminal backup root performs deterministic rollback and returns `task_migration_recovered_interrupted_transaction`. Reusing a verified root independently verifies and returns the existing result.
7. **Runtime admission:** A nonterminal catalog migration marker pauses the affected task-state scope without terminating unrelated server routes.
8. **Independent verification:** `decision-os-verify-node-migration.mjs` checks archived hashes, live format markers, baseline roots, project roots, reports, and empty journals.

---

## H. Workstation Cutover State

1. **Verified transaction:** `ab0ab732-64d8-464b-b0e7-d2f1266681c4` migrated all seven Workstation projects on `2026-07-24`.
2. **Measured archive boundary:** The planner reported `11,576,346` mutable archive bytes and `993,873,984` referenced workspace bytes.
3. **Local binary behavior:** The referenced local workspace content remained at its original paths and did not enter the rollback archive or epoch-4 object directories.
4. **Remote cache debt:** The successful cutover installed `199` phone-owned managed assets totaling `389,746,672` bytes from the federation cache. The same hashes remain in the node cache; deduplicating that materialization is open technical debt.
5. **Post-cutover repairs:** Commits `e9f1e61a` and `0d4a0338` repaired scoped note derivation, artifact settlement ordering, phase projection, explicit note restoration, Markdown content-head persistence, prompt tombstone filtering, and authoritative task-run ownership.
6. **Current gate:** Workstation is operational on epoch 4. Mobile and relay production evidence remain required before the cross-node cutover is complete.

---

## I. Primary Evidence

1. `shared/task-current-state-core/model.ts`
2. `backend/src/business/task-state/helper/task-execution-repository.ts`
3. `backend/src/business/codex/helper/task-execution-router.ts`
4. `backend/src/business/task-state/helper/project-task-state.ts`
5. `backend/src/business/task-state/helper/task-mutation-command.ts`
6. `backend/src/business/ledger/helper/thread-content-file.ts`
7. `backend/src/business/task-state/controller/migrate-node-task-current-state.ts`
8. `backend/src/business/task-state/helper/task-current-state-migration.ts`
9. `backend/src/business/task-state/helper/task-current-state-migration-transaction.ts`
10. `backend/src/business/codex/helper/project-task-execution-state.ts`
11. `backend/src/business/codex/helper/task-execution-presentation.ts`
12. `shared/schemas/task-execution-presentation-types.ts`
13. `frontend/src/runtime/codex/effect/request-task-execution-state.ts`
14. `frontend/src/runtime/codex/effect/bind-thread-codex-run-log.ts`
15. `documentation/procedure/deployment/epoch-4-node-cutover.md`
16. `documentation/postmortem/epoch-4-workstation-cutover-2026-07-24.md`
17. `backend/src/business/task-state/helper/task-current-state-store.ts`
