# HTTP Server Composition

## A. Lifecycle Root

1. `backend/src/business/server/application/create-decision-os-server.ts` resolves the workspace, constructs capability runtimes in dependency order, binds the Node listener, and owns shutdown.
2. The root does not own durable card mutation, execution-presentation hydration, runtime recovery algorithms, project runtime state, Codex process coordination, federation library synchronization, project synchronization, or delivery execution.
3. `backend/src/business/server/http/create-node-http-listener.ts` contains request-failure translation and listener startup.

---

## B. Request Order

1. `global-request-stage.ts` serves recovery and diagnostics before the global pause gate, resolves project scope, forwards remote-owned resources, then admits global routes.
2. `project-data-request-stage.ts` serves card content, execution reads, ledger reads, task state, federation content, libraries, settings, synchronization, and the project catalog.
3. `project-interaction-request-stage.ts` serves assets, operational controls, content events, Codex routes, transcription, uploads, legacy ledger mutation, then the static application fallback.
4. Route ordering is behavioral. A new route belongs in its capability handler and in the one stage that owns its precedence.

---

## C. Runtime Ownership

1. `server/runtime/project-runtime-registry.ts` owns project contexts, watchers, revisions, and disposal.
2. `server/runtime/runtime-recovery-service.ts` owns explicit validation and resume transitions.
3. `codex/runtime/codex-process-coordinator.ts` owns shared process capacity and scheduling.
4. `codex/runtime/task-execution-presentation-reader.ts` owns local and replicated execution presentation reads.
5. `ledger/runtime/card-authoring-runtime.ts` owns card Markdown mutation, task materialization, persistence, revisions, and publication.
6. Federation, project-sync, delivery, task-state, and content-authoring handlers remain under their business capability directories.

---

## D. Structural Gate

1. Run `npm --prefix backend run audit:structure` to report TypeScript source size, imports, and internal dependency cycles.
2. Do not add a universal server kernel, service locator, generic event bus, route manifest, or second persistent runtime model.
3. Recoverable failures stay inside their owning project, task, execution, watcher, federation, synchronization, delivery, or background component scope.
