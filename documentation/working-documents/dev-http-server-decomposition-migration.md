# Dev HTTP Server Decomposition Migration

## A. Required Result

1. Delete `backend/src/business/server/helper/create-http-server.ts`.
2. Preserve every `dev` route, response, side effect, failure boundary, startup sequence, shutdown sequence, and runtime recovery behavior.
3. Replace the lexical-closure application container with capability-owned runtime services, ordered HTTP handlers, and one thin composition root.
4. Keep Node's HTTP stack. Do not introduce a router framework, persistence model, generic event bus, service locator, manifest, cache, index, or parallel source of truth.
5. Keep diagnostics ahead of the global pause gate, remote-project routing ahead of local routing, project admission ahead of assets, and static application fallback last.

---

## B. Existing Anchors

1. `ProjectCatalogStore` owns project discovery and validated project identity.
2. `ProjectTaskState` and `TaskCurrentStateStore` own local and federated task truth.
3. `RuntimeIncidentLedger` owns durable failure evidence.
4. `FederationNodeConnector`, the task-state replicator, and the content scheduler own federation transport and replication.
5. Existing Codex stores, process leases, JSONL files, execution records, and pipeline stores remain authoritative.
6. Existing server integration tests instantiate `createHttpServer` 80 times across 28 files and form the behavior-preservation boundary.

---

## C. Over-Engineering and Bloat Register

| Ref | Finding | Action |
|---|---|---|
| Universal `ServerKernel` | Recreates the current service locator with a type name | Do not create |
| Generic event bus | Hides ownership and adds subscription lifecycle | Use a typed SSE publisher owned by the server runtime |
| New route manifest | Duplicates the ordered handler array | Do not create |
| New persistent runtime model | Duplicates task state, incidents, process leases, and pipeline stores | Do not create |
| HTTP framework migration | Changes routing semantics without helping ownership | Keep `node:http` |
| One file per route | Produces mechanical file count without capability ownership | Group cohesive routes by capability |
| Moving `handleRequest` intact | Relocates the monolith without decoupling it | Reject |
| Reorganizing every backend directory | Expands the iteration beyond the server migration | Change only files required by this migration |
| Rewriting domain behavior during extraction | Prevents behavior-preservation attribution | Preserve logic first; correct only proven defects |
| Repeating ad hoc AST shell scripts | Makes future structural audits slow and non-repeatable | Add one repository-owned structure audit command |

---

## D. Task Inventory

