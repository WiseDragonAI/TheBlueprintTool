import type { ProjectSyncRole } from './project-sync-types.js';
import { readRepositorySyncStatus, type RepositorySyncStatus } from './repository-sync-status.js';
import { execFileSync } from 'node:child_process';

export function verifyProjectSyncPhase(input: {
  projectRoot: string;
  role: ProjectSyncRole;
  requiredSha?: string;
  result: Record<string, unknown>;
}): RepositorySyncStatus {
  const snapshot = readRepositorySyncStatus(input.projectRoot);
  const claimedHead = String(input.result.headSha ?? '');
  const claimedOrigin = String(input.result.originSha ?? '');
  if (!claimedHead || claimedHead !== snapshot.headSha) throw new Error('Codex HEAD claim does not match the fixed-command snapshot.');
  if (!claimedOrigin || claimedOrigin !== snapshot.originSha) throw new Error('Codex origin claim does not match the fixed-command snapshot.');
  if (snapshot.headSha !== snapshot.originSha) throw new Error('Repository HEAD does not equal its tracked origin SHA.');
  if (snapshot.porcelain) throw new Error('Repository porcelain is not clean after Codex execution.');
  if (snapshot.worktrees.some((worktree) => !worktree.clean)) throw new Error('A retained worktree is dirty after Codex execution.');
  if (input.requiredSha && input.role !== 'source-publisher') {
    const required = String(input.result.requiredSha ?? '');
    if (required !== input.requiredSha) throw new Error('Codex predecessor SHA claim does not match the required SHA.');
    try {
      execFileSync('git', ['-C', input.projectRoot, 'merge-base', '--is-ancestor', input.requiredSha, snapshot.headSha], { stdio: 'ignore', timeout: 30_000 });
    } catch {
      throw new Error('Required predecessor SHA is not an ancestor of the verified repository HEAD.');
    }
  }
  return snapshot;
}
