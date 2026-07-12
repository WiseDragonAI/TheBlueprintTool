import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activeAge, activeStopwatch, deriveControlRoom, parseMasterTaskMarkdown, visibleMasterTaskMarkdown, waitingAge, withActiveStatus, withQueueRank } from '../src/mobile-control-room.js';
import { controlRoomPath, parseControlRoomRoute } from '../src/mobile-control-room-route.js';

const [mobile, html, styles] = await Promise.all([
  readFile(new URL('../src/mobile.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/mobile.css', import.meta.url), 'utf8')
]);

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
    task({ cardId: 'active', codexRunId: 'run-active', codexStatus: 'processing', markdown: task().markdown.replace('#task-waiting', '#task-active').replace('Waiting since:', 'Active since: 2026-07-10T10:30:00.000Z\nWaiting since:') }),
    task({ cardId: 'done', cardStatus: 'done', markdown: task().markdown.replace('#task-waiting', '#task-complete') })
  ]);
  assert.deepEqual(result.queue.map((entry) => entry.cardId), ['ranked', 'oldest', 'newer']);
  assert.deepEqual(result.active.map((entry) => entry.cardId), ['active']);
  assert.deepEqual(result.done.map((entry) => entry.cardId), ['done']);
  assert.deepEqual(result.ledgers, ['Tasks']);
});

test('renders dynamic task totals in every Control Room status tab', () => {
  assert.match(html, /data-control-tab="queue"[\s\S]*?<small>0 tasks<\/small>/);
  assert.match(html, /data-control-tab="active"[\s\S]*?<small>0 tasks<\/small>/);
  assert.match(html, /data-control-tab="done"[\s\S]*?<small>0 tasks<\/small>/);
  assert.match(mobile, /const count = controlTaskCount\(button\.dataset\.controlTab\)/);
  assert.match(mobile, /`\$\{count\} \$\{count === 1 \? 'task' : 'tasks'\}`/);
});

test('round-trips the mobile Control Room tab and task scroll anchor through the URL', () => {
  assert.deepEqual(parseControlRoomRoute('https://example.test/?tab=active#task-card-a'), { tab: 'active', anchor: 'task-card-a' });
  assert.equal(controlRoomPath('done', 'task-card-b'), '/?tab=done#task-card-b');
});

test('canonicalizes invalid mobile Control Room URL state', () => {
  assert.deepEqual(parseControlRoomRoute('https://example.test/?tab=unknown#untrusted'), { tab: 'queue', anchor: '' });
  assert.equal(controlRoomPath('unknown', 'untrusted'), '/?tab=queue');
});

test('persists Control Room tab navigation and the nearest task anchor in browser history', () => {
  assert.match(mobile, /article\.id = `task-\$\{task\.cardId\}`/);
  assert.match(mobile, /history\.pushState\(\{\}, '', controlRoomPath\(state\.controlTab\)\)/);
  assert.match(mobile, /history\.replaceState\(\{\}, '', nextPath\)/);
  assert.match(mobile, /document\.getElementById\(anchor\)\?\.scrollIntoView\(\{ block: 'start' \}\)/);
});

