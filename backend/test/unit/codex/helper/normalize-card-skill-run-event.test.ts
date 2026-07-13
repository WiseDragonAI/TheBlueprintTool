import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCardSkillRunEvent } from '@backend/business/codex/helper/normalize-card-skill-run-event.js';

const items = [
  { text: 'Inspect the linked run', completed: true },
  { text: 'Render the checklist', completed: false },
];

test('normalizes native todo-list lifecycle snapshots with exact ordered state', () => {
  const events = ['item.started', 'item.updated', 'item.completed'].map((type, index) => normalizeCardSkillRunEvent({
    line: index + 1,
    event: { type, item: { id: 'item_1', type: 'todo_list', items } },
  }));

  assert.deepEqual(events.map(({ kind, itemId, status, title, tool }) => ({ kind, itemId, status, title, tool })), [
    { kind: 'todo_list', itemId: 'item_1', status: 'in_progress', title: 'Todo list', tool: 'TodoList' },
    { kind: 'todo_list', itemId: 'item_1', status: 'in_progress', title: 'Todo list', tool: 'TodoList' },
    { kind: 'todo_list', itemId: 'item_1', status: 'completed', title: 'Todo list', tool: 'TodoList' },
  ]);
  assert.equal(events[1].text, '- [x] Inspect the linked run\n- [ ] Render the checklist');
  assert.deepEqual(JSON.parse(events[2].output), items);
  assert.equal(events.every((event) => event.persist), true);
});
