import test from 'node:test';
import assert from 'node:assert/strict';

import { projectMasterTask } from '../../src/app/responsive/control-room.js';

test('node-local voice state cannot override replicated task lifecycle', () => {
  const task = projectMasterTask({
    card: {
      id: 'card-a', title: 'Voice task', labels: ['master-task'],
      lifecycle: { status: 'todo', changedAt: '2026-07-17T11:41:45.161Z', waitingAt: '2026-07-17T11:41:45.161Z', closedAt: null },
      executionStatus: 'transcribing-before-launch',
    },
    ledgerTitle: 'Tasks',
  });
  assert.equal(task.status, 'task-waiting');
  assert.equal(task.executionStatus, '');
});
