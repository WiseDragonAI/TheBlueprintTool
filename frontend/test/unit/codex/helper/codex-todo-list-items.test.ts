import test from 'node:test';
import assert from 'node:assert/strict';
import { codexTodoListItems } from '../../../../src/runtime/codex/helper/codex-todo-list-items.js';

test('decodes ordered native todo-list state and rejects invalid payloads', () => {
  const items = codexTodoListItems(JSON.stringify([
    { text: 'First task', completed: true },
    { text: 'Second task', completed: false },
  ]));
  assert.deepEqual(items, [
    { text: 'First task', completed: true },
    { text: 'Second task', completed: false },
  ]);
  assert.deepEqual(codexTodoListItems('{'), []);
});
