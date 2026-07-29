## A. Migration Outcome

1. **Required behavior.** Recover compatible hosted task state and derived federation caches without restarting the server, keep every unrelated project and component admitted, terminate genuine process-wide failures into bounded launcher supervision, and show only authoritative project pauses as `Paused`.
2. **Preservation boundary.** Retain every existing task-state transaction, incident record, library feature, pipeline feature, pending-message receipt, watcher notification, emergency diagnostic route, delivery identity field, and operator resume route.
3. **Source boundary.** This plan implements `documentation/working-documents/runtime-recovery-and-system-status-plan-bloat-reassessment-2026-07-29.md` against `dev` commit `23546cc5b9631b6ad54240ff567d26f0a427fe5f`.
4. **Migration strategy.** Change runtime admission in six focused groups, reuse existing durable anchors, add failure-boundary regressions with each group, then run the complete repository verification once the focused groups pass.

---

## B. Verified Current-State Corrections

1. **Image-note receipts already exist.** `pasteThreadImageController()` persists uploaded markdown through `persistPendingThreadMessage()` and `commitPendingThreadMessage()`. Preserve this path and add only backend preflight plus focused recovery coverage.
2. **Corrupt incident bytes are already preserved.** `createRuntimeIncidentLedger()` renames an invalid ledger to a unique `.corrupt-*` path before exposing replacement diagnostic evidence. Preserve this mechanism.
3. **Incident retention remains incomplete.** `record()` sorts every incident together and slices by recency, so an incident referenced by a live pause registry can be evicted.
4. **Status rendering already exposes pause details.** `application.js` renders `projectRuntimeRows()` detail and distinguishes grouped `Interruption` from `Error`. No status-screen redesign is required.
5. **The migration marker lacks scope identity.** `persistJournal()` writes transaction identity and phase without `projectIds`, while `createHttpServer()` applies every nonterminal marker to every hosted project.
6. **The launcher is not a supervisor.** `decision-os-server.mjs` starts one child and enters permanent emergency mode after its first abnormal exit.

---

## C. Lean Architecture

1. **Status source of truth.** Use `pausedTaskProjects`, `pausedProjectWatchers`, `pausedProjectRuntimes`, `pausedBackgroundComponents`, and a genuine fatal incident during the process-exit boundary. Keep `pausedFederatedTaskProjects` visible as component interruption evidence without using it as a hosted-project pause reason.
2. **Recovery source of truth.** Use `prepareTaskCurrentStateMigrationPlan()`, `buildTaskCurrentStateMigrationShadow()`, `runTaskCurrentStateMigrationTransaction()`, and the transaction source fingerprint. Add no recovery database.
3. **Derived-cache recovery.** Archive the exact incompatible cache root, create a compatible empty cache through the existing task-state store, reopen it, and request relay reconciliation.
4. **Resume transaction.** Keep the pause registered while the old context and SSE responses settle, replacement state validates, the context reopens, projections refresh, and incident resolution persists. Remove the pause last.
5. **Fatal transaction.** Persist one fatal incident, schedule one nonzero child exit, restart with bounded exponential backoff, then expose the existing launcher emergency diagnostics after the finite circuit is exhausted.
6. **Content recovery.** Add a bounded watcher flush with one retry and preflight task-content admission before creating image files. Reuse the existing pending-message receipt.

---

## D. Task Inventory

