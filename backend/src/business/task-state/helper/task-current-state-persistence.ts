/**
 * WHAT: Provides crash-safe atomic current-shard writes for one task-state root.
 * WHY: Filesystem durability is separate from causal joining and projection materialization.
 */
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TaskCurrentEntity } from './task-current-state-types.js';

export function createTaskCurrentStatePersistence(root: string) {
  type AppendEntry = { handle: Awaited<ReturnType<typeof open>>; tail: Promise<void>; created: boolean; openMs: number };
  const appendHandles = new Map<string, Promise<AppendEntry>>();
  const entityPath = (entity: Pick<TaskCurrentEntity, 'entityType' | 'entityId'>): string => resolve(root, 'current', entity.entityType, `${encodeURIComponent(entity.entityId)}.json`);
  const atomicWriteSync = (file: string, bytes: string): void => {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
    const descriptor = openSync(temporary, 'wx');
    try {
      try { writeSync(descriptor, bytes); fsyncSync(descriptor); }
      finally { closeSync(descriptor); }
      renameSync(temporary, file);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
    const directory = openSync(dirname(file), 'r');
    try { fsyncSync(directory); }
    finally { closeSync(directory); }
  };
  const atomicWrite = async (file: string, bytes: string | Uint8Array) => {
    const timing = { mkdirMs: 0, openWriteMs: 0, fileSyncMs: 0, renameMs: 0, directorySyncMs: 0 };
    let startedAt = performance.now();
    await mkdir(dirname(file), { recursive: true });
    timing.mkdirMs = performance.now() - startedAt;
    const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
    startedAt = performance.now();
    const descriptor = await open(temporary, 'wx');
    try {
      try {
        await descriptor.writeFile(bytes);
        timing.openWriteMs = performance.now() - startedAt;
        startedAt = performance.now();
        await descriptor.sync();
        timing.fileSyncMs = performance.now() - startedAt;
      }
      finally { await descriptor.close(); }
      startedAt = performance.now();
      await rename(temporary, file);
      timing.renameMs = performance.now() - startedAt;
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    startedAt = performance.now();
    const directory = await open(dirname(file), 'r');
    try { await directory.sync(); }
    finally { await directory.close(); }
    timing.directorySyncMs = performance.now() - startedAt;
    return timing;
  };
  const closeAppend = async (file: string): Promise<number> => {
    const retained = appendHandles.get(file);
    // WHAT: Treat a non-cached path as already sealed.
    // WHY: Ordinary journals and recovered WALs share the same removal boundary.
    if (!retained) return 0;
    appendHandles.delete(file);
    const entry = await retained;
    await entry.tail;
    const startedAt = performance.now();
    await entry.handle.close();
    return performance.now() - startedAt;
  };
  const durableRemove = async (file: string): Promise<void> => {
    await closeAppend(file);
    await mkdir(dirname(file), { recursive: true });
    await rm(file, { force: true });
    const directory = await open(dirname(file), 'r');
    try { await directory.sync(); }
    finally { await directory.close(); }
  };
  const appendEntry = (file: string): Promise<AppendEntry> => {
    const retained = appendHandles.get(file);
    // WHAT: Reuse one ordered descriptor for the active WAL segment.
    // WHY: Per-frame open and close are not durability boundaries and dominated repair latency.
    if (retained) return retained;
    const created = (async () => {
      await mkdir(dirname(file), { recursive: true });
      const startedAt = performance.now();
      let handle: Awaited<ReturnType<typeof open>>;
      let isNew = false;
      try {
        handle = await open(file, 'ax');
        isNew = true;
      } catch (error) {
        // WHAT: Reopen only an already-valid active segment.
        // WHY: Exclusive creation distinguishes normal reuse from another filesystem failure.
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        handle = await open(file, 'a');
      }
      return { handle, tail: Promise.resolve(), created: isNew, openMs: performance.now() - startedAt };
    })();
    appendHandles.set(file, created);
    return created;
  };
  const appendDurable = async (file: string, bytes: string | Uint8Array) => {
    const queuedAt = performance.now();
    const entry = await appendEntry(file);
    const timing = { openMs: entry.openMs, queueWaitMs: performance.now() - queuedAt, writeMs: 0, fileSyncMs: 0, directorySyncMs: 0, closeMs: 0 };
    entry.openMs = 0;
    const operation = entry.tail.then(async () => {
      let startedAt = performance.now();
      await entry.handle.writeFile(bytes);
      timing.writeMs = performance.now() - startedAt;
      startedAt = performance.now();
      await entry.handle.sync();
      timing.fileSyncMs = performance.now() - startedAt;
      // WHAT: Persist the WAL namespace once after its first synced record.
      // WHY: The first ACK requires both record data and directory entry durability.
      if (entry.created) {
        startedAt = performance.now();
        const directory = await open(dirname(file), 'r');
        try { await directory.sync(); }
        finally { await directory.close(); }
        timing.directorySyncMs = performance.now() - startedAt;
        entry.created = false;
      }
    });
    entry.tail = operation.then(() => undefined, () => undefined);
    try {
      await operation;
      return timing;
    } catch (error) {
      appendHandles.delete(file);
      try { await entry.handle.close(); } catch { /* The original append failure retains authority. */ }
      throw error;
    }
  };
  return { entityPath, atomicWrite, atomicWriteSync, appendDurable, durableRemove };
}