| id | type | title | target_files | target_symbols | action | done_when | depends_on |
|---|---|---|---|---|---|---|---|
| T01 | docs | Freeze the migration contract | `documentation/working-documents/dev-http-server-decomposition-migration.md` | Required result, task inventory, gates | Record preserved behaviors, forbidden abstractions, ownership boundaries, task files, and symbols | The migration has one reviewable source of scope and sequencing | |
| T02 | code | Add repeatable backend structure audit | `backend/src/cli/audit-backend-structure.ts`, `backend/package.json`, focused test | `auditBackendStructure`, CLI entry | Report source LOC, import counts, oversized files, cross-capability imports, and dependency cycles without modifying the tree | One repository command replaces the analysis-only AST shell snippets | T01 |
| T03 | code | Add ordered HTTP contracts | `backend/src/business/server/http/http-route.ts`, `request-context.ts`, `dispatch-http-request.ts`, `response.ts` | `HttpRoute`, `HttpRequestContext`, `dispatchHttpRequest`, `sendJson` | Define handled/next outcomes, request context, ordered dispatch, and shared JSON response behavior | Focused tests prove first-handler ownership, fallthrough, and response preservation | T01 |
| T04 | code | Extract incident and lifecycle supervision | `backend/src/business/server/runtime/incident-supervisor.ts`, `server-lifecycle.ts` | `createIncidentSupervisor`, `createServerLifecycle` | Move pause restoration, incident recording, process listeners, shutdown signal, resource disposal, and request failure translation | Diagnostics and failure-containment tests pass without behavior changes | T03 |
| T05 | code | Extract project and task runtime ownership | `backend/src/business/server/runtime/project-runtime-registry.ts`, `backend/src/business/task-state/runtime/task-runtime-registry.ts` | `createProjectRuntimeRegistry`, `createTaskRuntimeRegistry` | Move project contexts, task stores, revisions, watchers, task mutation publication, task execution repositories, and project disposal behind typed methods | No route directly reads the former project/task maps; task-state tests pass | T04 |
| T06 | code | Extract Codex runtime coordination | `backend/src/business/codex/runtime/codex-runtime-coordinator.ts`, `controller-runtime-bridge.ts` | `createCodexRuntimeCoordinator`, `createControllerRuntimeBridge` | Move global capacity, scheduler scanning, execution presentation state, startup recovery, and temporary controller runtime compatibility | Codex routes consume a typed coordinator and existing Codex tests pass | T05 |
| T07 | code | Extract federation runtime | `backend/src/business/federation/runtime/federation-runtime.ts`, `library-synchronizer.ts` | `createFederationRuntime`, `createFederatedLibrarySynchronizer` | Move connector lifecycle, state replication, content scheduling, library synchronization, remote observations, and conflict reconciliation | Federation routes and project gateway consume one typed runtime; federation tests pass | T05, T06 |
| T08 | code | Extract capability HTTP handlers | `*/http/*-routes.ts`, `backend/src/business/server/http/static-application-handler.ts` | capability route factories | Move failsafe, remote gateway, task, ledger, federation, settings, project-sync, catalog, Codex, transcription, Git review, delivery, SSE, and static routes into the preserved dispatch order | `handleRequest` no longer exists and every route family remains covered | T03, T04, T05, T06, T07 |
| T09 | code | Extract project-sync and delivery runtimes | `backend/src/business/project-sync/runtime/project-sync-runtime.ts`, `backend/src/business/delivery/runtime/delivery-runtime.ts` | `createProjectSyncRuntime`, `createDeliveryRuntime` | Move durable stores, admission/status evidence, command execution, recovery, and supervised exit request behind typed boundaries | Their HTTP handlers contain request adaptation only | T05, T07 |
| T10 | code | Replace the composition root and Node listener | `backend/src/business/server/application/create-decision-os-server.ts`, `backend/src/business/server/http/create-node-http-listener.ts`, `backend/src/business/server/controller/start-http-server-controller.ts` | `createDecisionOsServer`, `createNodeHttpListener`, `startHttpServerController` | Construct services in dependency order, register ordered routes, bind late transport ports before listener start, and return the existing server handle | Startup, listening, shutdown, dry-run, and failure behavior remain compatible | T04, T05, T06, T07, T08, T09 |
| T11 | code | Remove the monolith and migrate imports | `backend/src/business/server/helper/create-http-server.ts`, 28 importing test files | `createHttpServer` imports | Redirect callers to `createDecisionOsServer`, delete the old file, and remove obsolete imports | `rg` finds no old import, file is absent, typecheck passes | T10 |
| T12 | test | Verify all preserved behavior | backend, frontend, browser, ledger CLI, federation relay, typechecks, structure audit | all changed boundaries | Run every repository package suite through the verification lease, group failures, investigate independent groups in parallel, apply grouped fixes, loop focused groups, then rerun everything | Backend, frontend, browser, ledger CLI, federation relay, all typechecks, and the structure audit pass | T11 |
| T13 | code | Final quality correction | all iteration-changed files | changed symbols | Remove duplication, narrow dependencies, repair comments, confirm no speculative abstraction, and keep each owner cohesive | Final quality, bloat, and over-engineering audit has no unresolved finding | T12 |
| T14 | docs | Update canonical architecture and record lessons | `documentation/documentation/architecture/README.md`, detailed server architecture, migration document, commit body | Server composition contract, lessons | Replace the monolith's documented ownership with the new boundaries and record avoidable causes, faster repeatable analysis, and prevention rules | Canonical architecture prevents future route/runtime accretion and lessons are tied to encountered evidence | T13 |

Readiness: `READY_FOR_TASK_DEPENDENCY`

---

## E. Dependency Graph

| from_task | to_task | edge_type | reason | evidence |
|---|---|---|---|---|
| T01 | T02–T14 | hard-blocker | Scope and preservation rules must exist before structural work | This document |
| T03 | T04 | hard-blocker | Failure translation and lifecycle need the HTTP boundary types | `createServer` catch currently wraps `handleRequest` |
| T04 | T05 | shared-state-risk | Project pauses and disposal currently share closure state | pause maps and `disposeProjectContext` |
| T05 | T06 | shared-state-risk | Codex scheduling scans project runtimes and task executions | `projectContext`, scheduler contexts |
| T05 | T07 | shared-state-risk | Task stores publish through federation and consume federation frames | task-state replicator callbacks |
| T06 | T07 | shared-state-risk | Federated execution observations trigger Codex scheduling and presentation updates | federation connector callbacks |
| T03–T07 | T08 | hard-blocker | Route handlers require stable request and runtime boundaries | `handleRequest` captures up to 58 outer dependencies |
| T05, T07 | T09 | shared-state-risk | Project sync and delivery read project, execution, incident, and federation state | readiness and sync callbacks |
| T04–T09 | T10 | hard-blocker | Composition can become thin only after runtime owners exist | current lines 304–2323 |
| T10 | T11 | migration-order-risk | Old imports remain valid until the new root is complete | 80 server instantiations |
| T11 | T12 | test-order-risk | Full verification must test the final import and ownership graph | deleted old module |
| T12 | T13 | hard-blocker | Final quality review needs all discovered fixes present | grouped test-fix loop |
| T13 | T14 | soft-ordering | Lessons must reflect the final implementation and failures | final changed tree |

