/**
 * WHAT: Exposes one offline migration command for every registered project on the current node.
 * WHY: Operators need the same filesystem-only cutover on Linux and Termux.
 */
import { resolve } from 'node:path';
import { migrateNodeTaskCurrentState } from '../business/task-state/helper/migrate-node-task-current-state.js';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] ?? '') : '';
}

const catalogRoot = argument('--catalog-root');
const nodeId = argument('--node-id');
const backupRoot = argument('--backup-root');
if (!catalogRoot || !nodeId) throw new Error('Usage: decision-os-migrate-node --catalog-root <path> --node-id <id> [--backup-root <path>]');

const result = await migrateNodeTaskCurrentState({ catalogRoot: resolve(catalogRoot), nodeId, ...(backupRoot ? { backupRoot: resolve(backupRoot) } : {}) });
process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
