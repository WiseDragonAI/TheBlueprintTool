import assert from 'node:assert/strict';
import test from 'node:test';
import { activeAge, deriveControlRoom, taskFromCard, waitingAge } from '../src/mobile-control-room.js';

const cards = [
  { id: 'card-r', title: 'Research', status: 'done' },
  { id: 'card-b', title: 'Build', status: 'todo' }
];
const task = (overrides = {}) => ({
  card: {
    id: 'card-a',
    title: 'Master A',
    cardType: 'master-task',
    status: 'todo',
    taskState: 'waiting',
    taskWaitingSince: '2026-07-10T10:00:00.000Z',
    subtaskIds: ['card-r', 'card-b'],
    ...overrides
  },
  cards,
  ledgerId: 'tasks',
  ledgerTitle: 'Tasks'
});

test('derives master-task metadata and subtask progress from structured card fields', () => {
  const parsed = taskFromCard(task());
  assert.equal(parsed.valid, true);
  assert.equal(parsed.status, 'waiting');
  assert.equal(parsed.complete, 1);
  assert.equal(parsed.nextSubtask.cardId, 'card-b');
});

test('derives tabs, completed exclusion, FIFO, and ranked priority from card status', () => {
  const result = deriveControlRoom([
    task({ id: 'newer', taskWaitingSince: '2026-07-11T10:00:00.000Z' }),
    task({ id: 'oldest' }),
    task({ id: 'ranked', taskWaitingSince: '2026-07-12T10:00:00.000Z', taskQueueRank: 1 }),
    task({ id: 'active', taskState: 'active', taskActiveSince: '2026-07-10T10:30:00.000Z' }),
    task({ id: 'done', status: 'done' })
  ]);
  assert.deepEqual(result.queue.map((entry) => entry.cardId), ['ranked', 'oldest', 'newer']);
  assert.deepEqual(result.active.map((entry) => entry.cardId), ['active']);
  assert.equal(result.queue.some((entry) => entry.cardId === 'done'), false);
});

test('does not interpret task-looking Markdown as lifecycle metadata', () => {
  const parsed = taskFromCard(task({ cardType: 'note', description: '#master-task #task-active' }));
  assert.equal(parsed.masterTask, false);
  assert.equal(parsed.valid, false);
});

test('formats stable waiting and active ages', () => {
  assert.equal(waitingAge('2026-07-10T10:00:00.000Z', Date.parse('2026-07-12T10:00:00.000Z')), '2d waiting');
  assert.equal(activeAge('2026-07-12T06:35:14.888Z', Date.parse('2026-07-12T06:40:14.888Z')), '5m active');
});