| id | type | title | target_files | target_symbols | action | done_when | depends_on |
|---|---|---|---|---|---|---|---|
| T01 | code | Correct hosted-project pause truth | `frontend/src/app/responsive/runtime-status.js` | `projectPauseReasons`, `interruptionScopes`, `projectRuntimeRows` | Remove federated cache state from hosted-project pause reasons while retaining it as an interrupting component scope. | A hosted project with only a federated cache pause is available and the cache incident remains an interruption. | |
| T02 | code | Derive health from live admission | `backend/src/business/server/helper/create-http-server.ts` | health diagnostics route, pause registries | Set health degradation from authoritative pause registries plus the fatal exit boundary; retain unresolved incidents in diagnostics without treating every incident as runtime blockage. | Nonblocking unresolved incidents do not degrade health; every registered pause does. | T01 |
| T03 | code | Isolate global skill and pipeline loading | `frontend/src/app/responsive/codex.js` | `loadGlobalLibraries` | Settle server skill and pipeline requests independently, update each healthy state slice, preserve valid pipeline records returned with issues, and report the failed slice. | Either library remains usable when the sibling request fails. | |
| T04 | code | Convert fatal in-process pauses into exits | `backend/src/business/server/helper/create-http-server.ts` | `globalRuntimeIncident`, `pauseGlobalRuntime`, process error handlers, global request gate, runtime resume route | Remove global request admission state and in-process fatal resume; persist fatal evidence once and schedule one nonzero process exit. | A process-wide failure cannot leave a live globally gated child. | T02 |
| T05 | code | Add bounded launcher supervision | `bin/decision-os-server.mjs`; `bin/decision-os-launcher-emergency.mjs` | `main`, child spawn/exit handlers, emergency incident context | Restart an abnormally exited child with finite exponential backoff and open the existing emergency diagnostic server only after circuit exhaustion. | A transient child failure restarts; repeated failures stop after the configured attempt count and expose durable emergency evidence. | T04 |
| T06 | code | Make scoped resume atomic | `backend/src/business/server/helper/create-http-server.ts` | `disposeProjectContext`, `taskStateForProject`, `projectContext`, `tryProjectContext`, runtime resume route | End project SSE responses, retain the pause during replacement validation and context reopen, persist incident resolution, clear pause last, and retain the pause on every failure. | Resume success proves validated state, reopened context, refreshed projection, durable incident resolution, settled SSE, and removed pause. | T04 |
| T07 | data | Scope migration admission markers | `backend/src/business/task-state/helper/task-current-state-migration-transaction.ts`; `backend/src/business/server/helper/create-http-server.ts` | `persistJournal`, migration admission parsing | Persist sorted transaction `projectIds` and apply a nonterminal marker only to those projects; retain node-wide behavior for legacy markers without identity. | A marker for one project cannot pause another project. | T06 |
| T08 | code | Recover compatible hosted task state automatically | new narrow task-state recovery helper; `backend/src/business/server/helper/create-http-server.ts` | `taskStateForProject`, transaction preparation/build/run functions | Coordinate one automatic recovery attempt per project source fingerprint, dispose the owning context, execute the existing transaction, validate reopened state, resolve the incident, and clear the owning pause. | Compatible legacy hosted state recovers without process restart and repeated reads do not create repeated attempts for unchanged bytes. | T07 |
| T09 | code | Rebuild incompatible derived caches | new narrow derived-cache recovery helper; `backend/src/business/server/helper/create-http-server.ts` | `federatedTaskStoreForProject`, federated resume branch | Fingerprint and archive the exact incompatible cache, install a compatible empty cache, reopen it, and request relay reconciliation without touching hosted authoritative admission. | An incompatible derived cache rebuilds automatically and cannot pause a hosted project. | T06 |
| T10 | code | Retain live pause incidents | `backend/src/business/server/helper/runtime-incident-ledger.ts`; `backend/src/business/server/helper/create-http-server.ts` | `createRuntimeIncidentLedger`, `record`, pause registries | Supply protected incident identities from live pause registries and evict resolved history before protected active incidents. | Retention pressure cannot remove incident evidence that owns a live pause. | T06 |
| T11 | code | Add bounded watcher delivery recovery | `backend/src/business/refresh/helper/watch-card-content-files.ts`; `backend/src/business/refresh/helper/watch-project-files.ts` | `publish`, pending event lifecycle, watcher return contract | Track pending publications, expose a finite flush, retry a failed publication once, and settle pending work during close. | One transient publication failure is retried once and close settles every pending watcher operation. | |
| T12 | code | Preflight image-note admission | `backend/src/business/server/helper/create-http-server.ts` | `/api/thread-image-upload`, task-content ownership/admission helpers | Validate the target project, task state, thread ownership, and content availability before writing original and preview assets; retain existing cleanup on downstream failure. | Rejected image-note admission creates no asset and the existing pending-message path retains retry intent. | T06 |
| T13 | test | Prove focused failure boundaries | `frontend/test-responsive/runtime-status.test.mjs`; frontend Codex library tests; `backend/test/server/runtime-failsafe.integration.test.ts`; `backend/test/server/server-launcher-failsafe.integration.test.ts`; task-state transaction tests; incident-ledger tests; watcher tests; pending-message tests | status, health, libraries, fatal supervision, resume, migration, cache, retention, watcher, image upload | Inject each first failing boundary and prove containment, durable evidence, byte preservation, resource settlement, and explicit or automatic recovery. | T01,T02,T03,T04,T05,T06,T07,T08,T09,T10,T11,T12 |
| T14 | docs | Record implementation lessons | this document | lessons and verification register | Record failure groups, repairs, avoidable issues, reusable test fixtures, and commands after the full suite passes. | The document contains final evidence and future prevention guidance. | T13 |

