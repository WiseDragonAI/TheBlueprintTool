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
