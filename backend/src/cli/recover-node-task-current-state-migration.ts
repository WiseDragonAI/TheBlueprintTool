/**
 * WHAT: Rolls back one interrupted node migration from its durable journal.
 * WHY: Recovery must be an executable operation derived from recorded filesystem swaps.
 */
import { resolve } from 'node:path';
import { recoverTaskCurrentStateMigrationTransaction } from '../business/task-state/helper/task-current-state-migration-transaction.js';

const index = process.argv.indexOf('--backup-root');
const backupRoot = index >= 0 ? String(process.argv[index + 1] ?? '') : '';
if (!backupRoot) throw new Error('Usage: recover-node-task-current-state-migration --backup-root <path>');

const state = await recoverTaskCurrentStateMigrationTransaction(resolve(backupRoot));
process.stdout.write(`${JSON.stringify({ ok: true, backupRoot: resolve(backupRoot), state })}\n`);