**Open Questions**

1. None.

**Readiness:** `READY_FOR_TASK_DEPENDENCY`

---

## E. Dependency Graph

| from_task | to_task | edge_type | reason | evidence |
|---|---|---|---|---|
| T01 | T02 | soft-ordering | Frontend and backend must share the same admission meaning before health assertions are finalized. | `runtime-status.js` consumes diagnostics fields from `create-http-server.ts`. |
| T02 | T04 | shared-file-risk | Both changes edit diagnostics and fatal state in `create-http-server.ts`. | Health route and `globalRuntimeIncident` share server-local state. |
| T04 | T05 | hard-blocker | Removing the global gate is safe only when abnormal child exits are supervised. | Current launcher enters permanent emergency after one exit. |
| T04 | T06 | shared-file-risk | Fatal lifecycle and scoped resume both restructure runtime admission in the same server helper. | Both own pause registration and resume semantics. |
| T06 | T07 | shared-file-risk | Atomic resume and scoped marker admission both change `taskStateForProject()` and the resume route. | Shared server symbols. |
| T07 | T08 | migration-order-risk | Automatic hosted recovery consumes the project-scoped marker contract. | Transaction marker identity must exist before online recovery writes it. |
| T06 | T09 | shared-state-risk | Cache recovery must follow the same validate-resolve-clear invariant as scoped resume. | `pausedFederatedTaskProjects` and the federated resume branch share state. |
| T06 | T10 | shared-state-risk | Protected incident retention needs the final set of live pause registries. | Incident IDs originate in pause maps. |
| T06 | T12 | shared-file-risk | Image preflight and atomic resume both edit the large server helper. | Shared HTTP route owner. |
| T01,T02,T03,T04,T05,T06,T07,T08,T09,T10,T11,T12 | T13 | test-order-risk | Focused tests must cover the final grouped implementation. | Each requirement has an injected failure boundary. |
| T13 | T14 | hard-blocker | Lessons require actual failure and repair evidence. | Test-and-fix output is the source. |

---

## F. Independent Task Groups

| group_id | task_ids | target_files | target_symbols | independence_reason | dispatch_notes |
|---|---|---|---|---|---|
| G01-status-truth | T01,T02 | runtime status frontend; server health route; focused tests | pause derivation and health payload | Owns status semantics without changing durable recovery. | Preserve the diagnostics payload shape. |
| G02-library-containment | T03 | responsive Codex library loader and focused tests | `loadGlobalLibraries` | Does not share runtime admission state. | Preserve all existing library state and controls. |
| G03-fatal-and-resume | T04,T05,T06 | server helper; launcher; emergency metadata; failsafe tests | fatal handlers, child supervision, resume transaction | These tasks form one safety boundary and share server ownership. | Implement together before automatic recovery. |
| G04-automatic-state-recovery | T07,T08,T09 | migration transaction; narrow recovery helpers; server integration; focused tests | marker identity, hosted recovery, cache recovery | Owns task-state recovery after atomic pause semantics exist. | Reuse transaction and store APIs. |
| G05-incident-retention | T10 | incident ledger; minimal server wiring; unit tests | protected retention | Can be isolated after pause registry identities stabilize. | Add no incident schema fields. |
| G06-content-image-recovery | T11,T12 | watchers; upload preflight; existing recovery tests | watcher flush/retry and image admission | Independent from task-state migration, with one server-file collision scheduled after G05. | Reuse pending-message receipts. |
| G07-verification-lessons | T13,T14 | all focused tests; complete suite; this report | grouped failure repair and lessons | Runs after every implementation group. | Investigate all failures in parallel groups before edits. |

