import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveControlRoom, parseMasterTaskMarkdown, waitingAge, withQueueRank } from '../src/mobile-control-room.js';

const task = (overrides = {}) => ({
  cardId: 'card-a',
  title: 'Master A',
  ledgerId: 'tasks',
  ledgerTitle: 'Tasks',
  markdown: '#master-task #task-waiting\n\nLedger: Tasks\nWaiting since: 2026-07-10T10:00:00.000Z\n\n## Subtasks\n\n1. [Research](card:card-r) — Status: complete\n2. [Build](card:card-b) — Status: active',
  ...overrides
});

test('parses the canonical master-task markdown without another data model', () => {
  const parsed = parseMasterTaskMarkdown(task());
  assert.equal(parsed.valid, true);
  assert.equal(parsed.status, 'task-waiting');
  assert.equal(parsed.complete, 1);
  assert.equal(parsed.nextSubtask.cardId, 'card-b');
});

test('derives tabs, filters, completed exclusion, FIFO, and ranked priority', () => {
  const result = deriveControlRoom([
    task({ cardId: 'newer', markdown: task().markdown.replace('10T10', '11T10') }),
    task({ cardId: 'oldest' }),
    task({ cardId: 'ranked', markdown: `${task().markdown.replace('10T10', '12T10')}\nQueue rank: 1` }),
    task({ cardId: 'active', markdown: task().markdown.replace('#task-waiting', '#task-active') }),
    task({ cardId: 'done', markdown: task().markdown.replace('#task-waiting', '#task-complete') })
  ]);
  assert.deepEqual(result.queue.map((entry) => entry.cardId), ['ranked', 'oldest', 'newer']);
  assert.deepEqual(result.active.map((entry) => entry.cardId), ['active']);
  assert.deepEqual(result.ledgers, ['Tasks']);
});

test('reports invalid canonical markdown and rewrites queue rank in place', () => {
  const invalid = parseMasterTaskMarkdown(task({ markdown: '#master-task #task-waiting\nLedger: Tasks' }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.diagnostics.join(','), /Waiting since/);
  const ranked = withQueueRank(task().markdown, 3);
  assert.match(ranked, /Waiting since: .*\nQueue rank: 3/);
  assert.equal(withQueueRank(ranked, 1).match(/Queue rank:/g).length, 1);
});

test('formats a stable waiting age', () => {
  assert.equal(waitingAge('2026-07-10T10:00:00.000Z', Date.parse('2026-07-12T10:00:00.000Z')), '2d waiting');
});
