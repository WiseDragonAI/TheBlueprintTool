/**
 * WHAT: Verifies command-scoped persistence, held activation, and immediate delta publication.
 * WHY: The application command boundary must remain intact while persistence stays lane-scoped.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation, type LedgerMutation } from '../../../src/business/ledger/helper/apply-ledger-mutation.js';
import { createProjectTaskState } from '../../../src/business/task-state/helper/project-task-state.js';
import type { TaskStateDelta } from '../../../src/business/task-state/helper/task-current-state-types.js';

test('task intake publishes no state until its first durable content contribution activates its shards', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-current-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} }));
  const published: TaskStateDelta[] = [];
  const content: string[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true,
    publish: (delta) => { published.push(delta); }, publishContent: (resource) => { content.push(resource); },
  });
  const execute = async (mutation: LedgerMutation) => {
    const before = structuredClone(state.projection().ledger);
    const after = structuredClone(before);
    assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation }).ok, true);
    return state.executeMutation(mutation, before, after);
  };
  await execute({ action: 'create-task-intake', annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' }, card: { id: 'card-a', title: 'Local task', status: 'todo', labels: ['master-task'], domainId: 'tasks', comment: { what: 'Task' } } });
  assert.equal(published.length, 0);
  await execute({ action: 'append-note', note: { id: 'note-a', threadId: 'thread-card-a', body: 'Activate it.' } });
  assert.ok(published.flatMap((delta) => delta.entities).some((entity) => entity.entityType === 'card' && entity.entityId === 'card-a'));
  assert.ok(published.flatMap((delta) => delta.entities).some((entity) => entity.entityType === 'thread-note' && entity.entityId === 'thread-card-a/note-a'));
  assert.deepEqual(content, []);
  assert.equal(((state.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0]).message, 'Activate it.');
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>)[0].replicationState, 'activated');
});

test('projection commands modify only declared entity lanes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-scope-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ cards: [{ id: 'a', status: 'todo' }, { id: 'b', status: 'todo' }], annotations: [], relationships: [] }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const changed = structuredClone(state.projection().ledger);
  (changed.cards as Array<Record<string, unknown>>)[0].status = 'done';
  (changed.cards as Array<Record<string, unknown>>)[1].status = 'done';
  await state.executeProjectionCommand({ kind: 'one-card', cardIds: ['a'] }, changed);
  const cards = state.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.equal(cards.find((card) => card.id === 'a')?.status, 'done');
  assert.equal(cards.find((card) => card.id === 'b')?.status, 'todo');
});

test('lifecycle command changes one atomic card lane without note tombstones', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-lifecycle-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'a', title: 'A', status: 'todo' }, { id: 'b', title: 'B', status: 'todo' }],
    annotations: [], relationships: [], notes: { 'thread-a': [{ id: 'note-a', message: 'Keep me' }] },
  }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const beforeA = state.store.entity('card', 'a');
  const beforeB = state.store.entity('card', 'b');
  const beforeNote = state.store.entity('thread-note', 'thread-a/note-a');

  const result = await state.transitionCardLifecycle('a', 'done');

  assert.equal(result.deltas.length, 1);
  assert.deepEqual(result.deltas[0].entities.map((entity) => [entity.entityType, entity.entityId]), [['card', 'a']]);
  assert.notEqual(state.store.entity('card', 'a')?.stateHash, beforeA?.stateHash);
  assert.equal(state.store.entity('card', 'b')?.stateHash, beforeB?.stateHash);
  assert.equal(state.store.entity('thread-note', 'thread-a/note-a')?.stateHash, beforeNote?.stateHash);
  const lifecycle = state.store.entity('card', 'a')?.fields.lifecycle?.candidates[0]?.value as Record<string, unknown>;
  assert.equal(lifecycle.status, 'done');
  assert.equal(lifecycle.waitingAt, null);
  assert.equal(lifecycle.closedAt, lifecycle.changedAt);
  assert.match(String(lifecycle.changedAt), /^\d{4}-\d{2}-\d{2}T/);
});
