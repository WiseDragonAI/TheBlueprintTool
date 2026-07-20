import test from 'node:test';
import assert from 'node:assert/strict';
import { completedTaskLabels, filterCompletedTasks, sortCompletedTasks } from '../../../../src/app/responsive/completed-tasks.js';

const tasks = [
  { cardId: 'a', title: 'Ship desktop', projectId: 'editor', projectName: 'Editor', ledgerTitle: 'Specs', labels: ['release', 'desktop'], completedTime: 100 },
  { cardId: 'b', title: 'Mobile polish', projectId: 'editor', projectName: 'Editor', ledgerTitle: 'Tasks', labels: ['mobile'], completedTime: 300 },
  { cardId: 'c', title: 'API cleanup', projectId: 'server', projectName: 'Server', ledgerTitle: 'Tasks', labels: [], completedTime: null },
];

test('derives sorted unique labels from the project-scoped completed set', () => {
  assert.deepEqual(completedTaskLabels(tasks), ['desktop', 'mobile', 'release']);
});

test('combines completed-task search, project, and label filters', () => {
  assert.deepEqual(filterCompletedTasks(tasks, { query: 'specs', projectIds: ['editor'], label: 'release' }).map((task) => task.cardId), ['a']);
  assert.deepEqual(filterCompletedTasks(tasks, { query: 'MOBILE' }).map((task) => task.cardId), ['b']);
  assert.deepEqual(filterCompletedTasks(tasks, { projectIds: ['server'] }).map((task) => task.cardId), ['c']);
  assert.deepEqual(filterCompletedTasks(tasks, { label: 'missing' }), []);
});

test('sorts completed tasks newest first by default and supports oldest first', () => {
  assert.deepEqual(sortCompletedTasks(tasks).map((task) => task.cardId), ['b', 'a', 'c']);
  assert.deepEqual(sortCompletedTasks(tasks, 'asc').map((task) => task.cardId), ['a', 'b', 'c']);
  assert.deepEqual(filterCompletedTasks(tasks).map((task) => task.cardId), ['b', 'a', 'c']);
});
