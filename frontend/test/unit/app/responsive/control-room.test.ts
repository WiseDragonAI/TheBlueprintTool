import test from 'node:test';
import assert from 'node:assert/strict';
import { parentMasterTask, projectMasterTask } from '../../../../src/app/responsive/control-room.js';

const cards = [
  { id: 'master', labels: ['master-task'] },
  { id: 'subtask', labels: ['subtask'] },
  { id: 'ordinary' },
];

test('resolves a subtask parent only through a canonical master-task relationship', () => {
  assert.equal(parentMasterTask({
    cardId: 'subtask',
    cards,
    relationships: [{ from: 'master', to: 'subtask', label: 'subtask' }],
  })?.id, 'master');

  assert.equal(parentMasterTask({
    cardId: 'subtask',
    cards,
    relationships: [{ from: 'ordinary', to: 'subtask', label: 'subtask' }],
  }), null);
});

test('renders a completed navigation subtask from its compact status field', () => {
  const task = projectMasterTask({
    card: {
      id: 'master',
      title: 'Master',
      labels: ['master-task'],
      lifecycle: { status: 'todo', waitingAt: '2026-07-25T20:00:00.000Z', closedAt: null },
    },
    cards: [
      { id: 'master', title: 'Master', labels: ['master-task'], status: 'todo' },
      { id: 'subtask', title: 'Completed child', labels: ['subtask'], status: 'done' },
    ],
    relationships: [{ id: 'relationship', from: 'master', to: 'subtask', label: 'subtask', position: 0 }],
    ledgerTitle: 'Tasks',
  });

  assert.equal(task.complete, 1);
  assert.equal(task.subtasks[0].status, 'complete');
  assert.equal(task.nextSubtask, null);
});