**Sequential Gates**

1. **Gate 1.** G03 starts after G01 health semantics are stable.
2. **Gate 2.** G04 starts after G03 proves fatal supervision and atomic scoped resume.
3. **Gate 3.** G05 starts after G04 finalizes pause registry ownership.
4. **Gate 4.** G06 server integration starts after G05 leaves `create-http-server.ts`.
5. **Gate 5.** G07 starts after all implementation groups and focused change tests are present.

**Collision Risks**

1. `backend/src/business/server/helper/create-http-server.ts` is shared by G01, G03, G04, G05, and G06; these edits remain sequential in one worktree.
2. Runtime pause maps, project contexts, SSE clients, migration admission, and incident resolution form one state transition and must not be split across concurrent writers.
3. Launcher retry tests own child timing and port fixtures; no live server process is used.
4. Automatic migration tests own temporary durable roots and must not read workspace `.decision-os` state.

**Ambiguities**

1. None.

**Readiness:** `READY_FOR_TASK_GROUP_COMPLETENESS`

---

## G. Engineering Completeness Findings

1. **Architecture.** The groups preserve current sources of truth and add no duplicate persistence.
2. **Runtime state.** Fatal process state, hosted project pauses, derived cache pauses, component pauses, project contexts, SSE clients, and incident resolution each have an explicit owner and settlement point.
3. **Migration.** The existing archive-shadow-verify-install-rollback transaction remains authoritative. Project identity is added only to its admission marker.
4. **Frontend.** Status and library changes preserve rendered structure, styles, controls, and all healthy state slices.
5. **Failure proof.** Every new boundary has a focused injected-failure test before the complete suite.
6. **Operational boundary.** Implementation and tests use the isolated worktree. No live server restart, stop, resume, incident resolution, project migration, or operator-browser action is part of this run.

**Fundamental Missing Tasks**

1. None after adding T10 incident retention, T11 watcher settlement, and T12 upload preflight.

**Input Card Edits Applied**

1. Preserved the existing corrupt-ledger archive behavior instead of replacing it.
2. Removed redundant image receipt implementation because `PendingThreadMessage` already owns it.
3. Added legacy-marker compatibility so existing node-wide nonterminal markers remain conservative.
4. Kept emergency frontend serving deferred as required by the reassessment.

**Dispatch-Ready Groups**

1. G01 through G07 are complete and collision-ordered.

**Blocking Questions**

1. None.

**Dispatch Readiness:** `ready`

---

## H. Bloat and Over-Engineering Register

| Ref | Category | Why It Is Bloat | Action |
|---|---|---|---|
| Backend status projection fields | redundant | Diagnostics already expose pause registries and incident records. | delete |
| Recovery database | redundant | Transaction journal, source fingerprint, archive, and incident ledger already own recovery evidence. | delete |
| Incident schema migration | over-specific | `paused` remains a compatible unresolved-incident value; interruption is derived from live admission. | delete |
| Status-screen redesign | off-purpose | Existing rendering already shows project detail and error/interruption badges. | delete |
| New image receipt model | redundant | `PendingThreadMessage` already preserves exact markdown and retry identity. | delete |
| Image manifest and cleanup scheduler | over-specific | Preflight prevents the rejected write and current failure cleanup handles downstream errors. | delete |
| Generic conflict framework | off-purpose | Existing task-content classifications and atomic transaction cover the observed failures. | delete |
| Complete frontend in launcher emergency mode | misplaced | The current requirement is bounded supervision plus readable diagnostics. | defer |
| One implementation worker per task | process-noise | Shared server state makes that split unsafe and creates merge churn. | merge |

---

## I. Acceptance Evidence

