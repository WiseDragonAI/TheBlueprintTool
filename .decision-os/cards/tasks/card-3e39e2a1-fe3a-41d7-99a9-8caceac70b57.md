## A. Scope

1. Route known task mutations through granular field events instead of whole-ledger comparison.
2. Persist each local mutation as one event batch, one projection update, and one pending-acknowledgement update.
3. Serve every locally hosted project from one logical-project projection and remove owner-qualified caches from that read path.

---

## B. Acceptance

1. A local task mutation never scans every snapshot and never rewrites pending state once per event and destination.
2. A local card with a stale foreign selector returns the same local representation as the selector-free route.
3. Task conflict ordering uses a causal revision contract rather than unsynchronized wall-clock precedence.