---

## F. Implementation Groups

| group_id | task_ids | target_files | target_symbols | independence_reason | dispatch_notes |
|---|---|---|---|---|---|
| G01 | T01, T02, T03 | migration doc, structure CLI, server HTTP primitives | audit and HTTP contracts | Independent new files with no runtime mutation | Complete before extraction |
| G02 | T04 | server runtime supervision | incident and lifecycle factories | Owns process/runtime failure boundary | Sequential gate |
| G03 | T05 | project/task runtime files | project and task registries | Owns the largest shared-state boundary | Sequential gate |
| G04 | T06 | Codex runtime files | scheduler and bridge | Consumes G03 contracts | Sequential gate |
| G05 | T07 | federation runtime files | connector and synchronizer | Consumes G03/G04 contracts | Sequential gate |
| G06 | T08, T09 | capability HTTP and adjacent runtimes | route factories, project-sync, delivery | Every extraction edits the old monolith; keep one owner | Do not parallelize source extraction |
| G07 | T10, T11 | composition root, listener, imports | new root and old deletion | Final cutover owns shared imports | Sequential gate |
| G08 | T12 | tests | failure groups | Parallel only after failures are grouped by disjoint files/symbols | Low-effort investigation agents |
| G09 | T13, T14 | changed files, canonical architecture, migration doc | quality fixes, architecture contract, lessons | Requires final verified tree | Final gate |

Readiness: `READY_FOR_TASK_GROUP_COMPLETENESS`

---

## G. Collision Risks

1. `create-http-server.ts` is touched by every extraction; one implementation owner must edit it.
2. `ProjectTaskState`, federation callbacks, Codex scheduling, and Control Room invalidation share lifecycle ordering.
3. Diagnostics and internal delivery must remain reachable before the global pause gate.
4. Remote-project routing must retain precedence over local capability routes.
5. Server close must settle every watcher, timer, monitor, stream, retry, and cancellation signal exactly once.
6. The existing `dev` replicated-Markdown invalidation callback is absent from `main` and must remain present.

---

## H. Completion Gates

1. The old file is deleted.
2. No replacement file becomes a universal container.
3. No feature, route, response, side effect, failure boundary, startup sequence, shutdown sequence, or recovery path is removed.
4. Full backend and frontend verification passes through `bin/decision-os-verify.mjs`.
5. The structure audit reports no dependency cycle introduced by the migration.
6. The final branch is committed, merged into `dev`, clean for intended source changes, and pushed.

---

## I. Engineering Completeness Findings

1. The plan covers application composition, runtime state, HTTP behavior, persistent-state ownership, federation, process lifecycle, recovery, tests, canonical documentation, and handoff.
2. No data migration is required because the iteration changes ownership and imports without changing durable schemas, paths, task entities, pipeline stores, process leases, content heads, incident files, settings, or project registries.
3. No new fixture family is required before implementation. Existing tests already construct isolated workspaces and instantiate the server 80 times. New focused fixtures are limited to the ordered-dispatch contract and the repeatable structure audit.
4. No frontend implementation task is required. Frontend and browser suites remain required compatibility gates because backend route behavior and static application delivery are in scope.
5. `dev` contains a replicated-Markdown invalidation callback absent from `main`; G05 and G06 must retain it in the federation-to-project event path.

---

## J. Fundamental Missing Tasks

1. The initial inventory omitted canonical architecture updates. T14 now updates the architecture owner map so future work does not append routes and runtime state to a composition file.
2. The initial verification wording covered only backend and frontend. T12 now explicitly includes browser, ledger CLI, federation relay, every package typecheck, and the structure audit.

---

## K. Input Plan Edits Applied

