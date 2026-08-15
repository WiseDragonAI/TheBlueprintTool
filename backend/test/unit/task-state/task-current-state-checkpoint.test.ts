/**
 * WHAT: Verifies the task-state JSON checkpoint warm path and canonical fallback.
 * WHY: Startup optimization must remove shard reconstruction without weakening durable recovery.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';

const lifecycle = { status: 'todo', changedAt: '2026-08-01T00:00:00.000Z', waitingAt: '2026-08-01T00:00:00.000Z', closedAt: null };

async function populatedStore(root: string) {
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle }] }],
  });
  await store.flush();
  return store;
}

test('warm restart restores one checkpoint without reading or rematerializing shards', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-warm-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const first = await populatedStore(root);
  const checkpoint = resolve(root, 'task-state', 'project-a', 'cache', 'checkpoint.json');
  assert.equal(existsSync(checkpoint), true);

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.deepEqual(restarted.projection(), first.projection());
  assert.deepEqual(restarted.clock(), first.clock());
  assert.deepEqual(restarted.bucketManifest(), first.bucketManifest());
  assert.equal(restarted.projectedEntity('card', 'card-a')?.status, 'todo');
  assert.deepEqual(restarted.diagnostics().checkpoint, {
    status: 'warm', error: '', reads: 1, shardReads: 0, markerReads: 0, projectionMaterializations: 0,
  });
});

test('newer journal witness rejects an older checkpoint and replays canonical state', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-journal-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const first = await populatedStore(root);
  const stateRoot = resolve(root, 'task-state', 'project-a');
  const entity = first.entity('card', 'card-a')!;
  writeFileSync(resolve(stateRoot, 'journal', 'retained.json'), `${JSON.stringify({ version: 4, delta: { version: 4, projectId: 'project-a', entities: [entity] } })}\n`);

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal(restarted.diagnostics().checkpoint.status, 'invalid');
  assert.ok(restarted.diagnostics().checkpoint.shardReads > 0);
  assert.equal(restarted.projectedEntity('card', 'card-a')?.status, 'todo');
});

test('invalid checkpoint bytes remain unchanged while canonical shards stay available', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-invalid-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  await populatedStore(root);
  const checkpoint = resolve(root, 'task-state', 'project-a', 'cache', 'checkpoint.json');
  const invalid = '{"payload":{"version":1},"checksum":"bad"}\n';
  writeFileSync(checkpoint, invalid);

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal(restarted.projectedEntity('card', 'card-a')?.status, 'todo');
  assert.equal(restarted.diagnostics().checkpoint.status, 'invalid');
  assert.equal(readFileSync(checkpoint, 'utf8'), invalid);
  await restarted.flush();
  assert.equal(readFileSync(checkpoint, 'utf8'), invalid);
});