1. **Status truth:** focused frontend and backend tests prove cache-only incidents do not pause a hosted project and real admission registries degrade health.
2. **Containment:** integration tests prove one project, cache, watcher, component, request, and child failure leaves unrelated scopes plus diagnostics available.
3. **Automatic recovery:** transaction and server tests prove one fingerprinted attempt, byte-preserving archive, validated install, and no restart.
4. **Atomic resume:** failure injection at disposal, validation, context reopen, projection refresh, incident persistence, and reconciliation proves the pause remains until success.
5. **Fatal supervision:** launcher fixtures prove bounded backoff, transient recovery, finite circuit opening, diagnostic evidence, and clean intentional exit.
6. **Content/image recovery:** watcher and upload tests prove one retry, finite settlement, preflight-before-write, and retained pending intent.
7. **Complete regression:** `node bin/decision-os-verify.mjs -- npm run test:front-back` exits `0`.
8. **Quality:** the final changed-file review removes duplication, preserves behavior, and records no speculative persistence or framework.

---

## J. Implemented Groups

1. **Status and library truth.** Project pause state now comes from hosted-project admission. Derived federation cache incidents remain visible without pausing the hosted project. Skills and pipelines settle independently and retain the healthy slice.
2. **Fatal and scoped recovery.** Process-wide failures persist fatal evidence and exit into bounded launcher supervision. Project, watcher, runtime, background, and federated task-state resume paths validate replacement state, persist incident resolution, then clear the owning pause.
3. **Automatic task-state recovery.** Compatible hosted state uses the existing migration plan, shadow build, transaction journal, and atomic install. Incompatible derived federation cache bytes are fingerprinted, archived exactly, and rebuilt through the existing store before relay reconciliation.
4. **Incident and watcher durability.** Live pause scopes protect their incident evidence from retention eviction. Watchers retry one transient publication, flush pending debounce work, and settle against a finite close deadline.
5. **Image-note admission.** Task ownership, content materialization, and image decoding complete before asset writes. The existing pending-message receipt remains the retry authority.
6. **Client reconciliation.** Non-task execution history, legacy-route project identity, verified thread-document restoration, and exact Tasks clock admission retain all prior card, thread, pipeline, and navigation behavior.

---

## K. Grouped Verification Record

1. **Initial grouped browser failure.** The first complete run passed frontend and backend verification, then reported one failure in `tests/browser/codex/reusable-step-pipelines.spec.ts`.
2. **Root cause.** The readiness predicate counted the source-card pipeline projection plus the generated inherited-step card. It advanced before the generated explicit-step card existed. The focused test passed because timing hid the race.
3. **Grouped correction.** Both readiness and forced-detail predicates now exclude the source card and require generated cards for the exact `Inherit defaults` and `Explicit override` steps.
4. **Focused recovery loop.** The pipeline, thread-document, legacy-route refresh, and derived-cache archive group passed 26 tests with zero failures.
5. **Final complete verification.** `node bin/decision-os-verify.mjs -- npm run test:front-back` exited `0`: frontend typecheck passed, backend typecheck passed, frontend tests passed, backend passed 645 tests, and browser passed 181 tests with 5 intentional skips and zero failures.
6. **Static hygiene.** `git diff --check` reported no whitespace errors.

---

## L. Avoidable Issues and Repeatable Tools

1. **Wait on exact identities.** A collection count was insufficient because source and generated pipeline projections share metadata. Browser helpers must wait for exact generated step identities.
2. **Keep project identity at the route boundary.** Legacy ledger routes omit the project segment. Ledger refresh retains the installed project identity; global canvases clear it.
3. **Restore verified thread state at replacement and render boundaries.** Same-revision canvas responses can carry older explicit thread slices. The existing scoped cache restores verified documents before ledger replacement and restores only the active thread during panel rendering.
4. **Force only required virtualized details.** The reusable `forcePipelineWidgetDetails()` helper waits for exact generated cards, forces their detail surfaces, and releases the measurement ownership after the scenario.
5. **Prove durable transitions.** Cancel and restart tests inspect terminal pipeline state and replacement run identity instead of treating HTTP `202` as completion.
6. **Preserve destructive scope.** Derived-cache archive rejects project identifiers that can escape its owned cache root.
7. **Use the repository lease.** Every typecheck and test command ran through `bin/decision-os-verify.mjs`; no ad hoc runner coordination was added.
8. **Investigate grouped failures before editing.** One low-effort subagent independently traced the full-suite pipeline race while the focused reproduction ran. The single correction addressed the complete failure group.
