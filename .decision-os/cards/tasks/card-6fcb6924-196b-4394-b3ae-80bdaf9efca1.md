## A. Verified Storage Finding

1. **The files are historical migration backups, not active runtime logs.** The epoch-3 task store does not create `events/` or `snapshots/` rollback trees.
2. The inspected `/home/jbb` rollback roots contain **42,792 files using 14.48 GB**.
3. Two node-migration backup runs each contain **17,089 files using 6.20 GB** and cover the same projects.
4. The retained decision-os legacy tree contains **473 snapshots**. The Search legacy tree contains **660 snapshots**.
5. The current decision-os and Search task-state format markers report `stateSchema: 3` and `baselineEpoch: 3`. Their migration reports point to the later node backup.

---

## B. Cause

1. `migrateNodeTaskCurrentState()` copies the complete catalog `.decision-os` before iterating through project migrations.
2. `migrateTaskCurrentState()` then copies each complete project `.decision-os` into a timestamped rollback directory.
3. Those copies include unrelated `voice-uploads`, `runs`, caches, current task state, and older rollback trees.
4. The catalog root is also a registered project, so one cutover copies the same multi-gigabyte root twice.
5. Timestamped retry destinations have no retention path, so superseded migration attempts remain on disk.

---

## C. Proposed General Solution

1. Preflight every registered project before creating a rollback artifact.
2. Replace whole-root copies with one deterministic, resumable rollback bundle per node and migration epoch.
3. Store only the migration write-set: the affected task-state root, tasks ledger, rewritten body files, and a manifest for files created by migration.
4. Checksum that bundle, reuse it during recovery, and retain exactly one completed bundle.
5. Add regression coverage proving retries do not create additional backup trees and unrelated large directories are excluded.

---

## D. Selected Remediation

1. **After the operator confirms epoch-3 is stable, delete the task-state migration rollback files.**
2. Delete the superseded node-migration runs, retained project migration backups, and extracted legacy `task-state-rollback` trees.
3. Record the exact deleted roots plus disk usage before and after cleanup.
4. Do not change the epoch-3 runtime, migration implementation, active task state, migration reports, or task content.

---

## E. Why This Is the Simplest Correct Solution

1. **The migration is complete and these artifacts are not receiving new writes.** Cleanup addresses the actual disk pollution directly.
2. A new backup architecture adds implementation, recovery semantics, tests, and operational policy for a migration path that has already served its purpose.
3. Changing future backup behavior would not reclaim the existing **14.48 GB**.
4. Operator-confirmed stability provides the deletion gate while avoiding permanent retention machinery for one-time cutover evidence.

---

## F. Acceptance Criteria

1. The operator has explicitly confirmed epoch-3 stability and authorized cleanup execution.
2. Every deletion target is inventoried by absolute path and verified outside active `task-state/<projectId>` storage.
3. The rollback roots are deleted without changing active task state, migration reports, task cards, task threads, settings, uploads, runs, or caches outside those roots.
4. The cleanup report records total files and bytes removed plus remaining rollback roots.
5. Decision OS health and canonical project routes remain available after cleanup.
