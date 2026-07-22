import test from 'node:test';
import assert from 'node:assert/strict';
import { taskFamilyCardAccent, taskFamilyCardIds } from '../../../../src/runtime/ledger/helper/task-family-accent.js';

const ledger = {
  cards: [
    { id: 'master', labels: ['master-task'] },
    { id: 'linked-child' },
    { id: 'label-only-child', labels: ['subtask'] },
    { id: 'ordinary' },
  ],
  relationships: [
    { id: 'linked', from: 'master', to: 'linked-child', label: 'subtask' },
    { id: 'unowned', from: 'ordinary', to: 'label-only-child', label: 'subtask' },
  ],
};

test('task family uses canonical master labels and relationship-owned subtasks', () => {
  assert.deepEqual([...taskFamilyCardIds(ledger)].sort(), ['linked-child', 'master']);
});

test('task family accent overrides incidental zone color only for project-owned task cards', () => {
  const taskIds = taskFamilyCardIds(ledger);
  assert.equal(taskFamilyCardAccent({ ledger, taskIds, cardId: 'master', projectColor: '#a855f7' }), '#a855f7');
  assert.equal(taskFamilyCardAccent({ ledger, taskIds, cardId: 'linked-child', projectColor: '#a855f7' }), '#a855f7');
  assert.equal(taskFamilyCardAccent({ ledger, taskIds, cardId: 'label-only-child', projectColor: '#a855f7' }), '');
  assert.equal(taskFamilyCardAccent({ ledger, taskIds, cardId: 'ordinary', projectColor: '#a855f7' }), '');
});
