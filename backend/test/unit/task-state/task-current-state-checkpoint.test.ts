/**
 * WHAT: Verifies the task-state JSON checkpoint warm path and canonical fallback.
 * WHY: Startup optimization must remove shard reconstruction without weakening durable recovery.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { taskStateCheckpointWitness } from '../../../src/business/task-state/helper/task-current-state-checkpoint.js';
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
  const receipt = await restarted.prepareRestartReceipt();
  assert.equal(receipt.persistent, false);
  assert.equal(readFileSync(checkpoint, 'utf8'), invalid);
});

test('invalid generation bytes remain unchanged and cannot authorize worker handoff', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-invalid-generation-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  await populatedStore(root);
  const generationFile = resolve(root, 'task-state', 'project-a', 'generation.json');
  const invalid = '{invalid-generation';
  writeFileSync(generationFile, invalid);

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal(restarted.projectedEntity('card', 'card-a')?.status, 'todo');
  await assert.rejects(() => restarted.prepareRestartReceipt());
  assert.equal(readFileSync(generationFile, 'utf8'), invalid);
});

test('worker receipt installs without reopening checkpoint or canonical shards', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-receipt-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const first = await populatedStore(root);
  const receipt = await first.prepareRestartReceipt();
  const checkpoint = resolve(root, 'task-state', 'project-a', 'cache', 'checkpoint.json');
  const invalid = '{invalid-checkpoint';
  writeFileSync(checkpoint, invalid);

  const installed = createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    bootstrapReceipt: receipt,
  });
  assert.equal(installed.projectedEntity('card', 'card-a')?.status, 'todo');
  assert.deepEqual(installed.diagnostics().checkpoint, {
    status: 'warm', error: '', reads: 0, shardReads: 0, markerReads: 0, projectionMaterializations: 0,
  });
  assert.equal(readFileSync(checkpoint, 'utf8'), invalid);
});

test('advanced generation rejects a stale worker receipt before installation', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-stale-receipt-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const first = await populatedStore(root);
  const receipt = await first.prepareRestartReceipt();
  writeFileSync(resolve(root, 'task-state', 'project-a', 'generation.json'), `${JSON.stringify({
    version: 1,
    projectId: 'project-a',
    generation: '00000000-0000-4000-8000-000000000000',
  })}\n`);

  assert.throws(() => createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    bootstrapReceipt: receipt,
  }), /stale_task_state_bootstrap_receipt/);
});

test('first mutation advances the receipt generation before durable journal authority', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-mutation-generation-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const first = await populatedStore(root);
  const receipt = await first.prepareRestartReceipt();
  const installed = createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    bootstrapReceipt: receipt,
  });
  await installed.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'card', entityId: 'card-b', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle }] }],
  });

  assert.throws(() => createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    bootstrapReceipt: receipt,
  }), /stale_task_state_bootstrap_receipt/);
  await installed.flush();
});

test('one legacy witness admission upgrades the checkpoint to generation version 2', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-legacy-upgrade-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  await populatedStore(root);
  const stateRoot = resolve(root, 'task-state', 'project-a');
  const checkpoint = resolve(stateRoot, 'cache', 'checkpoint.json');
  const document = JSON.parse(readFileSync(checkpoint, 'utf8')) as { payload: Record<string, unknown> };
  const { generation: _generation, ...state } = document.payload;
  const payload = {
    ...state,
    version: 1,
    witness: taskStateCheckpointWitness({
      current: resolve(stateRoot, 'current'),
      held: resolve(stateRoot, 'local', 'held'),
      journal: resolve(stateRoot, 'journal'),
    }),
  };
  const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  writeFileSync(checkpoint, `${JSON.stringify({ payload, checksum })}\n`);
  rmSync(resolve(stateRoot, 'generation.json'), { force: true });

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal(restarted.diagnostics().checkpoint.status, 'warm');
  assert.equal(restarted.diagnostics().checkpoint.shardReads, 0);
  const receipt = await restarted.prepareRestartReceipt();
  assert.equal(receipt.payload.version, 2);
  assert.equal(receipt.persistent, true);
  assert.equal((JSON.parse(readFileSync(checkpoint, 'utf8')) as { payload: { version: number } }).payload.version, 2);
});