1. Expanded T12 verification scope and completion evidence.
2. Expanded T14 from lessons-only documentation to the canonical server composition contract.
3. Confirmed no durable migration, production restart, deployment, UI change, data backfill, new cache, or new manifest belongs in this iteration.

---

## L. Dispatch-Ready Groups

1. G01 through G07 are sequential because they share the monolith, runtime initialization order, and final import cutover.
2. G08 becomes parallel only after the full suite produces evidence-backed, file-disjoint failure groups.
3. G09 runs after all tests pass and owns final code quality plus documentation.

---

## M. Blocking Questions

1. None.

---

## N. Dispatch Readiness

1. `ready`

---

## O. Feature-Branch Ownership Snapshot

1. The former `5,682`-line helper is deleted. Its public entrypoint now lives at `server/application/create-decision-os-server.ts`.
2. HTTP precedence is explicit in three bounded stages: global admission, project data, and project interaction.
3. Project contexts, content ownership, runtime recovery, Codex process coordination, task execution presentation, card authoring, federation observations, federated libraries, project synchronization, delivery, and Node listener failure translation have capability-owned modules.
4. Every new HTTP stage and extracted runtime is below `300` lines. The application file still contains `1,166` lines and `65` imports, so the composition boundary remains incomplete.
5. The repeatable structure audit reports the two pre-existing internal cycles and no cycle introduced by this migration.

---

## P. Verification Lessons

1. Isolated worktrees require package dependency links before verification. A missing `frontend/node_modules` caused every frontend test to fail before application loading; it was an admission failure, not a product failure.
2. Focused backend tests require `TSX_TSCONFIG_PATH` to point at the isolated worktree configuration. Without it, path aliases fail before the behavior under test.
3. The shared-capacity test needed a release barrier instead of a short process timer; full-suite load could otherwise finish the first fake process before the second admission.
4. Codex output tests had stale counts after immutable `decision_os.user_prompt` records became part of every JSONL presentation. Assertions now include that durable event.
5. Typecheck after each ownership extraction caught behavior-preserving dependency mistakes before full-suite execution. The final complete backend suite passed `640` tests.

---

## Q. Feature-Branch Verification Evidence

1. Backend: typecheck passed; `640/640` tests passed.
2. Frontend: typecheck passed; `604/604` tests passed.
3. Ledger CLI: typecheck and build passed; `88/88` tests passed.
4. Generator CLI: typecheck and build passed; `97/97` tests passed after restoring its ignored source fixture in the isolated worktree.
5. Memory service: `4/4` tests passed.
6. Federation Relay: typecheck passed; Termux relay `1/1` passed. The Cloudflare pool completed `9/9` assertions twice, then its pinned native `workerd` process segfaulted both times and Vitest reported one infrastructure error.
7. Browser: the migration harness and the responsive application regression pass in focused runs. The full suite remains non-green because the existing hydrated-thread scenario blocks its own mocked refresh until the 30-second test timeout, the Done fixture renders no completed task, and the column-scroll scenario retains an open process after failure.
8. Structure audit passed and reports no new dependency cycle.

---

## R. Current Dev Reassessment

1. The decomposition branch diverged before `dev` commits `50ea5c16`, `d64e9cce`, and `f6cc96f6`. Those commits add automatic task-state recovery, atomic runtime resume, protected incident retention, supervised fatal exit behavior, upload admission fixes, truthful runtime status, and client recovery behavior.
2. The merge has five syntactic conflicts, but the substantive compatibility risk is the delete/modify conflict for `backend/src/business/server/helper/create-http-server.ts`. The newer behavior in that deleted file must be moved to its extracted capability owners.
3. `backend/src/business/server/application/create-decision-os-server.ts` is a `1,166`-line function with `65` imports. It is smaller than the deleted monolith, but it still owns task assembly, federation assembly, control-plane assembly, request dependency adaptation, and process lifecycle in one lexical scope.
4. The three request stages remain valid. They make route precedence explicit and are each below `220` lines.
5. The existing durable anchors remain sufficient. This migration needs no new manifest, registry, state store, cache, index, event bus, HTTP framework, or persistent schema.
6. The earlier `640/640` backend result proves the feature snapshot only. It does not prove behavior preservation after integrating current `dev`.

---

## S. Current Dev Behavior Gaps

