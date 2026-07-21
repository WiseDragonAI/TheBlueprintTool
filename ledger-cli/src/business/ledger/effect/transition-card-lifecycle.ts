/**
 * WHAT: Sends one task lifecycle transition to the running project authority.
 * WHY: CLI todo/done commands must not replace the complete task projection.
 */
import { basename } from 'node:path';
import type { FileSystemPort } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function transitionCardLifecycle(
  path: string,
  cardId: string,
  lifecycleStatus: 'todo' | 'done',
  fs: FileSystemPort = nodeFileSystem,
): Promise<boolean> {
  if (fs !== nodeFileSystem || basename(path) !== 'tasks.json') return false;
  const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').replace(/\/$/, '');
  const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
  if (!serverUrl || !projectId) throw new Error('Task lifecycle transitions require the running Decision OS worker (`DECISION_OS_SERVER_URL` and `DECISION_OS_PROJECT_ID`).');
  const response = await fetch(`${serverUrl}/api/task-state/transition-card-lifecycle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId, cardId, lifecycleStatus }),
  });
  if (!response.ok) throw new Error(`Decision OS task lifecycle transition failed (${response.status}): ${await response.text()}`);
  return true;
}
