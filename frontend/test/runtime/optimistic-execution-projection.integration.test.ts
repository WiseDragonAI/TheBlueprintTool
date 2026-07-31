import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOptimisticExecutionIntent,
  controlRoomTaskForExecution,
  createOptimisticExecutionIntent,
  materializePendingExecutionIntents,
  optimisticExecutionConfirmed,
  removeAcknowledgedExecutionIntent,
  removeRejectedExecutionIntent,
} from '../../src/app/responsive/optimistic-execution-projection.js';

const task = {
  projectId: 'project-a',
  ledgerId: 'tasks',
  cardId: 'master-a',
  assignedNodeId: 'workstation',
  assignedNodeLabel: 'Workstation',
  status: 'task-waiting',
  subtasks: [{ cardId: 'subtask-a' }],
};

test('optimistic execution moves the master task to Exec with request and assignment identity', () => {
  const projection = { queue: [task], exec: [], backlog: [], done: [], allTasks: [task] };
  const selected = controlRoomTaskForExecution(projection, {
    projectId: 'project-a',
    ledgerId: 'tasks',
    cardId: 'subtask-a',
  });
  const intent = createOptimisticExecutionIntent(selected, {
    requestId: 'request-a',
    acceptedAt: '2026-07-23T10:00:00.000Z',
  });

  applyOptimisticExecutionIntent(projection, intent);

  assert.equal(projection.queue.length, 0);
  assert.equal(projection.exec[0].executionStatus, 'preparing');
  assert.equal(projection.exec[0].execution.requestId, 'request-a');
  assert.equal(projection.exec[0].execution.executorNodeId, 'workstation');
});

test('canonical reconciliation requires the same request and a non-stale revision', () => {
  const intent = createOptimisticExecutionIntent(task, {
    requestId: 'request-a',
    acceptedAt: '2026-07-23T10:00:00.000Z',
  });
  intent.revision = 2;

  assert.equal(optimisticExecutionConfirmed(intent, { execution: { requestId: 'request-b', revision: 3 } }), false);
  assert.equal(optimisticExecutionConfirmed(intent, { execution: { requestId: 'request-a', revision: 1 } }), false);
  assert.equal(optimisticExecutionConfirmed(intent, { execution: { requestId: 'request-a', revision: 2 } }), true);
});

test('admission success removes the exact optimistic request immediately', () => {
  const intents = new Map([
    ['project-a:master-a', createOptimisticExecutionIntent(task, { requestId: 'request-a', acceptedAt: '2026-07-23T10:00:00.000Z' })],
    ['project-a:master-b', createOptimisticExecutionIntent({ ...task, cardId: 'master-b' }, { requestId: 'request-b', acceptedAt: '2026-07-23T10:01:00.000Z' })],
  ]);

  assert.equal(removeAcknowledgedExecutionIntent(intents, { clientRequestId: 'request-a', requestId: 'server-request-a' }), true);
  assert.deepEqual([...intents.keys()], ['project-a:master-b']);
});

test('admission rejection removes only the matching optimistic request', () => {
  const intents = new Map([
    ['project-a:master-a', createOptimisticExecutionIntent(task, { requestId: 'request-a', acceptedAt: '2026-07-23T10:00:00.000Z' })],
    ['project-a:master-b', createOptimisticExecutionIntent({ ...task, cardId: 'master-b' }, { requestId: 'request-b', acceptedAt: '2026-07-23T10:01:00.000Z' })],
  ]);

  assert.equal(removeRejectedExecutionIntent(intents, { requestId: 'request-a' }), true);
  assert.deepEqual([...intents.keys()], ['project-a:master-b']);
});

test('a cold-route request materializes over the first matching Control Room projection', () => {
  const pending = new Map([['request-a', {
    projectId: 'project-a',
    ledgerId: 'tasks',
    cardId: 'subtask-a',
    requestId: 'request-a',
    acceptedAt: '2026-07-23T10:00:00.000Z',
    kind: 'pipeline',
  }]]);
  const intents = new Map();
  const projection = { queue: [task], exec: [], backlog: [], done: [], allTasks: [task] };

  assert.equal(materializePendingExecutionIntents(pending, intents, projection), 1);
  assert.equal(pending.size, 0);
  const [intent] = intents.values();
  assert.equal(intent?.requestId, 'request-a');

  applyOptimisticExecutionIntent(projection, intent);
  assert.equal(projection.exec[0].executionStatus, 'preparing');
  assert.equal(projection.exec[0].execution.requestId, 'request-a');
});

test('cold-route materialization retains unmatched requests for a later replicated projection', () => {
  const pending = new Map([['request-a', {
    projectId: 'project-a',
    ledgerId: 'tasks',
    cardId: 'missing-subtask',
    requestId: 'request-a',
    acceptedAt: '2026-07-23T10:00:00.000Z',
    kind: 'pipeline',
  }]]);
  const intents = new Map();

  assert.equal(materializePendingExecutionIntents(pending, intents, { queue: [], exec: [], backlog: [], done: [], allTasks: [] }), 0);
  assert.equal(pending.has('request-a'), true);
  assert.equal(intents.size, 0);
});
