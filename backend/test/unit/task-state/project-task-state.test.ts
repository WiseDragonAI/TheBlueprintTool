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

type AnyRecord = Record<string, unknown>;

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

test('replicated execution repository publishes through the project task-state write boundary', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-execution-repository-'));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 } }],
    annotations: [], relationships: [],
  }));
  const published: TaskStateDelta[] = [];
  let writable = false;
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
    canWrite: () => writable,
    publish: (delta) => { published.push(delta); },
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const metadata = {
    executionId: 'execution-a', requestId: 'request-a', sessionId: 'session-a', projectId: 'project-a', ledgerId: 'tasks',
    taskId: 'master', sourceCardId: 'master', ownerCardId: 'master', kind: 'thread' as const, requestedAt: '2026-07-23T01:01:00.000Z',
    model: null, effort: null, pipelineRunId: null, pipelineStepId: null, pipelineSkillRunId: null,
    predecessorExecutionId: null, restartOfExecutionId: null,
  };

  await assert.rejects(state.executions.admit({ metadata, executorNodeId: 'workstation' }), /task_state_bootstrap_incomplete/);
  writable = true;
  await state.executions.admit({ metadata, executorNodeId: 'workstation' });

  assert.equal(state.executions.find('execution-a')?.lifecycle.phase, 'preparing');
  assert.equal(published.length, 1);
  assert.deepEqual(published[0].entities.map((entity) => [entity.entityType, entity.entityId]), [['execution', 'execution-a']]);
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
  await execute({ action: 'create-task-intake', assignedNodeId: 'workstation', annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' }, card: { id: 'card-a', title: 'Local task', status: 'todo', labels: ['master-task'], domainId: 'tasks', comment: { what: 'Task' } } });
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

test('held deletion reports local projection changes without publishing federation state', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-held-delete-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} }));
  const published: TaskStateDelta[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true,
    publish: (delta) => { published.push(delta); },
  });
  const execute = async (mutation: LedgerMutation) => {
    const before = structuredClone(state.projection().ledger);
    const after = structuredClone(before);
    assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation }).ok, true);
    return state.executeMutation(mutation, before, after);
  };

  await execute({
    action: 'create-task-intake',
    assignedNodeId: 'workstation',
    annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' },
    card: { id: 'card-a', title: 'Local task', status: 'todo', labels: ['master-task'], domainId: 'tasks', comment: { what: 'Task' } },
  });
  const deletion = await execute({ action: 'delete-card', cardId: 'card-a' });

  assert.equal(deletion.changed, true);
  assert.equal(deletion.deltas.length, 0);
  assert.ok(deletion.localChanges.some((change) => change.entityType === 'card' && change.entityId === 'card-a'));
  assert.equal(published.length, 0);
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>).some((card) => card.id === 'card-a'), false);
});

test('master-task creation persists one master assignment and leaves subtasks inherited', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-create-'));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const mutation: LedgerMutation = {
    action: 'create-master-task',
    assignedNodeId: 'phone',
    annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' },
    card: { id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], domainId: 'tasks' },
    cards: [{ id: 'child', title: 'Child', status: 'todo', labels: ['subtask'], domainId: 'tasks' }],
    relationships: [{ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
  };
  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);

  assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation }).ok, true);
  await state.executeMutation(mutation, before, after);

  const cards = state.projection().ledger.cards as AnyRecord[];
  const assignment = cards.find((card) => card.id === 'master')?.assignment as AnyRecord;
  assert.equal(assignment.nodeId, 'phone');
  assert.equal(assignment.revision, 1);
  assert.match(String(assignment.changedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(cards.find((card) => card.id === 'child')?.assignment, undefined);
  assert.equal(state.store.entity('card', 'master')?.fields.assignment?.candidates.length, 1);
  assert.equal(state.store.entity('card', 'child')?.fields.assignment, undefined);
});

