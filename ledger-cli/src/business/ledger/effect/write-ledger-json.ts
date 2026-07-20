/**
 * WHAT: Committed ledger JSON writer.
 * WHY: controlled ledger mutations must be persisted back to ledger files.
 */
import type { FileSystemPort } from '../../../lib/types.js';
import { stringifyJson } from '../../../lib/json/json.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { basename } from 'node:path';

export async function writeLedgerJson(path: string, ledger: unknown, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  if (fs === nodeFileSystem && basename(path) === 'tasks.json') {
    const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').replace(/\/$/, '');
    const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
    if (!serverUrl || !projectId) throw new Error('Task mutations require the running Decision OS worker (`DECISION_OS_SERVER_URL` and `DECISION_OS_PROJECT_ID`).');
    const response = await fetch(`${serverUrl}/api/task-state/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, ledger }),
    });
    if (!response.ok) throw new Error(`Decision OS task-state commit failed (${response.status}): ${await response.text()}`);
    return;
  }
  await fs.writeFile(path, stringifyJson(ledger));
}
