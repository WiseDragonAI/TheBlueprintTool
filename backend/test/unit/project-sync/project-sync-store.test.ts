import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectSyncStore } from '../../../src/business/project-sync/helper/project-sync-store.js';

test('persists symmetric participants, deduplicates active origins, and restores runs', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-store-'));
  try {
    const store = createProjectSyncStore({ decisionOsRoot: root });
    const first = store.admit({
      idempotencyKey: 'request-a', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', originFingerprint: 'f'.repeat(64),
    });
    const duplicate = store.admit({
      idempotencyKey: 'request-b', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', originFingerprint: 'f'.repeat(64),
    });
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.run.syncId, first.run.syncId);
    assert.equal(store.transition(first.run.syncId, 'preflight').phase, 'preflight');
    assert.throws(() => store.transition(first.run.syncId, 'complete'), /Invalid project synchronization transition/);
    assert.throws(() => store.acquireLock('f'.repeat(64), 'another-sync'), /active synchronization run/);
    const restored = createProjectSyncStore({ decisionOsRoot: root }).read(first.run.syncId);
    assert.equal(restored?.initiatorNodeId, 'node-a');
    assert.equal(restored?.sourceNodeId, 'node-b');
    assert.equal(restored?.phase, 'preflight');
    const sameRequest = createProjectSyncStore({ decisionOsRoot: root }).admit({
      idempotencyKey: 'request-a', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', originFingerprint: 'f'.repeat(64),
    });
    assert.equal(sameRequest.duplicate, true);
    assert.equal(sameRequest.run.syncId, first.run.syncId);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