test('reassignment resolves concurrent assignment candidates and advances their maximum revision', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-resolve-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-resolve-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const ledger = {
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 } }],
    annotations: [], relationships: [],
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const remote = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: ledger });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  const local = await state.store.mutate({
    replicaId: 'workstation',
    changes: [{ entityType: 'card', entityId: 'master', changes: [{ path: 'assignment', operation: 'set', value: { nodeId: 'workstation', changedAt: '2026-07-23T02:00:00.000Z', revision: 2 } }] }],
  });
  const concurrent = await remote.mutate({
    replicaId: 'phone',
    changes: [{ entityType: 'card', entityId: 'master', changes: [{ path: 'assignment', operation: 'set', value: { nodeId: 'phone', changedAt: '2026-07-23T02:00:01.000Z', revision: 3 } }] }],
  });
  assert.equal(local.delta.entities.length, 1);
  await state.store.merge(concurrent.delta);
  assert.equal(state.projection().conflicts.some((conflict) => conflict.kind === 'assignment-conflict'), true);

  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const mutation: LedgerMutation = { action: 'reassign-task', cardId: 'master', assignedNodeId: 'phone' };
  assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation }).ok, true);
  await state.executeMutation(mutation, before, after);

  const assignment = (state.projection().ledger.cards as AnyRecord[])[0].assignment as AnyRecord;
  assert.equal(assignment.nodeId, 'phone');
  assert.equal(assignment.revision, 4);
  assert.equal(state.projection().conflicts.some((conflict) => conflict.kind === 'assignment-conflict'), false);
  assert.equal(state.store.entity('card', 'master')?.fields.assignment?.candidates.length, 1);
});

test('reassignment rejects inherited subtasks and tasks with an active execution', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-fences-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const ledger = {
    cards: [
      { id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 } },
      { id: 'child', title: 'Child', status: 'todo', labels: ['subtask'] },
    ],
    annotations: [],
    relationships: [{ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });

  const inheritedLedger = structuredClone(state.projection().ledger);
  const inherited = applyLedgerMutation({
    decisionOsRoot: root,
    ledgerPath,
    ledger: inheritedLedger,
    mutation: { action: 'reassign-task', cardId: 'child', assignedNodeId: 'phone' },
  });
  assert.equal(inherited.ok, false);
  assert.equal(inherited.error?.statusCode, 409);
  assert.equal(inherited.error?.body.error, 'task_assignment_inherited');

  await state.store.mutate({
    replicaId: 'workstation',
    changes: [{
      entityType: 'execution',
      entityId: 'execution-a',
      changes: [
        { path: 'metadata', operation: 'set', value: {
          executionId: 'execution-a', requestId: 'request-a', sessionId: 'session-a', projectId: 'project-a', ledgerId: 'tasks',
          taskId: 'master', sourceCardId: 'master', ownerCardId: 'master', kind: 'thread', requestedAt: '2026-07-23T03:00:00.000Z',
          model: null, effort: null, pipelineRunId: null, pipelineStepId: null, pipelineSkillRunId: null,
          predecessorExecutionId: null, restartOfExecutionId: null,
        } },
        { path: 'lifecycle', operation: 'set', value: {
          phase: 'running', phaseSince: '2026-07-23T03:00:01.000Z', startedAt: '2026-07-23T03:00:01.000Z', finishedAt: null,
          executorNodeId: 'workstation', providerSessionId: null, result: null, error: null, revision: 3,
        } },
      ],
    }],
  });
  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const mutation: LedgerMutation = { action: 'reassign-task', cardId: 'master', assignedNodeId: 'phone' };
  assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation }).ok, true);
  await assert.rejects(state.executeMutation(mutation, before, after), /task_execution_active:master/);
  const master = (state.projection().ledger.cards as AnyRecord[]).find((card) => card.id === 'master');
  assert.equal((master?.assignment as AnyRecord).nodeId, 'workstation');
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
  assert.deepEqual(result.localChanges, [{ entityType: 'card', entityId: 'a' }]);
  assert.notEqual(state.store.entity('card', 'a')?.stateHash, beforeA?.stateHash);
  assert.equal(state.store.entity('card', 'b')?.stateHash, beforeB?.stateHash);
  assert.equal(state.store.entity('thread-note', 'thread-a/note-a')?.stateHash, beforeNote?.stateHash);
  const lifecycle = state.store.entity('card', 'a')?.fields.lifecycle?.candidates[0]?.value as Record<string, unknown>;
  assert.equal(lifecycle.status, 'done');
  assert.equal(lifecycle.waitingAt, null);
  assert.equal(lifecycle.closedAt, lifecycle.changedAt);
  assert.match(String(lifecycle.changedAt), /^\d{4}-\d{2}-\d{2}T/);
});

test('lifecycle conflicts block completion until a scoped lifecycle resolution', async (context) => {
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

  await state.transitionCardLifecycle('master', 'todo');
  assert.equal(state.projection().conflicts.length, 0);
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