| id | current owner | missing current-dev behavior | required correction |
|---|---|---|---|
| D01 | `server/runtime/incident-supervisor.ts` | Restores `server-runtime` as a resumable global pause | Persist the fatal incident, protect its scope, schedule supervised process exit, and remove global request admission blocking |
| D02 | `task-state/runtime/local-task-runtime.ts` | Applies one migration marker to every project and only pauses incompatible state | Resolve migration admission per project and recover compatible legacy task state through the existing recovery transaction |
| D03 | `task-state/runtime/federated-task-runtime.ts` | Pauses incompatible derived caches permanently | Archive the derived incompatible cache, rebuild it, reconcile replication, then clear the owning pause |
| D04 | `server/runtime/project-runtime-registry.ts` | Disposes watchers and SSE clients without observing settlement; cannot install a replacement state while admission remains paused | Observe watcher close, settle clients, accept a task-state override, and admit only the explicitly recovering scope |
| D05 | `server/runtime/runtime-recovery-service.ts`, `resume-runtime-scope.ts` | Deletes pause state before replacement validation and resolves incidents after partial mutation | Build replacement state and context first, reconcile, persist incident resolution, then remove the pause |
| D06 | `server/http/diagnostic-routes.ts` | Derives degradation from every unresolved incident | Derive interruption from active admission state while retaining non-pausing incident evidence |
| D07 | `codex/http/task-execution-read-routes.ts` | Already contains the required empty projection for non-task cards | Keep the existing extracted behavior and cover both local and remote reads |
| D08 | `transcription/http/thread-upload-routes.ts` | Writes image files before task ownership, content availability, and image decoding are validated | Validate and materialize first, build the preview in memory, then install original and preview transactionally |
| D09 | `server/http/create-node-http-listener.ts` | Does not resolve the prior child's `server-runtime` incident after a supervised replacement listens | Resolve that scope only after the listener is open |
| D10 | `server/application/create-decision-os-server.ts` | Remains a universal lexical container | Extract task/execution assembly, federation assembly, and request dependency adaptation without adding shared mutable models |

---

## T. Migration Task Inventory

| id | type | target_files | target_symbols | why | change | done_when | depends_on |
|---|---|---|---|---|---|---|---|
| T15 | code | `server/runtime/incident-supervisor.ts`, `server/http/global-request-stage.ts`, `server/helper/runtime-incident-ledger.ts` | `createIncidentSupervisor`, fatal process handlers, protected scopes | Current `dev` reserves process exit for process-wide invariants and retains incident evidence | Replace resumable global pause with recorded supervised fatal exit and protected active scopes | No global route gate depends on `server-runtime`; fatal evidence is retained until replacement listen | |
| T16 | code | `task-state/runtime/local-task-runtime.ts`, `task-state/helper/recover-project-task-current-state.ts` | `stateForProject`, `openStateForProject`, `scheduleAutomaticRecovery` | Compatible legacy state must recover without restarting and without blocking unrelated projects | Make migration admission project-scoped and install recovered state through the existing transaction | Recovery test preserves port, restores projection, verifies format, and clears only the owning pause | T15 |
| T17 | code | `task-state/runtime/federated-task-runtime.ts`, `task-state/helper/archive-incompatible-federated-task-state.ts` | `storeForProject`, `openStateForProject`, `scheduleCacheRecovery` | Federated cache is derived data and must not permanently pause a project | Archive incompatible derived state, rebuild, reconcile, and clear after durable incident resolution | Focused cache recovery tests pass and source bytes are archived | T15 |
| T18 | code | `server/runtime/project-runtime-registry.ts` | `dispose`, `context`, `tryContext` | Atomic recovery needs replacement context construction while admission stays paused | Observe watcher close, settle SSE clients, accept state override, and allow only the selected recovery scope | Failed replacement retains pause; successful replacement settles old clients and installs one context | T16 |
| T19 | code | `server/runtime/runtime-recovery-service.ts`, `server/runtime/resume-runtime-scope.ts` | `createRuntimeRecoveryService`, `resumeRuntimeScope` | Current extraction clears admission before validation | Revalidate and install each scope atomically, resolve incidents before deleting pause state, reject unknown background scopes | Every resume failure returns `409`, preserves the pause, and records evidence | T16, T17, T18 |
| T20 | code | `server/http/diagnostic-routes.ts`, `server/application/create-decision-os-server.ts` | health projection, incident-ledger construction | Runtime status must distinguish interruption from retained error history | Supply protected scopes and derive health from actual paused owners | Health remains ready for resolved request errors and degraded for active paused owners | T15, T19 |
| T21 | code | `transcription/http/thread-upload-routes.ts` | `handleThreadUploadRoutes` | Rejected task images must not leave orphaned files | Validate ownership, materialize thread content, decode preview, then commit files and contribution | Invalid owner, unavailable content, and decode failure leave no installed asset | T16 |
| T22 | code | `server/http/create-node-http-listener.ts`, `server/application/create-decision-os-server.ts` | `createNodeHttpListener`, `onListening` | Supervisor evidence must close only after replacement readiness | Resolve `server-runtime` after the listener opens | Launcher recovery test proves retained evidence before listen and resolution after listen | T15 |
| T23 | code | `server/runtime/server-execution-runtime.ts`, `federation/runtime/federation-state-runtime.ts`, `federation/runtime/federation-connection-runtime.ts`, `server/http/create-server-request-handler.ts`, composition root | new capability factories, `createDecisionOsServer` | The replacement root remains oversized and couples unrelated owners | Move existing assembly blocks behind typed capability factories; keep late binding local to each owner | Root contains input resolution, capability construction, listener binding, and shutdown in at most `300` lines | T15-T22 |
| T24 | test | current merge conflicts and affected backend/frontend/browser suites | recovery, upload, execution read, launcher, responsive thread assertions | The feature snapshot does not prove the merged behavior | Resolve tests to current `dev`, run all suites once, group failures, investigate disjoint groups in parallel, fix as one batch, loop focused groups, rerun all | Full verification evidence covers the merged tree | T23 |
| T25 | code | all iteration files and this document | changed symbols, structure audit | Final structure must not reintroduce bloat after fixes | Run code-quality, over-engineering, and bloat audits; remove duplication; record lessons | No unresolved iteration-scoped quality finding and structure audit reports no new cycle | T24 |

