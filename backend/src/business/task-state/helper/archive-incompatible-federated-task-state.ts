/**
 * WHAT: Fingerprints and archives one incompatible derived federation task-state root.
 * WHY: Derived state can be rebuilt from the relay, while the rejected bytes must remain exact and inspectable.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

function fingerprintDirectory(root: string): string {
  const hash = createHash('sha256');
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const file = resolve(directory, entry.name);
      const path = relative(root, file);
      hash.update(`${entry.isDirectory() ? 'd' : 'f'}\0${path}\0`);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      const metadata = statSync(file);
      hash.update(`${metadata.mode & 0o777}\0${metadata.size}\0`);
      hash.update(readFileSync(file));
    }
  };
  visit(root);
  return hash.digest('hex');
}

export async function archiveIncompatibleFederatedTaskState(input: {
  replicaDecisionOsRoot: string;
  projectId: string;
}): Promise<{ fingerprint: string; archiveRoot: string; activeRoot: string }> {
  if (!/^[a-zA-Z0-9_-]+$/.test(input.projectId)) throw new Error('invalid_federated_task_state_project_id');
  const activeRoot = resolve(input.replicaDecisionOsRoot, 'task-state', input.projectId);
  if (!existsSync(activeRoot)) throw new Error(`federated_task_state_cache_missing:${input.projectId}`);
  const fingerprint = fingerprintDirectory(activeRoot);
  const archiveRoot = resolve(input.replicaDecisionOsRoot, 'task-state-recovery', input.projectId, fingerprint);
  if (existsSync(archiveRoot)) throw new Error(`federated_task_state_cache_already_archived:${fingerprint}`);
  await mkdir(dirname(archiveRoot), { recursive: true });
  await rename(activeRoot, archiveRoot);
  return { fingerprint, archiveRoot, activeRoot };
}
