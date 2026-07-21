/**
 * WHAT: Exposes the current-state cutover as an explicit offline command.
 * WHY: Migration requires operator-controlled write quiescence and must never run during server startup.
 */
import { resolve } from 'node:path';
import { migrateTaskCurrentState } from '../business/task-state/helper/task-current-state-migration.js';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] ?? '') : '';
}

const decisionOsRoot = resolve(argument('--decision-os-root'));
const projectId = argument('--project-id');
const tasksLedgerFile = resolve(argument('--tasks-ledger'));
if (!argument('--decision-os-root') || !projectId || !argument('--tasks-ledger')) {
  throw new Error('Usage: migrate-task-current-state --decision-os-root <path> --project-id <id> --tasks-ledger <path>');
}

const result = await migrateTaskCurrentState({ decisionOsRoot, projectId, tasksLedgerFile });
process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
