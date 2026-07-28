import test from 'node:test';
import assert from 'node:assert/strict';

import { executionPresentation, projectMasterTask } from '../../src/app/responsive/control-room.js';

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

test('cancelling uses the replicated phase timestamp for its stopwatch', () => {
  const presentation = executionPresentation({
    executionStatus: 'cancelling',
    execution: { phase: 'cancelling', phaseSince: '2026-07-23T12:00:00.000Z' },
  }, Date.parse('2026-07-23T12:01:05.000Z'));

  assert.deepEqual(presentation, {
    phase: 'cancelling',
    since: '2026-07-23T12:00:00.000Z',
    label: 'Cancelling',
    elapsed: '01:05',
    text: 'Cancelling · 01:05',
  });
});

test('execution presentation includes hours after sixty minutes', () => {
  const presentation = executionPresentation({
    executionStatus: 'running',
    execution: { phase: 'running', phaseSince: '2026-07-23T12:00:00.000Z' },
  }, Date.parse('2026-07-23T13:00:05.000Z'));

  assert.deepEqual(presentation, {
    phase: 'running',
    since: '2026-07-23T12:00:00.000Z',
    label: 'Running',
    elapsed: '1:00:05',
    text: 'Running · 1:00:05',
  });
});
