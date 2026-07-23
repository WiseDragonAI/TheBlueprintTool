import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOptimisticExecutionIntent,
  controlRoomTaskForExecution,
  createOptimisticExecutionIntent,
  optimisticExecutionConfirmed,
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
