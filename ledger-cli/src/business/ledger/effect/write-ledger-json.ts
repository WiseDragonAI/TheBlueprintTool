/**
 * WHAT: Committed ledger JSON writer.
 * WHY: controlled ledger mutations must be persisted back to ledger files.
 */
import type { FileSystemPort } from '../../../lib/types.js';
import { stringifyJson } from '../../../lib/json/json.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { isWorkerOwnedTaskLedger } from '../helper/is-worker-owned-task-ledger.js';

export async function writeLedgerJson(path: string, ledger: unknown, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  if (isWorkerOwnedTaskLedger(path, fs)) {
    throw new Error('aggregate_task_state_commit_removed');
  }
  await fs.writeFile(path, stringifyJson(ledger));
}
