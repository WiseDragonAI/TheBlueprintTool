## A. Present Failure

1. Mutable `ledger JSON` is still treated as **authority**. `Git pull` and `Git push` remain the practical replication triggers between nodes.
2. `Server routes`, `CLI helpers`, `Codex execution`, `pipelines`, and `project sync` can replace the aggregate without one durable mutation authority.
3. The current `task replica` combines `task metadata`, `card Markdown`, and `thread notes` in one hydrated snapshot, **coupling critical state convergence to content transfer and polling**.

---

## B. Authoritative State Model

1. The immutable `event log` becomes the **source of truth**. `Ledger JSON` becomes a `generated local projection`, never authoritative replicated state.
2. Every `structured ledger mutation` enters one `local worker`, which serializes all `terminal writers` and `server writers`.
3. **Persistence precedes every visible effect:** `local application`, `caller success`, `peer publication`, and `acknowledgement`.
4. Projection follows `emittedAt`; `late events` retain their original date, while incompatible `same-date writes` remain explicit conflicts.

---

## C. Cloudflare Replication Plane

1. The existing `Cloudflare Worker` and per-federation `Durable Object` become the **durable federation authority** for authenticated event delivery, retained project event sets, verified checkpoints, and reconciliation.
2. Nodes retain local event durability for offline operation; `Cloudflare` persists the complete shared event set and latest verified checkpoint so nodes that never overlap online still converge.
3. `Task events`, acknowledgements, state snapshots, and missing-event repair use the **priority state lane**; newly emitted events continue flowing during bootstrap and catch-up.
4. A fresh node installs a compatible verified state snapshot, then reconciles only the missing `event tail` before joining live delivery.

---

## D. Bounded Reconstruction

1. Durable versioned `snapshots` **bound replay cost**. Each records its `reducer version`, `projection checksum`, `conflict state`, and covered `event-bucket manifest`.
2. `Startup` and `rebuild` load the newest compatible `verified snapshot`, then apply only its uncovered `event tail`.
3. **Normal operation never replays from genesis.** `Full historical replay` remains only the fallback when no valid snapshot exists.
4. A `late event` inside covered history invalidates later snapshots, restarts from the newest preceding snapshot, and regenerates `checkpoints` while replaying forward.
5. Sealed `event segments` remain available for `reconciliation` and `archival`; snapshots reduce computation without erasing history.

---

## E. Independent Content Replication

1. **Task-state convergence never waits for content.** The priority lane replicates structured ledger fields and makes cards, relationships, status, and geometry usable first.
2. `Card Markdown`, `thread Markdown`, and referenced content replicate later through a separate `content manifest`, `hash verification`, persistent retry queue, and low-priority transfer budget; failures preserve the last verified local content.
3. Retire the hydrated task-snapshot endpoint, cache, invalidation poller, and replica store; use `.decision-os/tasks.json` for task state and migrate misplaced `task graphs` once while preserving the independent `specification ledger`.

---
