import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createTaskFieldEvent } from '../../../src/business/task-state/helper/task-event-codec.js';
import { createTaskEventStore } from '../../../src/business/task-state/helper/task-event-store.js';

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-task-events-'));
  const compatibilityLedgerFile = resolve(root, 'tasks.json');
  const store = createTaskEventStore({ decisionOsRoot: root, projectId: 'project-a', compatibilityLedgerFile, snapshotTailMaximum: 2 });
  return { root, compatibilityLedgerFile, store };
}

function event(id: string, emittedAt: string, value: string) {
  return createTaskFieldEvent({ eventId: id, projectId: 'project-a', writerId: 'node-a', emittedAt, entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value }] });
}

test('store durably appends before exporting the generated projection', (context) => {
  const value = fixture();
  context.after(() => rmSync(value.root, { recursive: true, force: true }));
  value.store.append(event('a', '2026-07-20T01:00:00.000Z', 'todo'));
  assert.equal(value.store.events().length, 1);
  assert.equal((JSON.parse(readFileSync(value.compatibilityLedgerFile, 'utf8')).cards as Array<Record<string, unknown>>)[0].status, 'todo');
  assert.equal(value.store.snapshots().length, 0, 'request-path writes do not create snapshots');
  value.store.maintain();
  assert.equal(value.store.snapshots().length, 1);
});

test('duplicate delivery is idempotent and acknowledgements are destination-specific', (context) => {
  const value = fixture();
  context.after(() => rmSync(value.root, { recursive: true, force: true }));
  const change = event('a', '2026-07-20T01:00:00.000Z', 'todo');
  assert.equal(value.store.append(change).accepted, true);
  assert.equal(value.store.append(change).accepted, false);
  value.store.markPending('node-b', change.eventId);
  value.store.markPending('node-c', change.eventId);
  value.store.acknowledge('node-b', [change.eventId]);
  assert.equal(value.store.pendingFor('node-b').length, 0);
  assert.equal(value.store.pendingFor('node-c').length, 1);
});

test('late insertion invalidates covered snapshots and rebuilds chronologically', (context) => {
  const value = fixture();
  context.after(() => rmSync(value.root, { recursive: true, force: true }));
  value.store.append(event('a', '2026-07-20T01:00:00.000Z', 'todo'));
  value.store.append(event('c', '2026-07-20T03:00:00.000Z', 'done'));
  const before = value.store.snapshots().length;
  value.store.append(event('b', '2026-07-20T02:00:00.000Z', 'backlog'));
  assert.equal((value.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'done');
  assert.ok(value.store.snapshots().length <= before + 1);
});

test('verified snapshot bootstraps a blank store and rejects corruption', (context) => {
  const source = fixture();
  const target = fixture();
  context.after(() => { rmSync(source.root, { recursive: true, force: true }); rmSync(target.root, { recursive: true, force: true }); });
  source.store.append(event('a', '2026-07-20T01:00:00.000Z', 'todo'));
  const snapshot = source.store.createSnapshot();
  target.store.installSnapshot(snapshot);
  assert.equal((target.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
  const corrupt = structuredClone(snapshot);
  corrupt.projection.ledger = { cards: [] };
  assert.throws(() => target.store.installSnapshot(corrupt), /checksum/);
  assert.equal(existsSync(target.compatibilityLedgerFile), true);
});

test('large histories restore from a snapshot and apply only the uncovered tail', (context) => {
  const source = fixture();
  const target = fixture();
  context.after(() => { rmSync(source.root, { recursive: true, force: true }); rmSync(target.root, { recursive: true, force: true }); });
  const history = Array.from({ length: 5_000 }, (_, index) => event(
    `history-${index}`,
    new Date(Date.UTC(2025, 0, 1, 0, 0, index)).toISOString(),
    `state-${index}`,
  ));
  source.store.appendBatch(history);
  const snapshot = source.store.createSnapshot();
  target.store.installSnapshot(snapshot);
  assert.equal(target.store.events().length, 0);
  assert.equal(target.store.projection().appliedEventIds.length, 5_000);
  target.store.append(event('tail', '2026-07-20T04:00:00.000Z', 'done'));
  assert.equal(target.store.events().length, 1);
  assert.equal((target.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'done');
});

test('restart restores causal projection and bounded maintenance retains two checkpoints', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-task-restart-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let clock = Date.parse('2026-07-20T00:00:00.000Z');
  const options = {
    decisionOsRoot: root, projectId: 'project-a', snapshotTailMaximum: 1, snapshotRetainMaximum: 2,
    now: () => new Date(clock += 1_000),
  };
  const first = createTaskEventStore(options);
  for (let index = 1; index <= 3; index += 1) {
    first.append(createTaskFieldEvent({
      eventId: `causal-${index}`, projectId: 'project-a', writerId: 'node-a', emittedAt: new Date(clock).toISOString(), revision: index,
      entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: `state-${index}` }],
    }));
    first.maintain();
  }
  assert.equal(first.snapshots().length, 2);
  writeFileSync(first.projectionFile, JSON.stringify({
    ...first.projection(), reducerVersion: 1, ledger: { cards: [{ id: 'card-a', status: 'stale-reducer' }], annotations: [], relationships: [] },
  }));
  const restarted = createTaskEventStore(options);
  assert.equal((restarted.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'state-3');
  assert.equal(restarted.projection().lastRevision, 3);
  const before = restarted.snapshots().length;
  restarted.maintain();
  assert.equal(restarted.snapshots().length, before, 'equivalent maintenance does not create another checkpoint');
});