Readiness: `READY_FOR_TASK_DEPENDENCY`

---

## U. Current Dev Implementation Groups

| group_id | tasks | collision boundary | gate |
|---|---|---|---|
| G10 | T15-T20 | Incident maps, task runtimes, project contexts, recovery service, and health share one recovery transaction | Complete together before route-edge work |
| G11 | T21-T22 | Upload transaction and listener recovery are independent from each other after G10 | Complete both before composition extraction |
| G12 | T23 | Every assembly extraction changes the composition root | One owner; no parallel source edits |
| G13 | T24 | Test failures may be parallelized only after grouping by disjoint files and symbols | All grouped focused loops green before full rerun |
| G14 | T25 | Final source and documentation | Run only after full verification |

1. `G10` through `G14` are complete.
2. No operator question blocks integration.
3. `READY_FOR_INTEGRATION`.

---

## V. Current Dev Completion Evidence

1. The former `5,682`-line `server/helper/create-http-server.ts` is deleted. `server/application/create-decision-os-server.ts` is the public composition root at `285` lines.
2. Foundation, federation, hosted-project recovery, execution, request adaptation, and listener lifecycle have separate owners. Every new HTTP and runtime module is below `300` lines.
3. Automatic local task-state recovery queues requests raised before the recovery service is constructed, then installs the replacement state before clearing its project pause.
4. Master workspace settings are hydrated from `.settings.json` only when the caller did not provide an explicit runtime settings object. This preserves direct-server capacity configuration and injected federation identity.
5. The first complete backend run passed `648/649`; the workspace-capacity test exposed missing master settings hydration. Two parallel read-only investigations identified the same production boundary.
6. The next complete backend run exposed six settings regressions because unconditional hydration replaced explicit runtime settings. The grouped federation, migrated-content, failsafe, server-helper, and capacity tests passed `46/46` after conditional hydration.
7. Final verification passed: backend `649/649`, frontend `608/608`, backend typecheck, and frontend typecheck.
8. The repeatable structure audit reports the same two pre-existing dependency cycles and no new cycle. None of the modules added by this iteration appears in its oversized-file inventory.
9. No new manifest, registry, state store, cache, index, event bus, HTTP framework, persistent schema, or speculative recovery model was added.

---

## W. Current Dev Lessons

1. A delayed callback cannot default to a no-op when initialization can invoke it. Buffer requested work by stable project identity until the owning service is installed.
2. Settings ownership has two valid sources with explicit precedence: preserve an injected runtime settings object; otherwise hydrate the master workspace settings before constructing capacity and federation runtimes.
3. A green feature snapshot does not prove a behavior-preserving merge. Rerun the full suite after current-branch behavior is integrated, group failures by boundary, fix the production cause, then rerun the complete suite.
4. A composition root is thin when it resolves inputs, constructs capability owners, binds the listener, and coordinates shutdown. Domain recovery, federation synchronization, projection assembly, and request adaptation belong in their owning runtime modules.
