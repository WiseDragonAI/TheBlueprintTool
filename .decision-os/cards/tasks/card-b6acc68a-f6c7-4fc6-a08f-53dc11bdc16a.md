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

## F. Subtasks

1. [Define chronological field-event semantics](card:card-5ceeedcd-3f65-482e-8901-31ce664a7d9d)
2. [Build the event log, snapshots, and projection](card:card-d0edb909-0b5a-4327-b9d0-fd68e3e04d90)
3. [Route task mutations through event authority](card:card-9c74f4da-db2a-4988-adc8-bc3166b0b0d1)
4. [Extend the Cloudflare relay for event replication](card:card-33342b59-aa84-4a59-a7f1-af439ac994a1)
5. [Replace hydrated replicas with an asynchronous content lane](card:card-d387d03e-f829-445c-b144-abb7659bcd6e)
6. [Decouple event durability from Git](card:card-6efae974-597c-4deb-a97b-89017f85df80)
7. [Migrate misplaced task graphs once](card:card-3ce4451c-256e-4380-8d61-aab4d4294e74)
8. [Verify convergence and failure recovery](card:card-d9b41fe5-6d3f-446e-a482-5881f1d480f5)
9. [Complete report: real-time field-event replication](card:card-a66f17b1-3cb2-468a-8f15-88a1bc7e0f2d)