test('shows task-active only while its Codex process is running', () => {
  const markdown = task().markdown.replace('#task-waiting', '#task-active').replace('Waiting since:', 'Active since: 2026-07-10T10:30:00.000Z\nWaiting since:');
  const result = deriveControlRoom([
    task({ cardId: 'running', markdown, codexRunId: 'run-123', codexStatus: 'processing' }),
    task({ cardId: 'stopped', markdown, codexRunId: 'run-456', codexStatus: 'complete' })
  ]);
  assert.deepEqual(result.active.map((entry) => entry.cardId), ['running']);
  assert.deepEqual(result.queue.map((entry) => entry.cardId), ['stopped']);
  assert.equal(result.active[0].codexRunId, 'run-123');
  assert.match(mobile, /Codex \$\{task\.codexRunId\}/);
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

test('formats the exact active Codex session duration as a minute-second stopwatch', () => {
  assert.equal(activeStopwatch('2026-07-12T10:00:00.000Z', Date.parse('2026-07-12T10:03:07.999Z')), '03:07');
  assert.equal(activeStopwatch('2026-07-12T10:00:00.000Z', Date.parse('2026-07-12T11:02:03.000Z')), '62:03');
});

test('renders active tasks as compact direct links without metadata or disclosure details', () => {
  assert.match(mobile, /class="task-stopwatch" data-active-since/);
  assert.match(mobile, /summary\.addEventListener\('click', \(\) => navigate\(pathForTask\(task\)\)\)/);
  assert.match(mobile, /if \(active\) \{[\s\S]*article\.append\(summary\);[\s\S]*return article;/);
});

test('opens queued master tasks directly without building disclosure content', () => {
  assert.match(mobile, /const directNavigation = active \|\| queue;/);
  assert.match(mobile, /if \(directNavigation\) \{[\s\S]*navigate\(pathForTask\(task\)\)[\s\S]*article\.append\(summary\);[\s\S]*return article;/);
  assert.match(mobile, /\$\{queue \? '' : '<span class="task-chevron">⌄<\/span>'\}/);
  assert.match(mobile, /if \(queue\) \{[\s\S]*article\.addEventListener\('drop'/);
});

test('omits the next-subtask subtitle when no actionable subtask exists', () => {
  assert.doesNotMatch(mobile, /No actionable subtask/);
  assert.match(mobile, /task\.nextSubtask \? '<span class="task-next"><\/span>' : ''/);
  assert.match(mobile, /if \(nextSubtask\) nextSubtask\.textContent = `Next: \$\{task\.nextSubtask\.title\}`/);
});

test('omits completed-subtask progress from task-row metadata', () => {
  assert.match(mobile, /textContent = `\$\{task\.ledger\} · \$\{age\}\$\{process\}`/);
  assert.doesNotMatch(mobile, /task\.complete\}\/\$\{task\.subtasks\.length\} complete/);
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
  assert.match(mobile, /backButton\.textContent = '← Back'/);
  assert.match(mobile, /backButton\.dataset\.destination = parsedTask\.masterTask \? 'control-room' : 'zone'/);
  assert.match(mobile, /dataset\.destination === 'control-room' \? '\/' : zonePath/);
});

test('completes all linked cards from the master-task detail', () => {
  assert.match(mobile, /action: 'complete-master-task', masterTaskId: card\.id/);
  assert.match(mobile, /navigate\(completionReturnPath\(\), true\)/);
  assert.match(mobile, /return returnPath\.startsWith\('\/'\) \? returnPath : '\/'/);
  assert.match(mobile, /completeButton\.textContent = card\.status === 'done' \? 'Master task complete' : 'Complete master task'/);
  assert.match(mobile, /overview\.append\(status, heading, subtasks, completion\)/);
  assert.doesNotMatch(mobile, /complete-master-subtask|masterTaskId=|Mark task as done/);
  assert.match(styles, /\.complete-master-task-button \{ width: 100%; min-height: 52px;/);
});

test('uses global application destinations and keeps new task as the fourth control-room action', () => {
  assert.match(mobile, /destination\('Control room', '\/'\)/);
  assert.match(mobile, /destination\('Ledgers', '\/ledgers'\)/);
  assert.match(mobile, /destination\('Pipelines', '', 'nav-pipelines-button'\)/);
  assert.match(mobile, /destination\('Skill library', '', 'nav-skills-button'\)/);
  assert.doesNotMatch(html, /class="icon-button pipelines-button"/);
  assert.doesNotMatch(html, /class="control-heading"|class="live-dot"/);
  assert.match(html, /data-control-tab="done"[\s\S]*class="new-task-button"/);
  assert.match(styles, /grid-template-columns: repeat\(4, 1fr\)/);
  assert.match(html, /class="nav-server-restart-button"/);
  assert.match(mobile, /fetch\('\/api\/server\/restart', \{ method: 'POST' \}\)/);
});
