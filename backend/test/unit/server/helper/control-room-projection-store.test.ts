/**
 * WHAT: Proves the Control Room is derived only from structural task current state.
 * WHY: Card bodies, thread bodies, labels on children, filesystem time, and node-local observations cannot be task authority.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { controlRoomProjectionFromTaskLedger, createControlRoomProjectionStore } from '@backend/business/server/helper/control-room-projection-store.js';
import type { DecisionOsProject } from '@backend/business/server/helper/project-catalog.js';

const lifecycle = (status: 'todo' | 'backlog' | 'done', changedAt: string) => ({
  status,
  changedAt,
  waitingAt: status === 'todo' ? changedAt : null,
  closedAt: status === 'done' ? changedAt : null,
});

function fixture(context: { after(callback: () => void): void }) {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-structural-'));
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const project: DecisionOsProject = {
    id: 'project-a', name: 'Project A', relativePath: '.', root, decisionOsRoot,
    description: '', color: '#123456', available: true, diagnostic: '',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  };
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, decisionOsRoot, project };
}

test('replicated execution intent alone places a master task in Exec', (context) => {
  const { project } = fixture(context);
  const ledger = {
    cards: [{
      id: 'master', title: 'Master', labels: ['master-task'], createdAt: '2026-07-14T10:00:00.000Z',
      lifecycle: lifecycle('todo', '2026-07-14T10:01:00.000Z'),
      executionIntent: { id: 'intent-a', state: 'running', changedAt: '2026-07-14T10:02:00.000Z', startedAt: '2026-07-14T10:03:00.000Z', settledAt: null, error: null },
    }],
    annotations: [], relationships: [],
  };

  const projection = controlRoomProjectionFromTaskLedger({ project, ledger }) as Record<string, any>;

  assert.equal(projection.exec.length, 1);
  assert.equal(projection.exec[0].executionStatus, 'running');
  assert.equal(projection.exec[0].executionSince, '2026-07-14T10:03:00.000Z');
  assert.equal(projection.exec[0].cardStatus, 'todo');
});

test('node-local process, queue, voice, and body observations cannot override lifecycle', (context) => {
  const { decisionOsRoot, project } = fixture(context);
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), 'Completed at: 1999-01-01T00:00:00.000Z\n#task-complete\n');
  writeFileSync(join(decisionOsRoot, 'codex-process-queue.json'), JSON.stringify({ items: [{ id: 'run-a', status: 'pending' }] }));
  const ledger = {
    cards: [{ id: 'master', title: 'Master', labels: ['master-task'], lifecycle: lifecycle('backlog', '2026-07-14T10:01:00.000Z'), comment: { contentFile: '.decision-os/cards/tasks/master.md' }, codexActiveRunId: 'run-a' }],
    annotations: [], relationships: [],
  };

  const projection = controlRoomProjectionFromTaskLedger({ project, ledger, runtime: { voiceCodexExecutionObservations: { anything: { kind: 'voice-transcription' } }, codexSkillRuns: { 'run-a': { status: 'running' } } } }) as Record<string, any>;

  assert.equal(projection.backlog.length, 1);
  assert.equal(projection.exec.length, 0);
  assert.equal(projection.done.length, 0);
});

test('subtask membership and order come solely from positioned relationships', (context) => {
  const { project } = fixture(context);
  const ledger = {
    cards: [
      { id: 'master', title: 'Master', labels: ['master-task'], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') },
      { id: 'child-z', title: 'Z', labels: ['master-task'], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') },
      { id: 'child-a', title: 'A', labels: [], lifecycle: lifecycle('done', '2026-07-14T10:00:00.000Z') },
      { id: 'labeled-only', title: 'Not linked', labels: ['subtask'], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') },
    ],
    annotations: [],
    relationships: [
      { id: 'rel-z', from: 'master', to: 'child-z', label: 'subtask', position: 1 },
      { id: 'rel-b', from: 'master', to: 'child-a', label: 'subtask', position: 0 },
    ],
  };

  const projection = controlRoomProjectionFromTaskLedger({ project, ledger }) as Record<string, any>;
  const task = projection.allTasks.find((entry: Record<string, unknown>) => entry.cardId === 'master');

  assert.deepEqual(task.subtasks.map((entry: Record<string, unknown>) => entry.cardId), ['child-a', 'child-z']);
  assert.equal(task.complete, 1);
  assert.equal(task.nextSubtask.cardId, 'child-z');
  assert.equal(task.subtasks.some((entry: Record<string, unknown>) => entry.cardId === 'labeled-only'), false);
});

test('every relationship delivery permutation produces the same ordered task graph', (context) => {
  const { project } = fixture(context);
  const relationships = [
    { id: 'rel-c', from: 'master', to: 'child-c', label: 'subtask', position: 1 },
    { id: 'rel-a', from: 'master', to: 'child-a', label: 'subtask', position: 0 },
    { id: 'rel-b', from: 'master', to: 'child-b', label: 'subtask', position: 1 },
  ];
  const permutations = relationships.flatMap((first, firstIndex) => relationships
    .filter((_entry, index) => index !== firstIndex)
    .flatMap((second, secondIndex, remaining) => remaining.filter((_entry, index) => index !== secondIndex).map((third) => [first, second, third])));
  const cards = [
    { id: 'master', title: 'Master', labels: ['master-task'], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') },
    ...['a', 'b', 'c'].map((id) => ({ id: `child-${id}`, title: id.toUpperCase(), labels: [], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') })),
  ];

  const orders = permutations.map((delivery) => controlRoomProjectionFromTaskLedger({ project, ledger: { cards, annotations: [], relationships: delivery } }).allTasks[0].subtasks.map((entry: Record<string, unknown>) => entry.cardId));

  assert.equal(orders.length, 6);
  for (const order of orders) assert.deepEqual(order, ['child-a', 'child-b', 'child-c']);
});

test('same structural state produces byte-identical local and remote-only task projections', (context) => {
  const { project } = fixture(context);
  const ledger = {
    cards: [{ id: 'master', title: 'Master', labels: ['master-task'], createdAt: '2026-07-14T09:00:00.000Z', lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') }],
    annotations: [], relationships: [],
  };

  const local = controlRoomProjectionFromTaskLedger({ project, ledger, runtime: { codexSkillRuns: { stale: { status: 'running' } } } });
  const remote = controlRoomProjectionFromTaskLedger({ project: { ...project, root: '', decisionOsRoot: '' }, ledger, runtime: {} });

  assert.equal(JSON.stringify(local), JSON.stringify(remote));
});

test('lifecycle conflicts remain visible and invalidate the affected task graph', (context) => {
  const { project } = fixture(context);
  const ledger = {
    cards: [{ id: 'master', title: 'Master', labels: ['master-task'], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') }],
    annotations: [], relationships: [],
  };
  const conflicts = [{ kind: 'task-conflict', entityType: 'card', entityId: 'master', path: 'lifecycle', candidates: [] }];

  const projection = controlRoomProjectionFromTaskLedger({ project, ledger, conflicts }) as Record<string, any>;

  assert.equal(projection.allTasks[0].taskConflict, true);
  assert.equal(projection.allTasks[0].valid, false);
  assert.deepEqual(projection.allTasks[0].diagnostics, ['task-conflict:master']);
  assert.equal(projection.diagnostics.length, 1);
});

test('post-join invalidation materializes only the changed child and its relationship-owned master', async (context) => {
  const { decisionOsRoot, project } = fixture(context);
  let taskProjection: Record<string, unknown> = {
    ledger: {
      cards: [
        { id: 'master', title: 'Master', labels: ['master-task'], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') },
        { id: 'child', title: 'Child', labels: [], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') },
        { id: 'unrelated', title: 'Unrelated', labels: ['master-task'], lifecycle: lifecycle('backlog', '2026-07-14T10:00:00.000Z') },
      ],
      annotations: [], relationships: [{ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
    },
    conflicts: [],
  };
  const store = createControlRoomProjectionStore({
    cacheFile: join(decisionOsRoot, 'cache', 'control-room.json'),
    taskProjectionForProject: () => taskProjection,
  });
  const before = store.get([project]) as Record<string, any>;
  const initialWork = store.diagnostics();
  taskProjection = {
    ledger: {
      cards: [
        { id: 'master', title: 'Master', labels: ['master-task'], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') },
        { id: 'child', title: 'Child', labels: [], lifecycle: lifecycle('done', '2026-07-14T11:00:00.000Z') },
        { id: 'unrelated', title: 'Unrelated', labels: ['master-task'], lifecycle: lifecycle('backlog', '2026-07-14T10:00:00.000Z') },
      ],
      annotations: [], relationships: [{ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
    },
    conflicts: [],
  };

  assert.equal(store.get([project]).revision, before.revision);
  store.invalidate(project.id, [{ entityType: 'card', entityId: 'child' }]);
  await new Promise((resolveWait) => setImmediate(resolveWait));
  const after = store.get([project]) as Record<string, any>;

  assert.equal(after.allTasks.find((task: Record<string, unknown>) => task.cardId === 'master').complete, 1);
  assert.equal(after.backlog.find((task: Record<string, unknown>) => task.cardId === 'unrelated').title, 'Unrelated');
  assert.ok(after.revision > before.revision);
  assert.deepEqual(store.diagnostics(), {
    projectBuilds: initialWork.projectBuilds + 1,
    taskMaterializations: initialWork.taskMaterializations + 2,
    largestIncrementalBatch: 2,
  });

  const beforeContentHead = store.diagnostics();
  const revisionBeforeContentHead = after.revision;
  store.invalidate(project.id, [{ entityType: 'resource', entityId: '.decision-os/cards/tasks/child.md' }]);
  await new Promise((resolveWait) => setImmediate(resolveWait));
  assert.deepEqual(store.diagnostics(), beforeContentHead);
  assert.equal(store.get([project]).revision, revisionBeforeContentHead);
});

test('high fan-out relationship updates remain bounded to 64 task materializations per background batch', async (context) => {
  const { decisionOsRoot, project } = fixture(context);
  const masters = Array.from({ length: 70 }, (_entry, index) => ({
    id: `master-${String(index).padStart(2, '0')}`,
    title: `Master ${index}`,
    labels: ['master-task'],
    lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z'),
  }));
  let taskProjection: Record<string, unknown> = {
    ledger: {
      cards: [...masters, { id: 'shared-child', title: 'Child', labels: [], lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z') }],
      annotations: [],
      relationships: masters.map((master, index) => ({ id: `rel-${index}`, from: master.id, to: 'shared-child', label: 'subtask', position: 0 })),
    },
    conflicts: [],
  };
  const store = createControlRoomProjectionStore({
    cacheFile: join(decisionOsRoot, 'cache', 'control-room-bounded.json'),
    taskProjectionForProject: () => taskProjection,
  });
  store.get([project]);
  const before = store.diagnostics();
  const changedLedger = structuredClone(taskProjection.ledger as Record<string, any>);
  changedLedger.cards.find((card: Record<string, unknown>) => card.id === 'shared-child').lifecycle = lifecycle('done', '2026-07-14T11:00:00.000Z');
  taskProjection = { ledger: changedLedger, conflicts: [] };

  store.invalidate(project.id, [{ entityType: 'card', entityId: 'shared-child' }]);
  await new Promise((resolveWait) => setImmediate(() => setImmediate(resolveWait)));

  const after = store.get([project]) as Record<string, any>;
  assert.equal(after.allTasks.every((task: Record<string, any>) => task.complete === 1), true);
  assert.equal(store.diagnostics().taskMaterializations - before.taskMaterializations, 71);
  assert.equal(store.diagnostics().largestIncrementalBatch, 64);
});

test('a 10,000-task incremental update yields the event loop before projection work', async (context) => {
  const { decisionOsRoot, project } = fixture(context);
  const cards = Array.from({ length: 10_000 }, (_entry, index) => ({
    id: `master-${String(index).padStart(5, '0')}`,
    title: `Master ${index}`,
    labels: ['master-task'],
    lifecycle: lifecycle('todo', '2026-07-14T10:00:00.000Z'),
  }));
  const taskProjection: Record<string, any> = { ledger: { cards, annotations: [], relationships: [] }, conflicts: [] };
  const store = createControlRoomProjectionStore({
    cacheFile: join(decisionOsRoot, 'cache', 'control-room-10000.json'),
    taskProjectionForProject: () => taskProjection,
  });
  const before = store.get([project]);
  cards[5_000] = { ...cards[5_000], lifecycle: lifecycle('done', '2026-07-14T11:00:00.000Z') };

  store.invalidate(project.id, [{ entityType: 'card', entityId: cards[5_000].id }]);
  const revisionObservedBeforeNextTurn = await Promise.resolve().then(() => store.get([project]).revision);
  assert.equal(revisionObservedBeforeNextTurn, before.revision);
  await new Promise((resolveWait) => setImmediate(resolveWait));

  const after = store.get([project]) as Record<string, any>;
  assert.equal(after.done.some((task: Record<string, unknown>) => task.cardId === cards[5_000].id), true);
  assert.equal(store.diagnostics().largestIncrementalBatch, 1);
  assert.equal(existsSync(join(decisionOsRoot, 'cache', 'control-room-10000.json')), false);
});
