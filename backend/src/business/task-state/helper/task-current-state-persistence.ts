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
  const atomicWrite = async (file: string, bytes: string): Promise<void> => {
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
    const descriptor = await open(temporary, 'wx');
    try {
      try { await descriptor.writeFile(bytes); await descriptor.sync(); }
      finally { await descriptor.close(); }
      await rename(temporary, file);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    const directory = await open(dirname(file), 'r');
    try { await directory.sync(); }
    finally { await directory.close(); }
  };
  return { entityPath, atomicWrite, atomicWriteSync };
}
