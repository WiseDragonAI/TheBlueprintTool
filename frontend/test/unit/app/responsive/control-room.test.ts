import test from 'node:test';
import assert from 'node:assert/strict';
import { parentMasterTask } from '../../../../src/app/responsive/control-room.js';

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
