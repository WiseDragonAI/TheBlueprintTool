/**
 * WHAT: Verifies command-scoped persistence, held activation, and immediate delta publication.
 * WHY: The application command boundary must remain intact while persistence stays lane-scoped.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation, type LedgerMutation } from '../../../src/business/ledger/helper/apply-ledger-mutation.js';
import { createProjectTaskState } from '../../../src/business/task-state/helper/project-task-state.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { taskCommandForMutation } from '../../../src/business/task-state/helper/task-mutation-command.js';
import type { TaskStateDelta } from '../../../src/business/task-state/helper/task-current-state-types.js';

test('configured writer remains read-only until project bootstrap converges', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-write-gate-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ cards: [{ id: 'card-a', title: 'Task', status: 'todo' }], annotations: [], relationships: [] }));
  let writable = false;
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true, canWrite: () => writable });

  assert.throws(() => state.transitionCardLifecycle('card-a', 'done'), /task_state_bootstrap_incomplete/);
  writable = true;
  assert.equal((await state.transitionCardLifecycle('card-a', 'done')).changed, true);
});

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
  await execute({ action: 'append-note', note: { id: 'note-a', threadId: 'thread-card-a', body: 'Activate it.', role: 'agent' } });
  assert.ok(published.flatMap((delta) => delta.entities).some((entity) => entity.entityType === 'card' && entity.entityId === 'card-a'));
  assert.ok(published.flatMap((delta) => delta.entities).some((entity) => entity.entityType === 'thread-note' && entity.entityId === 'thread-card-a/note-a'));
  assert.deepEqual(content, []);
  assert.equal(((state.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0]).message, undefined);
  assert.equal(((state.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0]).role, 'agent');
  assert.match(readFileSync(resolve(root, 'threads', 'tasks', 'thread-card-a.md'), 'utf8'), /Activate it\./);
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>)[0].replicationState, undefined);
  assert.equal(state.store.entity('card', 'card-a')?.fields.replicationState, undefined);
});

test('unchanged content bytes do not create a second resource mutation when file metadata changes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-content-dedupe-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  const contentFile = resolve(root, 'cards', 'tasks', 'card-a.md');
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({ cards: [{ id: 'card-a', title: 'Task', status: 'todo' }], annotations: [], relationships: [] }));
  writeFileSync(contentFile, '# Same bytes\n');
  const published: TaskStateDelta[] = [];
  const publishedContent: string[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true,
    publish: (delta) => { published.push(delta); }, publishContent: (resource) => { publishedContent.push(resource); },
  });

  await state.recordContentContribution('card-a', '.decision-os/cards/tasks/card-a.md');
  utimesSync(contentFile, new Date('2026-07-22T01:00:00.000Z'), new Date('2026-07-22T01:00:00.000Z'));
  await state.recordContentContribution('card-a', '.decision-os/cards/tasks/card-a.md');

  assert.equal(state.store.contentHeads('.decision-os/cards/tasks/card-a.md').length, 1);
  assert.equal(publishedContent.length, 1);
  assert.equal(published.flatMap((delta) => delta.entities).filter((entity) => entity.entityType === 'resource').length, 1);
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

test('lifecycle conflicts block completion and execution until a scoped lifecycle resolution', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-conflict-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-conflict-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const ledger = {
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'] }],
    annotations: [], relationships: [],
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const remote = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: ledger });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  await state.transitionCardLifecycle('master', 'backlog');
  const remoteDone = await remote.mutate({
    replicaId: 'phone',
    changes: [{ entityType: 'card', entityId: 'master', changes: [{ path: 'lifecycle', operation: 'set', value: { status: 'done', changedAt: '2026-07-21T03:00:00.000Z', waitingAt: null, closedAt: '2026-07-21T03:00:00.000Z' } }] }],
  });
  await state.store.merge(remoteDone.delta);
  assert.equal(state.projection().conflicts[0]?.kind, 'task-conflict');

  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation: { action: 'complete-master-task', masterTaskId: 'master' } }).ok, true);
  await assert.rejects(state.executeMutation({ action: 'complete-master-task', masterTaskId: 'master' }, before, after), /task_lifecycle_conflict:master/);
  await assert.rejects(state.transitionExecutionIntent('master', { id: 'intent-a', state: 'waiting' }), /task_lifecycle_conflict:master/);

  await state.transitionCardLifecycle('master', 'todo');
  assert.equal(state.projection().conflicts.length, 0);
  const execution = await state.transitionExecutionIntent('master', { id: 'intent-a', state: 'waiting' });
  assert.deepEqual(execution.entities.map((entity) => [entity.entityType, entity.entityId]), [['card', 'master']]);
});

test('master completion emits one lifecycle lane per positioned graph member', () => {
  const before = {
    cards: [
      { id: 'master', status: 'todo', labels: ['master-task'] },
      { id: 'child-a', status: 'todo', title: 'A' },
      { id: 'child-b', status: 'todo', title: 'B' },
    ],
    relationships: [
      { id: 'rel-b', from: 'master', to: 'child-b', label: 'subtask', position: 1 },
      { id: 'rel-a', from: 'master', to: 'child-a', label: 'subtask', position: 0 },
    ],
  };
  const after = structuredClone(before);
  for (const card of after.cards) card.status = 'done';

  const command = taskCommandForMutation({ mutation: { action: 'complete-master-task', masterTaskId: 'master' }, before, after });

  assert.deepEqual(command.changes.map((change) => change.entityId), ['master', 'child-a', 'child-b']);
  assert.ok(command.changes.every((change) => change.changes.length === 1 && change.changes[0].path === 'lifecycle'));
});

test('task commands reject changes to immutable card creation time', () => {
  const before = { cards: [{ id: 'card-a', status: 'todo', createdAt: '2026-07-21T01:00:00.000Z' }] };
  const after = { cards: [{ id: 'card-a', status: 'todo', createdAt: '2026-07-21T02:00:00.000Z' }] };
  assert.throws(() => taskCommandForMutation({ mutation: { action: 'patch-card', cardPatch: { id: 'card-a', title: 'A' } }, before, after }), /immutable_card_created_at/);
});
