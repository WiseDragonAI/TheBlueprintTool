import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation, type LedgerMutation } from '../../../src/business/ledger/helper/apply-ledger-mutation.js';
import { createProjectTaskState } from '../../../src/business/task-state/helper/project-task-state.js';
import { createDurableReplicationOutbox } from '../../../src/business/federation/helper/durable-replication-outbox.js';
import { createTaskFieldEvent } from '../../../src/business/task-state/helper/task-event-codec.js';
import type { TaskFieldEvent } from '../../../src/business/task-state/helper/task-event-types.js';

test('task intake stays held until the first durable thread contribution releases one shared outbox', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-task-state-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(root, { recursive: true });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} }));
  const published: TaskFieldEvent[] = [];
  const content: string[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'node-a',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    publish: (event) => { published.push(event); },
    publishContent: (resource) => { content.push(resource); },
  });

  const execute = async (mutation: LedgerMutation) => {
    const before = structuredClone(state.projection().ledger);
    const after = structuredClone(before);
    const result = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
    assert.equal(result.ok, true);
    return state.executeMutation(mutation, before, after);
  };

  await execute({
    action: 'create-task-intake',
    annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' },
    card: { id: 'card-a', title: 'Local task', status: 'todo', labels: ['master-task'], domainId: 'tasks', comment: { what: 'Task' } },
  });
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  assert.equal(published.length, 0);
  assert.ok(state.outbox.entries().every((entry) => entry.state === 'held'));
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>)[0].replicationState, 'local-only');

  const noteResult = await execute({ action: 'append-note', note: { id: 'note-a', threadId: 'thread-card-a', body: 'Activate it.' } });
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  assert.equal(noteResult.events.length, 1, 'content changes append only the activation event');
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>)[0].replicationState, 'activated');
  assert.ok(published.length >= 3, 'held intake events and activation are released together');
  assert.deepEqual(content, ['.decision-os/cards/tasks/card-a.md', '.decision-os/threads/tasks/thread-card-a.md']);
  assert.deepEqual(state.outbox.status(), { held: 0, pending: 0, taskState: 0, content: 0 });
});

test('outbox recovery replays durability-journaled events before publication after restart', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-task-recovery-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [] }));
  const event = createTaskFieldEvent({
    eventId: 'recovered-event', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T00:00:00.000Z', revision: 1,
    entityType: 'card', entityId: 'card-recovered', changes: [{ path: 'status', operation: 'set', value: 'todo' }],
  });
  createDurableReplicationOutbox({ decisionOsRoot: root }).enqueue([{
    id: `task:${event.eventId}`, lane: 'task-state', resourceId: 'card:card-recovered', activationTaskId: 'card-recovered', state: 'pending', payload: event,
  }]);
  const published: TaskFieldEvent[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a', writerId: 'node-a', decisionOsRoot: root, tasksLedgerFile: ledgerPath,
    publish: (value) => { published.push(value); },
  });
  await state.drainOutbox();
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>)[0].id, 'card-recovered');
  assert.deepEqual(published.map((value) => value.eventId), ['recovered-event']);
  assert.equal(state.outbox.entries().length, 0);
});

test('internal projection commands persist only their declared resources', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-task-command-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({
    modelName: 'tasks', annotations: [], relationships: [],
    cards: [{ id: 'card-a', status: 'todo' }, { id: 'card-b', status: 'todo' }],
  }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'node-a', decisionOsRoot: root, tasksLedgerFile: ledgerPath });
  const changed = structuredClone(state.projection().ledger);
  const cards = changed.cards as Array<Record<string, unknown>>;
  cards[0].status = 'done';
  cards[1].status = 'done';
  state.executeProjectionCommandNow({ kind: 'settle-one-card', cardIds: ['card-a'] }, changed);
  const projected = state.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.equal(projected.find((card) => card.id === 'card-a')?.status, 'done');
  assert.equal(projected.find((card) => card.id === 'card-b')?.status, 'todo');
});
