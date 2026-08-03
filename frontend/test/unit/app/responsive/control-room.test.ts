/**
 * WHAT: Verifies responsive master-task projection and presentation-only subtask visibility.
 * WHY: Hidden detail rows must not change canonical lifecycle, completion, or next-work semantics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parentMasterTask, projectMasterTask, visibleMasterTaskSubtasks } from '../../../../src/app/responsive/control-room.js';

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

test('retains hidden children in canonical task semantics and filters only exact hidden labels from presentation', () => {
  const task = projectMasterTask({
    card: {
      id: 'master',
      title: 'Master',
      labels: ['master-task'],
      lifecycle: { status: 'todo' },
    },
    cards: [
      { id: 'master', title: 'Master', labels: ['master-task'], status: 'todo' },
      { id: 'hidden-complete', title: 'Internal work', labels: ['subtask', 'hidden'], status: 'done' },
      { id: 'visible-waiting', title: 'Visible work', labels: ['subtask'], status: 'todo' },
      { id: 'other-label', title: 'Other label', labels: ['subtask', 'hidden-detail'], status: 'done' },
      { id: 'title-match', title: 'hidden in title', labels: ['subtask'], status: 'todo' },
    ],
    relationships: [
      { id: 'rel-hidden', from: 'master', to: 'hidden-complete', label: 'subtask', position: 0 },
      { id: 'rel-visible', from: 'master', to: 'visible-waiting', label: 'subtask', position: 1 },
      { id: 'rel-other', from: 'master', to: 'other-label', label: 'subtask', position: 2 },
      { id: 'rel-title', from: 'master', to: 'title-match', label: 'subtask', position: 3 },
    ],
  });

  assert.deepEqual(task.subtasks.map((subtask) => subtask.cardId), [
    'hidden-complete',
    'visible-waiting',
    'other-label',
    'title-match',
  ]);
  assert.deepEqual(task.subtasks[0].labels, ['subtask', 'hidden']);
  assert.equal(task.complete, 2);
  assert.equal(task.nextSubtask?.cardId, 'visible-waiting');

  const visibleSubtasks = visibleMasterTaskSubtasks(task.subtasks);
  assert.deepEqual(visibleSubtasks.map((subtask) => subtask.cardId), [
    'visible-waiting',
    'other-label',
    'title-match',
  ]);
  assert.equal(visibleSubtasks.filter((subtask) => subtask.status === 'complete').length, 1);
});
