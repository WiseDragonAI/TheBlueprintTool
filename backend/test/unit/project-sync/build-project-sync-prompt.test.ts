import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectSyncPrompt } from '../../../src/business/project-sync/helper/build-project-sync-prompt.js';

const snapshot = {
  originFingerprint: 'f'.repeat(64), originUrl: 'https://example.test/repo', branch: 'main', upstream: 'origin/main',
  headSha: 'a'.repeat(40), originSha: 'a'.repeat(40), ahead: 0, behind: 0, porcelain: '', ignoredPaths: [], worktrees: [], operationInProgress: false,
};

test('builds canonical source-first and reconciler prompts with no-loss rules', () => {
  const source = buildProjectSyncPrompt({ syncId: 'sync-1', nodeId: 'node-b', initiatorNodeId: 'node-a', role: 'source-publisher', snapshot });
  assert.match(source, /only first writer/);
  assert.match(source, /Never force push, destructively reset, discard with checkout, delete untracked content/);
  assert.match(source, /Return one JSON object/);
  const reconcile = buildProjectSyncPrompt({
    syncId: 'sync-1', nodeId: 'node-a', initiatorNodeId: 'node-a', role: 'initiator-reconciler', requiredSha: 'b'.repeat(40), snapshot,
  });
  assert.match(reconcile, new RegExp(`Prove predecessor SHA ${'b'.repeat(40)}`));
  assert.match(reconcile, /integrate it, then commit and push/);
});
