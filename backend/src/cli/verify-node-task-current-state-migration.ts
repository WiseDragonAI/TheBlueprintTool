/**
 * WHAT: Independently verifies one completed node migration transaction.
 * WHY: A migration-generated success report must not verify itself.
 */
import { resolve } from 'node:path';
import { verifyTaskCurrentStateMigrationTransaction } from '../business/task-state/helper/task-current-state-migration-transaction.js';

const index = process.argv.indexOf('--backup-root');
const backupRoot = index >= 0 ? String(process.argv[index + 1] ?? '') : '';
if (!backupRoot) throw new Error('Usage: verify-node-task-current-state-migration --backup-root <path>');

const result = await verifyTaskCurrentStateMigrationTransaction(resolve(backupRoot));
process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
