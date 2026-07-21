/**
 * WHAT: Identifies the task projection path owned by the running causal-state worker.
 * WHY: External commands must route this ledger through scoped mutations before any local write.
 */
import { basename } from 'node:path';
import type { FileSystemPort } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export function isWorkerOwnedTaskLedger(path: string, fs: FileSystemPort = nodeFileSystem): boolean {
  return fs === nodeFileSystem && basename(path) === 'tasks.json';
}
