/**
 * WHAT: Proves causal current-state convergence and explicit same-field conflicts.
 * WHY: Scalar revisions previously suppressed valid concurrent offline writes.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';

function store(prefix: string, projectId = 'project-a') {
  const root = mkdtempSync(resolve(tmpdir(), prefix));
  return { root, value: createTaskCurrentStateStore({ decisionOsRoot: root, projectId, initializeLedger: {} }) };
}

function lifecycle(status: 'todo' | 'backlog' | 'done', timestamp = '2026-07-21T00:00:00.000Z') {
  return { status, changedAt: timestamp, waitingAt: status === 'todo' ? timestamp : null, closedAt: status === 'done' ? timestamp : null };
}

test('independent offline fields converge without comparing unrelated counters', async (context) => {
  const a = store('decision-os-current-a-');
  const b = store('decision-os-current-b-');
  context.after(async () => { await Promise.all([a.value.flush(), b.value.flush()]); rmSync(a.root, { recursive: true, force: true }); rmSync(b.root, { recursive: true, force: true }); });
  for (let counter = 0; counter < 12; counter += 1) {
    await a.value.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: `unrelated-${counter}`, changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('todo') }] }] });
  }
  const title = await a.value.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'title', operation: 'set', value: 'Desktop' }] }] });
  const status = await b.value.mutate({ replicaId: 'mobile', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('done') }] }] });
  await Promise.all([a.value.merge(status.delta), b.value.merge(title.delta)]);
  const cardA = (a.value.projection().ledger.cards as Array<Record<string, unknown>>).find((card) => card.id === 'shared');
  const cardB = (b.value.projection().ledger.cards as Array<Record<string, unknown>>).find((card) => card.id === 'shared');
  assert.deepEqual(cardA, cardB);
  assert.equal(cardA?.title, 'Desktop');
  assert.equal(cardA?.status, 'done');
});

test('concurrent same-field values remain bounded until an observed edit resolves them', async (context) => {
  const a = store('decision-os-conflict-a-');
  const b = store('decision-os-conflict-b-');
  context.after(async () => { await Promise.all([a.value.flush(), b.value.flush()]); rmSync(a.root, { recursive: true, force: true }); rmSync(b.root, { recursive: true, force: true }); });
  const left = await a.value.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('todo') }] }] });
  const right = await b.value.mutate({ replicaId: 'mobile', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('done') }] }] });
  await Promise.all([a.value.merge(right.delta), b.value.merge(left.delta)]);
  assert.equal(a.value.projection().conflicts.length, 1);
  assert.equal(b.value.projection().conflicts.length, 1);
  const resolution = await a.value.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('backlog', '2026-07-21T01:00:00.000Z') }] }] });
  await b.value.merge(resolution.delta);
  assert.equal(a.value.projection().conflicts.length, 0);
  assert.equal(b.value.projection().conflicts.length, 0);
  assert.equal((b.value.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'backlog');
});

test('identical concurrent writes retain both causal origins for a later one-sided edit', async (context) => {
  const a = store('decision-os-identical-a-');
  const b = store('decision-os-identical-b-');
  context.after(async () => { await Promise.all([a.value.flush(), b.value.flush()]); rmSync(a.root, { recursive: true, force: true }); rmSync(b.root, { recursive: true, force: true }); });
  const left = await a.value.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('todo') }] }] });
  const right = await b.value.mutate({ replicaId: 'mobile', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('todo') }] }] });
  await a.value.merge(right.delta);
  assert.equal(a.value.projection().conflicts.length, 0);
  const oneSided = await b.value.mutate({ replicaId: 'mobile', changes: [{ entityType: 'card', entityId: 'shared', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('done') }] }] });
  await a.value.merge(oneSided.delta);
  assert.equal(a.value.projection().conflicts.length, 1);
  assert.deepEqual(a.value.projection().conflicts[0].candidates.map((candidate) => (candidate.value as Record<string, unknown>).status).sort(), ['done', 'todo']);
});
