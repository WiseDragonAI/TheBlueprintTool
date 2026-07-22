import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createProjectSyncStore } from '../../../src/business/project-sync/helper/project-sync-store.js';

test('persists symmetric participants, deduplicates active origins, and restores runs', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-store-'));
  try {
    const store = createProjectSyncStore({ decisionOsRoot: root });
    const first = store.admit({
      idempotencyKey: 'request-a', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', sourceProjectName: 'Project B', sourceProjectColor: '#d94f70', originFingerprint: 'f'.repeat(64),
    });
    const duplicate = store.admit({
      idempotencyKey: 'request-b', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', sourceProjectName: 'Project B', sourceProjectColor: '#d94f70', originFingerprint: 'f'.repeat(64),
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
    assert.equal(restored?.sourceProjectColor, '#d94f70');
    assert.equal(restored?.phase, 'preflight');
    const sameRequest = createProjectSyncStore({ decisionOsRoot: root }).admit({
      idempotencyKey: 'request-a', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', sourceProjectName: 'Project B', sourceProjectColor: '#d94f70', originFingerprint: 'f'.repeat(64),
    });
    assert.equal(sameRequest.duplicate, true);
    assert.equal(sameRequest.run.syncId, first.run.syncId);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('retries failed runs and admits a fresh run after completion', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-lifecycle-'));
  try {
    const store = createProjectSyncStore({ decisionOsRoot: root });
    const input = {
      idempotencyKey: 'stable-request', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', sourceProjectName: 'Project B', sourceProjectColor: '#d94f70', originFingerprint: 'f'.repeat(64),
    };
    const first = store.admit(input).run;
    store.transition(first.syncId, 'failed', undefined, { phase: 'requested', message: 'Clone failed.' });
    const failedDuplicate = store.admit(input);
    assert.equal(failedDuplicate.duplicate, true);
    assert.equal(failedDuplicate.run.syncId, first.syncId);
    assert.equal(store.restart(first.syncId).phase, 'requested');
    store.transition(first.syncId, 'preflight');
    store.transition(first.syncId, 'source_publish');
    store.transition(first.syncId, 'initiator_reconcile');
    store.transition(first.syncId, 'source_finalize');
    store.transition(first.syncId, 'complete');
    const next = store.admit(input);
    assert.equal(next.duplicate, false);
    assert.notEqual(next.run.syncId, first.syncId);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('preserves a corrupt synchronization store and rejects mutations', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-corrupt-'));
  const file = resolve(root, 'project-sync', 'runs.json');
  const corruptBytes = '{not-json';
  try {
    mkdirSync(resolve(root, 'project-sync'), { recursive: true });
    writeFileSync(file, corruptBytes);
    const store = createProjectSyncStore({ decisionOsRoot: root });
    assert.equal(store.corruptionError?.code, 'project_sync_store_corrupt');
    assert.deepEqual(store.list(), []);
    assert.throws(() => store.admit({
      idempotencyKey: 'request-a', initiatorNodeId: 'node-a', sourceNodeId: 'node-b',
      initiatorProjectId: '', sourceProjectId: 'project-b', sourceProjectName: 'Project B', sourceProjectColor: '#d94f70', originFingerprint: 'f'.repeat(64),
    }), /Could not read the durable project synchronization store/);
    assert.equal(readFileSync(file, 'utf8'), corruptBytes);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
