/**
 * WHAT: Computes the complete epoch-4 node migration inventory without writing state.
 * WHY: Operators need exact project, backup-byte, and referenced-media evidence before quiescence.
 */
import { resolve } from 'node:path';
import { planNodeTaskCurrentStateMigration } from '../business/task-state/controller/migrate-node-task-current-state.js';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] ?? '') : '';
}

const catalogRoot = argument('--catalog-root');
const nodeId = argument('--node-id');
const targetEpoch = Number(argument('--target-epoch'));
const defaultAssignedNodeId = argument('--default-assigned-node');
if (!catalogRoot || !nodeId || !Number.isSafeInteger(targetEpoch) || !defaultAssignedNodeId) {
  throw new Error('Usage: plan-node-task-current-state-migration --catalog-root <path> --node-id <id> --target-epoch 4 --default-assigned-node <id>');
}

const result = await planNodeTaskCurrentStateMigration({
  catalogRoot: resolve(catalogRoot),
  nodeId,
  targetEpoch,
  defaultAssignedNodeId,
});
process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
