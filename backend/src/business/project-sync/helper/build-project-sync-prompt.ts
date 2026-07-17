import type { ProjectSyncRole } from './project-sync-types.js';
import type { RepositorySyncStatus } from './repository-sync-status.js';

export function buildProjectSyncPrompt(input: {
  syncId: string;
  nodeId: string;
  initiatorNodeId: string;
  role: ProjectSyncRole;
  requiredSha?: string;
  snapshot: RepositorySyncStatus;
}): string {
  const authority = input.role === 'source-publisher'
    ? 'You are the source publisher and the only first writer. Commit and push the tracked branch.'
    : input.role === 'initiator-reconciler'
      ? `You are the initiator reconciler. Prove predecessor SHA ${input.requiredSha} is available, integrate it, then commit and push.`
      : `You are the source finalizer. Align the checkout to verified origin SHA ${input.requiredSha} without creating a new authority push.`;
  return `${authority}\n\nSynchronization: ${input.syncId}\nNode: ${input.nodeId}\nInitiator: ${input.initiatorNodeId}\n\nPreserve every user-authored change. Inspect the supplied preflight snapshot and the current repository, including every worktree. Classify tracked and untracked changes. Create focused commits with repository commit hygiene. Add ignore rules only for verified generated artifacts. Stop on a dirty secondary worktree. Never force push, destructively reset, discard with checkout, delete untracked content, or remove an unverified worktree. Fetch origin, integrate upstream while retaining both sides' intent, resolve conflicts, run proportionate checks, and finish with empty porcelain status, clean retained worktrees, and HEAD equal to origin.\n\nPreflight snapshot:\n${JSON.stringify(input.snapshot, null, 2)}\n\nReturn one JSON object with status, role, nodeId, branch, requiredSha, headSha, originSha, commitsCreated, ignoredPaths, retainedWorktrees, removedWorktrees, checks, and blocker.`;
}
