# Epoch-4 Replication Incident — 2026-08-09

## A. Scope and Closure

1. This incident spans the degraded `rel-0.4.2` release through the `rel-0.4.8` repair and restart proof.
2. `rel-0.4.2` entered production with retained watcher failures and paused scopes. The copied-main baseline reproduced 174 incidents across MOH, Decision OS, and Lys.
3. Closure was reached on `rel-0.4.8`, main SHA `72f633665cc1453cbc41540c8963079a9ead1dba`, with production relay and application aligned on protocol `decision-os-task-state/4`, schema `4`, and baseline epoch `4`.
4. After restart, production reproduced MOH root `107dcb74d6dd437812023c15d1023611fb17a621d233ce6ee0cb4a9cdd06b018` with health `ready`, zero active incidents, zero paused scopes, no missing buckets, no dirty entities, no pending deliveries, no queued relay entities, no active repairs, and an empty content queue.

---

## B. First Incorrect Transitions

1. Watcher startup treated a retained remote head with an absent mutable Markdown sidecar as a local filesystem contribution, causing `task_content_capture_failed` and watcher pauses.
2. Cold synchronization selected direct owner-node repair instead of the relay's bounded durable repair authority.
3. Each bounded relay frame caused synchronous whole-state serialization and replacement, amplifying persistence work as the retained state grew.
4. Repair timeout removed active bookkeeping, so zero queue gauges appeared while destination roots still differed.
5. One same-dot collision rejected a whole batch before healthy independent entities could commit and receive terminal ACKs.
6. Recovery required normal runtime admission even though the no-progress pause intentionally excluded that project from normal runtime state.

---

## C. Root Cause

1. The replication lifecycle did not have one end-to-end authority for bounded scheduling, durable join, ACK settlement, retry, collision evidence, convergence, pause, and explicit recovery.
2. Watcher ownership, relay persistence, node-to-relay publication, relay-to-node repair, incident evolution, and paused recovery had been validated as separate components rather than one durable state machine.
3. Release admission accepted component-level evidence and empty-relay canaries that could not exercise contradictory retained production state.

---

## D. Release-by-Release Correction

1. `rel-0.4.3` corrected watcher admission, routed cold repair through relay authority, bounded delivery windows, grouped durability, and deferred derived work. It proved healthy copied-state transport but not retained production collisions.
2. `rel-0.4.4` added per-entry acceptance and rejection, exact submitted-hash ACK semantics, complete collision evidence, and deterministic relay-to-node recovery.
3. `rel-0.4.5` bound sequential recovery to the exact successor hash and validated the active incident generation.
4. `rel-0.4.6` added bounded relay-root authority and durable evidence for node-to-relay publication collisions.
5. `rel-0.4.7` added explicit validation and upgrade of retained incidents created before the current evidence schema.
6. `rel-0.4.8` opened an isolated paused store, completed successor publication and exact convergence, flushed and reopened durable state, validated the active incident generation, and installed normal runtime only after that proof.

---

## E. Proof Failures Corrected

1. The watcher fixture had created readable Markdown and therefore missed retained-head plus startup `ENOENT`.
2. Raw WebSocket and frame-count tests bypassed the connector, destination store, dirty state, incident ledger, durable reopen, and exact-root boundary.
3. Empty-relay canaries proved transport but omitted contradictory production relay authority.
4. Zero dirty, pending, queued, and active counters were treated as success even after timed-out work disappeared while roots remained unequal.
5. Collision fixtures initially fabricated rejection frames instead of composing connector, relay storage, incident persistence, restart, recovery, and durable reload.
6. The final proof boundary became exact equal roots after durable receiver application, followed by fresh reload and restart reproduction.

---

## F. Operational Failures Corrected

1. A known watcher correction was omitted from the `rel-0.4.2` release inventory, and the release proceeded while explicitly degraded.
2. A full-catalog canary ran in MultiTerm's shared resource scope; `systemd-oomd` killed the scope after approximately 21.7 GB RAM plus 1.3 GB swap, invalidating process-level memory attribution and interrupting the evidence session.
3. Fresh dev and empty-relay success were used beyond their proof boundary while production ran different code and retained different durable relay state.
4. Restart was initially treated as a way to clear pauses. Durable pauses instead required explicit evidence validation, recovery, resolution, and restart proof.
5. Production relay identity and application identity are now one release compatibility boundary even though deployment and application restart remain separate operations.

---

## G. Durable Lessons

1. Structural task state and content objects require separate authority, payload, scheduling, and convergence contracts.
2. Relay scheduling, durable store join, ACK credit release, equal-root convergence, incident-owned pause, and explicit successor recovery each require one named authority.
3. Collisions are terminal protocol outcomes with mixed per-entry settlement, not generic batch exceptions.
4. Recovery identities require project, direction, roots, attempt, delivery, key, submitted hash, and resulting hash.
5. Durable incident schema changes require an explicit upgrade path for retained incidents.
6. A paused scope needs a restricted recovery admission domain that cannot reopen normal work before durable proof.
7. Release proof must exercise the real topology and retained authority state. Availability and component tests cannot substitute for exact convergence and restart persistence.

---

## H. Current Technical Owner

1. [Epoch-4 federation repair and recovery](../documentation/architecture/epoch-4-federation-repair-and-recovery.md) owns the current architecture extracted from this incident.

---

## I. Working-Document Recycling Disposition

1. `main-state-replication-pre-fix-analysis-report-2026-08-08.md` supplied the reproduced watcher, relay-persistence, direct-repair, content-head, and diagnostic failure transitions; Sections B, C, E, and F retain the durable incident findings.
2. `rel-0.4.2-main-blocked-interrupted-session-rca-2026-08-08.md` supplied the omitted watcher correction and MultiTerm resource-scope failure; Sections C and F retain those causes.
3. `post-0.3.0-relay-flood-remediation-audit-2026-08-08.md` supplied the invalid socket-send completion boundary, collision evidence defects, and receiver-durability requirement; Sections B, C, E, and G retain the final findings.
4. `rel-0.4.2-replication-static-remediation-plan-2026-08-08.md` and `epoch-4-fast-reliable-full-state-sync-plan-2026-08-08.md` were intermediate implementation plans. Their verified final-state mechanics are owned by the architecture page; their patch order, hypotheses, and proposed gates are discarded.
5. `main-state-two-node-fake-relay-fast-recovery-procedure-2026-08-08.md` was a one-iteration qualification plan rather than a repeatable operator procedure. Its reproduced watcher transition and proof defects are retained here; its canary construction and provisional timing targets are discarded.
6. `epoch-4-test-harness-gap-analysis-2026-08-08.md` was a superseded harness critique. Its durable requirement for receiver application, exact-root comparison, restart durability, and independent failure evidence is retained in Sections E and G; its proposed harness expansion is discarded.
