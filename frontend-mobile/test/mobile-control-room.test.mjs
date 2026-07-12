import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activeAge, deriveControlRoom, parseMasterTaskMarkdown, visibleMasterTaskMarkdown, waitingAge, withActiveStatus, withQueueRank } from '../src/mobile-control-room.js';

const mobile = await readFile(new URL('../src/mobile.js', import.meta.url), 'utf8');

const task = (overrides = {}) => ({
  cardId: 'card-a',
  title: 'Master A',
  ledgerId: 'tasks',
  ledgerTitle: 'Tasks',
  cardStatus: 'todo',
  cards: [{ id: 'card-r', status: 'done' }, { id: 'card-b', status: 'todo' }],
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

test('derives waiting, active, and done tabs with FIFO and ranked priority', () => {
  const result = deriveControlRoom([
    task({ cardId: 'newer', markdown: task().markdown.replace('10T10', '11T10') }),
    task({ cardId: 'oldest' }),
    task({ cardId: 'ranked', markdown: `${task().markdown.replace('10T10', '12T10')}\nQueue rank: 1` }),
    task({ cardId: 'active', markdown: task().markdown.replace('#task-waiting', '#task-active').replace('Waiting since:', 'Active since: 2026-07-10T10:30:00.000Z\nWaiting since:') }),
    task({ cardId: 'done', cardStatus: 'done', markdown: task().markdown.replace('#task-waiting', '#task-complete') })
  ]);
  assert.deepEqual(result.queue.map((entry) => entry.cardId), ['ranked', 'oldest', 'newer']);
  assert.deepEqual(result.active.map((entry) => entry.cardId), ['active']);
  assert.deepEqual(result.done.map((entry) => entry.cardId), ['done']);
  assert.deepEqual(result.ledgers, ['Tasks']);
});

test('ignores task tag examples in ordinary Markdown prose', () => {
  const parsed = parseMasterTaskMarkdown(task({ markdown: 'This specification documents `#master-task`, `#task-waiting`, and `#task-active`.' }));
  assert.equal(parsed.valid, false);
  assert.equal(parsed.diagnostics.includes('missing #master-task'), true);
  assert.equal(deriveControlRoom([{ ...task(), markdown: parsed.markdown }]).diagnostics.length, 0);
});

test('transitions a canonical master task to active with its launch timestamp', () => {
  const startedAt = '2026-07-12T06:35:14.888Z';
  const markdown = withActiveStatus(task().markdown, startedAt);
  assert.match(markdown, /^#master-task #task-active$/m);
  assert.match(markdown, /^Active since: 2026-07-12T06:35:14.888Z$/m);
  const parsed = parseMasterTaskMarkdown(task({ markdown }));
  assert.equal(parsed.valid, true);
  assert.equal(parsed.activeSince, startedAt);
  assert.equal(activeAge(startedAt, Date.parse('2026-07-12T06:40:14.888Z')), '5m active');
});

test('reports invalid canonical markdown and rewrites queue rank in place', () => {
  const invalid = parseMasterTaskMarkdown(task({ markdown: '#master-task #task-waiting\nLedger: Tasks' }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.diagnostics.join(','), /Waiting since/);
  const ranked = withQueueRank(task().markdown, 3);
  assert.match(ranked, /Waiting since: .*\nQueue rank: 3/);
  assert.equal(withQueueRank(ranked, 1).match(/Queue rank:/g).length, 1);
});

test('keeps malformed master tasks visible in the control room with diagnostics', () => {
  const malformed = task({
    cardId: 'malformed',
    cardStatus: 'done',
    markdown: '#master-task #task-waiting #task-active\n\nLedger: Tasks\n\n## Subtasks\n'
  });
  const result = deriveControlRoom([malformed]);
  assert.deepEqual(result.done.map((entry) => entry.cardId), ['malformed']);
  assert.deepEqual(result.diagnostics.map((entry) => entry.cardId), ['malformed']);
});

test('formats a stable waiting age', () => {
  assert.equal(waitingAge('2026-07-10T10:00:00.000Z', Date.parse('2026-07-12T10:00:00.000Z')), '2d waiting');
});

test('keeps task metadata in Markdown but removes it from the visible card body', () => {
  const visible = visibleMasterTaskMarkdown(task().markdown);
  assert.doesNotMatch(visible, /#master-task|Ledger:|Waiting since:|Status:/);
  assert.doesNotMatch(visible, /\[Research\]\(card:card-r\)/);
});

test('parses letter-prefixed card sections from the decision-os formatting contract', () => {
  const markdown = task().markdown.replace('## Subtasks', '## B. Subtasks');
  const parsed = parseMasterTaskMarkdown(task({ markdown }));
  assert.equal(parsed.subtasks.length, 2);
  assert.equal(parsed.complete, 1);
  assert.equal(parsed.nextSubtask.cardId, 'card-b');
});

test('routes master-task cards back to the control room and regular cards back to their zone', () => {
  assert.match(mobile, /backButton\.textContent = parsedTask\.masterTask \? '← Back to control room' : '← Back to zone'/);
  assert.match(mobile, /backButton\.dataset\.destination = parsedTask\.masterTask \? 'control-room' : 'zone'/);
  assert.match(mobile, /dataset\.destination === 'control-room' \? '\/' : zonePath/);
});
