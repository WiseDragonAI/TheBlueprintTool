## A. Objective

1. **Open the Decision OS HTTP listener before project-local task hydration, execution recovery, watcher installation, skill discovery, and relay reconciliation.**
2. Preserve the existing epoch-4 current shards and CRDT convergence rules; do not add another snapshot, checkpoint, startup manifest, index, or state database.
3. Make each project bootstrap independently so one slow or invalid project cannot delay health, diagnostics, static routes, the cached Control Room, or another project.

---

## B. Verified Cause

1. Current startup calls `server.listen()` only after all project startup promises settle.
2. The decision-os project currently contains more than 5,000 current-state entity files that are synchronously read, parsed, materialized, indexed, and connected to watcher ownership before listener readiness.
3. Relay availability is not required for local execution, but relay reconciliation is currently composed into the same startup lifecycle.
4. Existing tests prove eventual listener availability and warm-request performance; they do not bound listener latency against a production-sized local corpus.

---

## C. Required Runtime Contract

1. Validate global settings, the project registry, and the incident ledger, then open the listener.
2. Serve the persisted Control Room cache as stale while project task state is loading.
3. Derive project readiness from existing runtime context and incidents without creating a new durable readiness model.
4. Hydrate each project, install its watchers, recover its local executions, and start relay repair in one project-scoped background sequence.
5. Keep local project operation available when the relay is offline.

---

## D. Acceptance Criteria

1. A production-sized project cannot prevent `/api/health`, diagnostics, static frontend routes, or a healthy project from responding within the startup deadline.
2. The cached Control Room is readable before task-state hydration completes and becomes current after project bootstrap.
3. Queued and active execution recovery occurs after the owning project becomes locally ready without blocking the listener.
4. Relay mismatch repair converges after local readiness and never gates local readiness.
5. Storage-shape assertions and exact internal-work counters are removed from default verification; tests assert durability, user-visible state, bounded readiness, scope isolation, and eventual convergence.
6. Focused tests, scoped typecheck, and the full repository suite pass through `node bin/decision-os-verify.mjs -- <command>`.
