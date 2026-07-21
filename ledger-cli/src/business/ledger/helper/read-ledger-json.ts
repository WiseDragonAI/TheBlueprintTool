/**
 * WHAT: Committed ledger JSON reader.
 * WHY: ledger storage must operate on durable JSON files, not shadow state.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { parseJson } from '../../../lib/json/json.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { basename } from 'node:path';

export async function readLedgerJson(path: string, fs: FileSystemPort = nodeFileSystem): Promise<Result<unknown>> {
  try {
    if (fs === nodeFileSystem && basename(path) === 'tasks.json') {
      const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
      const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
      if (!serverUrl || !projectId) throw new Error('Task reads require the running Decision OS worker (`DECISION_OS_SERVER_URL` and `DECISION_OS_PROJECT_ID`).');
      const response = await fetch(`${serverUrl}/api/task-state/projection?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error(`Decision OS task-state read failed (${response.status}): ${await response.text()}`);
      const body = await response.json() as { ledger?: unknown };
      if (!body.ledger || typeof body.ledger !== 'object' || Array.isArray(body.ledger)) throw new Error('Decision OS task-state response has no ledger projection.');
      return { ok: true, value: body.ledger };
    }
    const text = await fs.readFile(path);
    return parseJson(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${path}` };
  }
}
