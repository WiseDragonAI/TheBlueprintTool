/** WHAT: Preserves the source responsive Control Room contract. WHY: Task lifecycle, routing, ordering, and display behavior must not regress during unification. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { executionStopwatch, cardCodexRunId, deriveControlRoom, parseMasterTaskMarkdown, visibleMasterTaskMarkdown, waitingAge, withQueueRank } from '../src/app/responsive/control-room.js';
import { controlRoomPath, parseControlRoomRoute } from '../src/app/responsive/control-room-route.js';

const [mobile, html, styles, bootApplication, embla, panzoom, mediaRenderer] = await Promise.all([
  readFile(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/application.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/controller/boot-application.ts', import.meta.url), 'utf8'),
  readFile(new URL('../assets/vendor/embla-carousel-8.6.0.umd.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/vendor/panzoom-4.6.2.es.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/runtime/ledger/component/render-ledger-card-media.ts', import.meta.url), 'utf8')
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

test('uses JSON labels, status, and relationships when legacy Markdown is stale', () => {
  const parsed = parseMasterTaskMarkdown(task({
    labels: ['master-task'],
    relationships: [
      { id: 'rel-r', from: 'card-a', to: 'card-r', label: 'subtask' },
      { id: 'rel-b', from: 'card-a', to: 'card-b', label: 'subtask' },
    ],
    cards: [
      { id: 'card-r', title: 'Research', status: 'done', labels: ['subtask'] },
      { id: 'card-b', title: 'Build', status: 'todo', labels: ['subtask'] },
    ],
    markdown: '#master-task #task-complete\n\nLedger: Tasks\nWaiting since: 2026-07-10T10:00:00.000Z\n\n## Subtasks\n\n1. [Research](card:card-r) — Status: pending',
  }));
  assert.equal(parsed.valid, true);
  assert.equal(parsed.status, 'task-waiting');
  assert.equal(parsed.complete, 1);
  assert.deepEqual(parsed.subtasks.map((entry) => entry.cardId), ['card-r', 'card-b']);
});

test('uses canonical ledger context and thread time when JSON master Markdown has no lifecycle header', () => {
  const parsed = parseMasterTaskMarkdown(task({
    labels: ['master-task'],
    relationships: [],
    cards: [],
    threadNotes: [{ role: 'operator', timestamp: '2026-07-10T11:15:00.000Z' }],
    markdown: '## A. Result\n\n1. Complete.'
  }));
  assert.equal(parsed.valid, true);
  assert.equal(parsed.ledger, 'Tasks');
  assert.equal(parsed.waitingSince, '2026-07-10T11:15:00.000Z');
});

test('restarts waiting age from the latest timestamped thread message', () => {
  const parsed = parseMasterTaskMarkdown(task({
    threadNotes: [
      { role: 'operator', timestamp: '2026-07-10T10:05:00.000Z' },
      { role: 'agent', timestamp: '2026-07-10T11:15:00.000Z' }
    ]
  }));
  assert.equal(parsed.waitingSince, '2026-07-10T11:15:00.000Z');
  assert.equal(parsed.waitingTime, Date.parse('2026-07-10T11:15:00.000Z'));
  assert.equal(waitingAge(parsed.waitingSince, Date.parse('2026-07-10T11:45:00.000Z')), '30m waiting');
});

test('ignores malformed thread timestamps and retains the card waiting timestamp', () => {
  const parsed = parseMasterTaskMarkdown(task({ threadNotes: [{ role: 'agent', timestamp: 'not-a-date' }] }));
  assert.equal(parsed.waitingSince, '2026-07-10T10:00:00.000Z');
  assert.equal(parsed.waitingTime, Date.parse('2026-07-10T10:00:00.000Z'));
});

test('derives waiting, execution, and backlog tabs with FIFO and ranked priority', () => {
  const result = deriveControlRoom([
    task({ cardId: 'newer', markdown: task().markdown.replace('10T10', '11T10') }),
    task({ cardId: 'oldest' }),
    task({ cardId: 'ranked', markdown: `${task().markdown.replace('10T10', '12T10')}\nQueue rank: 1` }),
    task({ cardId: 'active', codexRunId: 'run-active', codexStatus: 'processing', markdown: task().markdown.replace('#task-waiting', '#task-execution').replace('Waiting since:', 'Active since: 2026-07-10T10:30:00.000Z\nWaiting since:') }),
    task({ cardId: 'backlog', cardStatus: 'backlog' }),
    task({ cardId: 'done', cardStatus: 'done', markdown: task().markdown.replace('#task-waiting', '#task-complete') })
  ]);
  assert.deepEqual(result.queue.map((entry) => entry.cardId), ['ranked', 'oldest', 'newer']);
  assert.deepEqual(result.exec.map((entry) => entry.cardId), ['active']);
  assert.deepEqual(result.backlog.map((entry) => entry.cardId), ['backlog']);
  assert.equal(result.queue.some((entry) => entry.cardId === 'done'), false);
  assert.deepEqual(result.ledgers, ['Tasks']);
});

test('renders dynamic task totals in every Control Room status tab', () => {
  assert.match(html, /data-control-tab="queue"[\s\S]*?<small>0 tasks<\/small>/);
  assert.match(html, /data-control-tab="exec"[\s\S]*?<small>0 tasks<\/small>/);
  assert.match(html, /data-control-tab="backlog"[\s\S]*?<small>0 tasks<\/small>/);
  assert.doesNotMatch(html, /data-control-tab="done"/);
  assert.match(mobile, /const count = controlTaskCount\(button\.dataset\.controlTab\)/);
  assert.match(mobile, /`\$\{count\} \$\{count === 1 \? 'task' : 'tasks'\}`/);
});

test('mobile card inline code changes color without replacing the surrounding font', () => {
  assert.match(styles, /\.ledger-card-body code \{[^}]*color: color-mix\(in srgb, var\(--zone-color\), white 52%\);[^}]*font-family: inherit;/);
});

test('round-trips the mobile Control Room tab and task scroll anchor through the URL', () => {
  assert.deepEqual(parseControlRoomRoute('https://example.test/?tab=active#task-card-a'), { tab: 'exec', anchor: 'task-card-a' });
  assert.equal(controlRoomPath('backlog', 'task-card-b'), '/?tab=backlog#task-card-b');
});

test('canonicalizes invalid mobile Control Room URL state', () => {
  assert.deepEqual(parseControlRoomRoute('https://example.test/?tab=unknown#untrusted'), { tab: 'queue', anchor: '' });
  assert.equal(controlRoomPath('unknown', 'untrusted'), '/?tab=queue');
});

test('persists Control Room tab navigation and the nearest task anchor in browser history', () => {
  assert.match(mobile, /article\.id = `task-\$\{taskIdentity\(task\)\}`/);
  assert.match(mobile, /history\.pushState\(\{\}, '', controlRoomPath\(state\.controlTab\)\)/);
  assert.match(mobile, /history\.replaceState\(\{\}, '', nextPath\)/);
  assert.match(mobile, /document\.getElementById\(anchor\)\?\.scrollIntoView\(\{ block: 'start' \}\)/);
});

test('shows task-execution only while its Codex process is running', () => {
  const markdown = task().markdown.replace('#task-waiting', '#task-execution').replace('Waiting since:', 'Active since: 2026-07-10T10:30:00.000Z\nWaiting since:');
  const result = deriveControlRoom([
    task({ cardId: 'running', markdown, codexRunId: 'run-123', codexStatus: 'processing' }),
    task({ cardId: 'stopped', markdown, codexRunId: 'run-456', codexStatus: 'complete' })
  ]);
  assert.deepEqual(result.exec.map((entry) => entry.cardId), ['running']);
  assert.deepEqual(result.queue.map((entry) => entry.cardId), ['stopped']);
  assert.equal(result.exec[0].codexRunId, 'run-123');
  assert.match(mobile, /Codex \$\{task\.codexRunId\}/);
});

test('anchors an executing pipeline task to its logical launch instead of a recovered process segment', () => {
  const firstActivation = '2026-07-10T10:30:00.000Z';
  const currentRunStartedAt = '2026-07-10T10:35:07.000Z';
  const markdown = task().markdown.replace('#task-waiting', '#task-execution').replace('Waiting since:', `Active since: ${firstActivation}\nWaiting since:`);
  const parsed = parseMasterTaskMarkdown(task({
    markdown,
    codexRunId: 'run-current',
    codexStatus: 'running',
    codexStartedAt: currentRunStartedAt
  }));
  assert.equal(parsed.executionSince, currentRunStartedAt);
  assert.equal(parsed.executionTime, Date.parse(currentRunStartedAt));
  assert.equal(executionStopwatch(parsed.executionSince, Date.parse('2026-07-10T10:37:12.000Z')), '02:05');
  assert.match(mobile, /fetch\('\/api\/control-room', \{ cache: 'no-store', signal: owner\?\.signal, headers:/);
  assert.doesNotMatch(mobile, /api\/codex\/pipelines\/runs\/\$\{encodeURIComponent\(pipelineRunId\)\}/);
  assert.doesNotMatch(mobile, /api\/codex\/skills\/runs\/\$\{encodeURIComponent\(runId\)\}/);
});

test('does not use persisted task metadata as the Codex execution timer', () => {
  const logicalLaunch = '2026-07-10T10:30:00.000Z';
  const markdown = task().markdown.replace('#task-waiting', '#task-execution').replace('Waiting since:', `Active since: ${logicalLaunch}\nWaiting since:`);
  const parsed = parseMasterTaskMarkdown(task({
    markdown,
    codexRunId: 'run-current',
    codexStatus: 'running'
  }));
  assert.equal(parsed.executionSince, '');
  assert.equal(Number.isNaN(parsed.executionTime), true);
  assert.doesNotMatch(mobile, /codexStartedAt = String\(payload\.startedAt/);
});

test('shows queued Codex pipelines in Exec with their one-based position', () => {
  const result = deriveControlRoom([task({
    codexPipelineRunId: 'pipeline-queued',
    codexStatus: 'pending',
    codexQueuePosition: 2
  })]);
  assert.equal(result.queue.length, 0);
  assert.equal(result.exec[0].codexQueued, true);
  assert.equal(result.exec[0].codexQueuePosition, 2);
  assert.match(mobile, /Queued · position \$\{task\.codexQueuePosition\}/);
  assert.match(styles, /\.task-queue-position \{[^}]*white-space: nowrap/);
});

test('ignores persisted pending execution without a queue observation', () => {
  const result = deriveControlRoom([task({
    executionStatus: 'pending',
    codexStatus: 'unknown',
    codexQueuePosition: null,
  })]);
  assert.equal(result.queue.length, 1);
  assert.equal(result.exec.length, 0);
});

test('Control Room resolves Process Card runs through the shared current-run pointer', () => {
  const processCardRunId = cardCodexRunId({
    codexActiveRunId: 'codex-skill-pipeline',
    codexThreadRunId: 'codex-skill-thread',
    codexRunId: 'codex-skill-card'
  });
  assert.equal(processCardRunId, 'codex-skill-pipeline');
  assert.equal(cardCodexRunId({ codexThreadRunId: 'codex-skill-thread' }), 'codex-skill-thread');
  assert.equal(cardCodexRunId({ codexRunId: 'codex-skill-card' }), 'codex-skill-card');
  const markdown = task().markdown.replace('#task-waiting', '#task-execution').replace('Waiting since:', 'Active since: 2026-07-10T10:30:00.000Z\nWaiting since:');
  const result = deriveControlRoom([task({ markdown, codexRunId: processCardRunId, codexStatus: 'running' })]);
  assert.deepEqual(result.exec.map((entry) => entry.cardId), ['card-a']);
  assert.equal(result.queue.length, 0);
  assert.match(mobile, /const nextControlRoom = await response\.json\(\)[\s\S]*state\.controlRoom = nextControlRoom/);
  assert.doesNotMatch(mobile, /const runId = cardCodexRunId\(card\)/);
});

test('ignores task tag examples in ordinary Markdown prose', () => {
  const parsed = parseMasterTaskMarkdown(task({ markdown: 'This specification documents `#master-task`, `#task-waiting`, and `#task-execution`.' }));
  assert.equal(parsed.valid, false);
  assert.equal(parsed.diagnostics.includes('missing master-task label'), true);
  assert.equal(deriveControlRoom([{ ...task(), markdown: parsed.markdown }]).diagnostics.length, 0);
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
    cardStatus: 'backlog',
    markdown: '#master-task #task-waiting #task-execution\n\nLedger: Tasks\n\n## Subtasks\n'
  });
  const result = deriveControlRoom([malformed]);
  assert.deepEqual(result.backlog.map((entry) => entry.cardId), ['malformed']);
  assert.deepEqual(result.diagnostics.map((entry) => entry.cardId), ['malformed']);
});

test('parks and restores master tasks through the shared card status mutation', () => {
  assert.match(mobile, /delayButton\.textContent = backlog \? 'Restore to queue' : 'Move to backlog'/);
  assert.doesNotMatch(mobile, /Park task|Parking task/);
  assert.match(mobile, /const nextStatus = backlog \? 'todo' : 'backlog'/);
  assert.match(mobile, /ledgerMutation\(state\.activeLedgerId, \{ action: 'patch-card', cardPatch: \{ id: card\.id, status: nextStatus \} \}\)/);
  assert.match(mobile, /controlRoomPath\(nextStatus === 'backlog' \? 'backlog' : 'queue'\)/);
  assert.match(mobile, /backlog: 'No backlog tasks'/);
});

test('formats a stable waiting age', () => {
  assert.equal(waitingAge('2026-07-10T10:00:00.000Z', Date.parse('2026-07-12T10:00:00.000Z')), '2d waiting');
});

test('formats the exact executing Codex session duration as a minute-second stopwatch', () => {
  assert.equal(executionStopwatch('2026-07-12T10:00:00.000Z', Date.parse('2026-07-12T10:03:07.999Z')), '03:07');
  assert.equal(executionStopwatch('2026-07-12T10:00:00.000Z', Date.parse('2026-07-12T11:02:03.000Z')), '62:03');
});

test('renders every Control Room task as the same direct-link card without disclosure details', () => {
  assert.match(mobile, /runtimeStatus\.className = 'task-stopwatch'/);
  assert.match(mobile, /summary\.addEventListener\('click'[\s\S]*navigate\(pathForTask\(task\)\)/);
  const row = mobile.slice(mobile.indexOf('function taskRow('), mobile.indexOf('function renderControlRoom()'));
  assert.doesNotMatch(row, /aria-expanded|control-task-details|task-chevron|subtask-row/);
  assert.doesNotMatch(styles, /control-task-details|task-chevron/);
  assert.doesNotMatch(html, /control-diagnostics|Markdown diagnostics/);
  assert.doesNotMatch(mobile, /control-diagnostics/);
  assert.doesNotMatch(styles, /control-diagnostics/);
  assert.match(row, /article\.append\(summary\);[\s\S]*return article;/);
  assert.match(mobile, /\['queue', 'exec', 'backlog'\]\.map/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /initializeQueueSortable\(\)/);
});

test('uses the full desktop pane and gives every Kanban column its own vertical scroll', () => {
  assert.match(styles, /\.content:has\(> \.control-room:not\(\[hidden\]\)\) \{[^}]*max-width: none;[^}]*height: calc\(100dvh - 64px\);[^}]*overflow: hidden;/);
  assert.match(styles, /\.control-room:not\(\[hidden\]\) \{[^}]*grid-template-rows: max-content minmax\(0, 1fr\) auto auto;[^}]*min-height: 0;[^}]*height: 100%;/);
  assert.match(styles, /\.control-command \{[^}]*position: static;/);
  assert.doesNotMatch(styles, /\.control-command \{[^}]*top: 64px;/);
  assert.match(styles, /\.control-task-list \{[^}]*align-items: stretch;[^}]*min-height: 0;/);
  assert.match(styles, /\.control-task-column-list \{[^}]*min-height: 0;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;[^}]*scrollbar-gutter: stable;/);
});

test('remembers and restores every Control Room column scroll position in runtime memory', () => {
  assert.match(mobile, /const controlRoomColumnScrollTop = \{ queue: 0, exec: 0, backlog: 0 \}/);
  assert.match(mobile, /function rememberControlRoomColumnScroll\(list\)[\s\S]*controlRoomColumnScrollTop\[column\] = Math\.max\(0, scrollTop\)[\s\S]*initializedControlRoomColumns\.add\(column\)/);
  assert.match(mobile, /function captureControlRoomColumnScroll\(\) \{\s*if \(elements\['control-room-view'\]\.hidden\) return;/);
  assert.match(mobile, /function renderControlRoom\(\) \{\s*captureControlRoomColumnScroll\(\);[\s\S]*replaceChildren\(\.\.\.columns\);\s*restoreControlRoomColumnScroll\(\);/);
  assert.match(mobile, /list\.addEventListener\('scroll', \(\) => rememberControlRoomColumnScroll\(list\), \{ passive: true \}\)/);
  assert.match(mobile, /list\.scrollTop = Math\.min\(controlRoomColumnScrollTop\[column\], maximum\)/);
  assert.doesNotMatch(mobile, /(?:localStorage|sessionStorage).*controlRoomColumnScrollTop/);
});

test('delegates touch sorting and animation to vendored SortableJS', () => {
  assert.match(bootApplication, /sortable-1\.15\.7\.min\.js/);
  assert.match(mobile, /globalThis\.Sortable\.create\(list,/);
  assert.match(mobile, /name: 'control-room-workflow'/);
  assert.match(mobile, /sort: list\.dataset\.controlColumnList === 'queue'/);
  assert.match(mobile, /animation:\s*180/);
  assert.match(mobile, /forceFallback:\s*true/);
  assert.match(mobile, /fallbackOnBody:\s*true/);
  assert.match(mobile, /fallbackTolerance:\s*4/);
  assert.match(mobile, /delay:\s*300/);
  assert.match(mobile, /delayOnTouchOnly:\s*true/);
  assert.match(mobile, /touchStartThreshold:\s*8/);
  assert.match(mobile, /onStart\(event\)[\s\S]*queueDragActive = true/);
  assert.match(mobile, /onEnd\(event\)[\s\S]*persistControlTaskPlacement[\s\S]*syncQueueFromDom\(\)[\s\S]*settleQueueDrag/);
  assert.match(mobile, /pointercancel[\s\S]*interruptQueueDrag/);
  assert.match(mobile, /touchcancel[\s\S]*interruptQueueDrag/);
  assert.match(mobile, /removeQueueDragArtifacts/);
  assert.doesNotMatch(mobile, /setPointerCapture|pointermove|control-task-placeholder|task-drag-handle/);
  assert.match(styles, /\.queue-task-fallback[^}]*opacity:\s*1\s*!important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('persists optimistic ranks without a success reload and reconciles the latest failure', () => {
  const persistence = mobile.slice(mobile.indexOf('function queueQueueOrderPersistence()'), mobile.indexOf('async function activateMasterTask'));
  assert.doesNotMatch(persistence, /task\.markdown|withQueueRank/);
  assert.match(persistence, /if \(task\.queueRank === queueRank\) return \[\]/);
  assert.match(persistence, /task\.queueRank = queueRank/);
  assert.match(persistence, /cardPatch: \{ id: task\.cardId, queueRank \}/);
  assert.match(persistence, /queuePersistenceTail = queuePersistenceTail\.then/);
  assert.match(persistence, /return persistQueueOrder\(mutations\)/);
  assert.doesNotMatch(persistence.slice(0, persistence.indexOf('void queuePersistenceTail.then')), /renderControlRoom\(\)/);
  assert.match(persistence, /for \(const \{ task, queueRank \} of mutations\)/);
  assert.doesNotMatch(persistence, /Promise\.all/);
  assert.match(persistence, /sequence !== queuePersistenceSequence/);
  assert.match(persistence, /await loadControlRoom\(\{ force: true \}\);[\s\S]*setView\('error-view'\)/);
});

test('persists optimistic Queue and Backlog placement and reconciles rejected changes', () => {
  const persistence = mobile.slice(mobile.indexOf('async function persistControlTaskPlacement'), mobile.indexOf('async function activateMasterTask'));
  assert.match(persistence, /state\.controlRoom\[sourceTab\] = source\.filter/);
  assert.match(persistence, /target\.splice\(insertionIndex, 0, task\)/);
  assert.match(persistence, /cardPatch: \{ id: task\.cardId, status: targetTab === 'backlog' \? 'backlog' : 'todo' \}/);
  assert.match(persistence, /if \(targetTab === 'queue'\) queueQueueOrderPersistence\(\)/);
  assert.match(persistence, /catch \(error\)[\s\S]*await loadControlRoom\(\{ force: true \}\)[\s\S]*renderControlRoom\(\)/);
  assert.match(mobile, /dataset\.controlColumnList !== 'exec'/);
});

test('defers authoritative Control Room refreshes until the queue gesture settles', () => {
  assert.match(mobile, /queueRefreshBlocked\(\)[\s\S]*queueDragInProgress\(\) \|\| queuePersistenceActive/);
  assert.match(mobile, /deferDuringQueueDrag && queueRefreshBlocked\(\)[\s\S]*pendingControlRoomRefresh = true/);
  assert.match(mobile, /refreshControlRoomFromEvent\(\)[\s\S]*queueRefreshBlocked\(\)[\s\S]*pendingControlRoomRefresh = true/);
  assert.match(mobile, /flushPendingControlRoomRefresh/);
});

test('omits the next-subtask subtitle when no actionable subtask exists', () => {
  assert.doesNotMatch(mobile, /No actionable subtask/);
  assert.match(mobile, /task\.nextSubtask \|\| executing \? '<span class="task-next"><\/span>' : ''/);
  assert.match(mobile, /if \(nextSubtask\) nextSubtask\.textContent = `Next: \$\{task\.nextSubtask\.title\}`/);
});

test('omits completed-subtask progress from task-row metadata', () => {
  assert.match(mobile, /textContent = `\$\{task\.projectName\} · \$\{taskOwner\} · \$\{task\.ledger\} · \$\{age\}\$\{process\}`/);
  assert.doesNotMatch(mobile, /task\.complete\}\/\$\{task\.subtasks\.length\} complete/);
});

test('keeps scoped Control Room filters while project editing moves to dedicated routes', () => {
  assert.doesNotMatch(html, /id="project-links"|class="project-nav-section"/);
  assert.match(html, /id="projects-view"/);
  assert.match(html, /class="project-settings-modal"/);
  assert.match(html, /id="control-project-filters"/);
  assert.match(mobile, /state\.projectFilter === 'All'/);
  assert.match(mobile, /projectTasks\.filter\(\(task\) => task\.ledgerId === state\.controlFilter\)/);
  assert.doesNotMatch(styles, /\.project-link input\[type="color"\]/);
  assert.match(mobile, /saveProjectSettingsRequest\(\{/);
  assert.match(mobile, /renderProjectDetail\(result\.project\)/);
  assert.match(mobile, /state\.projects\.find\(\(entry\) => entry\.id === state\.resourceProjectId\)\?\.name \|\| project\.projectName/);
});

test('uses the pinned app-owned HSV picker with the Brave slider hierarchy', () => {
  assert.match(bootApplication, /nouislider-15\.8\.1\.min\.css/);
  assert.match(bootApplication, /nouislider-15\.8\.1\.min\.js/);
  assert.match(html, /id="project-color-hue"/);
  assert.match(html, /id="project-color-saturation"/);
  assert.match(html, /id="project-color-value"/);
  assert.match(html, /class="project-color-picker-swatch"/);
  assert.match(mobile, /hexToHsv\(projectColorPickerOriginal\)/);
  assert.match(mobile, /committedProjectColor\(projectColorPickerOriginal, projectColorPickerHsv\(\), projectColorPickerDirty\)/);
  assert.match(styles, /clip-path: polygon\(50% 0, 100% 27%, 100% 100%, 0 100%, 0 27%\)/);
});

test('creates projects from the projects catalog with the shared creation control', () => {
  assert.match(html, /class="create-button create-project-button"[^>]*>\+ Project<\/button>/);
  assert.match(html, /id="creation-name"[^>]*required[^>]*maxlength="120"/);
  assert.match(html, /id="creation-description"[^>]*maxlength="1000"/);
  assert.match(html, /class="creation-directory-browser"[^>]*aria-label="Project directory browser"/);
  assert.match(html, /class="creation-directory-tree"[^>]*role="tree"[^>]*aria-label="Directories"/);
  assert.doesNotMatch(html, /Use this directory/);
  assert.match(mobile, /project: \['New project', 'Project name', 'Create project'\]/);
  assert.match(mobile, /kind !== 'card' && kind !== 'project'/);
  assert.match(mobile, /await createProjectRequest\(\{ fetchImpl: fetch, name, description, directory \}\)/);
  assert.match(mobile, /projectDirectoryListings\.set\(path, listing\)/);
  assert.match(mobile, /aria-expanded/);
  assert.match(mobile, /if \(!directory\) throw new Error\('Choose a project directory\.'\)/);
  assert.match(mobile, /state\.projects = \[\.\.\.state\.projects, project\]\.sort/);
  assert.match(mobile, /navigate\(projectPath\(project\.id\)\)/);
  assert.match(mobile, /create-project-button'\)\.addEventListener\('click', \(\) => openCreationModal\('project'\)\)/);
});

test('derives resource request scope exclusively from canonical URLs', () => {
  assert.match(mobile, /installProjectRequestScope\(\)/);
  assert.match(mobile, /const scope = parseProjectScope\(location\.pathname\)/);
  assert.doesNotMatch(mobile, /setProjectRequestProjectId|activeProjectId|selectProject/);
  assert.doesNotMatch(mobile, /document\.cookie/);
  assert.match(mobile, /cardPathForProject\(task\.projectId, task\.ledgerId/);
});

test('requires an explicit project choice before creating a new task intake', () => {
  assert.match(html, /class="new-task-project-modal"/);
  assert.match(html, /The task and its Codex run will use this project workspace\./);
  assert.match(mobile, /document\.querySelectorAll\('\.new-task-button'\)\.forEach\(\(button\) => button\.addEventListener\('click', openNewTaskProjectModal\)\)/);
  assert.match(mobile, /await createTaskIntake\(project\.id, project\.selectedReplicaNodeId\)/);
  assert.match(mobile, /async function createTaskIntake\(projectId, replicaNodeId\) \{\s*setResourceProject\(projectId\)/);
  const projectPicker = mobile.slice(mobile.indexOf('function openNewTaskProjectModal()'), mobile.indexOf('function cardOverlapArea'));
  assert.match(html, /class="new-task-node-tabs" role="tablist" aria-label="Choose a node"/);
  assert.match(html, /id="new-task-project-panel" class="new-task-project-list" role="tabpanel"/);
  assert.match(projectPicker, /const defaultNode = nodes\.find\(\(node\) => node\.local\) \?\? nodes\[0\]/);
  assert.match(projectPicker, /label\.textContent = node\.label;[\s\S]*presence\.textContent = node\.online \? 'Online' : 'Offline'/);
  assert.match(projectPicker, /label\.textContent = project\.name;[\s\S]*button\.append\(label\)/);
  assert.doesNotMatch(projectPicker, /projectPresenceLabel\(project\)|project\.id\}`|aria-label.*project\.id/);
  assert.doesNotMatch(projectPicker, /project\.relativePath|Project workspace/);
  assert.match(styles, /\.new-task-node-tabs \{[^}]*display: flex;[^}]*overflow-x: auto/);
  assert.match(styles, /\.new-task-node-tab\[aria-selected="true"\]/);
  assert.match(styles, /\.new-task-project-list \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.new-task-project-option \{[^}]*min-height: 56px;[^}]*padding: 8px 10px;[^}]*text-align: center/);
  assert.match(styles, /\.new-task-project-option \{[^}]*border-inline-start: 4px solid var\(--project-color/);
});

test('drills from one compact full-color project row into one ledger row with a trailing clear action', () => {
  assert.match(mobile, /const showProjectFilters = state\.projectFilter === 'All'/);
  assert.match(mobile, /className = `project-filter-chip\$\{project\.id === 'All' \? ' all-projects-filter' : ''\}`/);
  assert.match(mobile, /button\.style\.setProperty\('--project-color', project\.color\)/);
  assert.match(mobile, /elements\['control-project-filters'\]\.hidden = !showProjectFilters/);
  assert.match(mobile, /replaceChildren\(\.\.\.\(showProjectFilters \? projectButtons : \[\]\)\)/);
  assert.match(mobile, /elements\['control-filters'\]\.hidden = showProjectFilters/);
  assert.match(mobile, /replaceChildren\(\.\.\.\(showProjectFilters \? \[\] : \[\.\.\.ledgerButtons, clearProject\]\)\)/);
  assert.match(mobile, /clearProject\.textContent = 'Clear'/);
  assert.match(mobile, /state\.projectFilter = 'All';\s*state\.controlFilter = 'All';\s*renderControlRoom\(\)/);
  assert.match(styles, /\.control-filters\[hidden\] \{ display: none; \}/);
  assert.match(styles, /\.project-filter-chip \{[^}]*min-height: 34px;[^}]*background: var\(--project-color\)/);
  assert.match(styles, /\.filter-clear-button \{ margin-left: 8px;/);
});

test('keeps task metadata in Markdown but removes it from the visible card body', () => {
  const visible = visibleMasterTaskMarkdown(task().markdown);
  assert.doesNotMatch(visible, /#master-task|Ledger:|Waiting since:|Status:/);
  assert.doesNotMatch(visible, /\[Research\]\(card:card-r\)/);
});

test('lays mobile carousel controls over the image with touch-safe navigation', () => {
  assert.match(styles, /\.ledger-card-media-shell \{ position: relative;[^}]*aspect-ratio:/);
  assert.match(styles, /\.ledger-card-media-track \{[^}]*height: 100%;[^}]*overflow: visible;[^}]*touch-action: pan-y;[^}]*will-change: transform;/);
  assert.match(styles, /\.ledger-card-media-title \{ position: absolute;[^}]*bottom: 48px;[^}]*border-radius: 999px;/);
  assert.match(styles, /\.ledger-card-media-nav \{ position: absolute;[^}]*inset: 8px;[^}]*justify-content: space-between;/);
  assert.match(styles, /\.ledger-card-media-button \{[^}]*width: 42px;[^}]*height: 52px;[^}]*border-radius: 999px;/);
  assert.match(styles, /\.ledger-card-media-slide-nav \{ position: absolute;[^}]*bottom: 12px;/);
  assert.match(styles, /\.ledger-card-media-slide-button\.is-active \{/);
});

test('drives mobile carousels with pinned dependency-free Embla physics', () => {
  assert.match(bootApplication, /\/assets\/vendor\/embla-carousel-8\.6\.0\.umd\.js/);
  assert.match(embla, /\.EmblaCarousel=/);
  assert.match(mobile, /carouselDriver: 'external'/);
  assert.match(mobile, /globalThis\.EmblaCarousel\(shell, \{/);
  assert.match(mobile, /dragFree: false/);
  assert.match(mobile, /slidesToScroll: 1/);
  assert.match(mobile, /skipSnaps: false/);
  assert.match(mobile, /duration: 25/);
  assert.match(mobile, /api\.scrollPrev\(\)/);
  assert.match(mobile, /api\.scrollNext\(\)/);
  assert.match(mobile, /api\.scrollTo\(index\)/);
  assert.match(mobile, /api\.on\('pointerDown', hideTitles\)[\s\S]*\.on\('settle', revealTitle\)/);
  assert.match(mobile, /instance\?\.api\.destroy\(\)/);
});

test('serves the pinned Panzoom fullscreen viewer on the mobile carousel surface', () => {
  assert.match(panzoom, /Panzoom 4\.6\.2/);
  assert.match(styles, /\.ledger-card-media-fullscreen \{ position: absolute; top: 14px; right: 14px;[^}]*opacity: 0; pointer-events: none;/);
  assert.match(styles, /\.ledger-card-media-slide\.is-fullscreen-control-visible \.ledger-card-media-fullscreen,[^{]*\{ opacity: 1; pointer-events: auto;/);
  assert.match(styles, /\.ledger-card-image-viewer-stage \{[^}]*touch-action: none;/);
  assert.match(styles, /\.ledger-card-image-viewer-close \{ position: fixed; top: max\(16px, env\(safe-area-inset-top\)\); right: max\(16px, env\(safe-area-inset-right\)\);/);
});

test('shows the settled image title for one second and then fades it out', () => {
  assert.match(mobile, /const revealTitle = \(\) => \{/);
  assert.match(mobile, /const hideTitles = \(\) => \{/);
  assert.match(mobile, /slides\[api\.selectedScrollSnap\(\)\]\?\.querySelector\('\.ledger-card-media-title'\)/);
  assert.match(mobile, /title\.classList\.add\('is-visible'\)/);
  assert.match(mobile, /setTimeout\(\(\) => \{[\s\S]*title\.classList\.remove\('is-visible'\)[\s\S]*\}, 1000\)/);
  assert.match(mobile, /if \(instance\?\.titleTimer\) clearTimeout\(instance\.titleTimer\)/);
  assert.match(styles, /\.ledger-card-media-title \{[^}]*opacity: 0;[^}]*transition: opacity 260ms ease;/);
  assert.match(styles, /\.ledger-card-media-title\.is-visible \{ opacity: 1; \}/);
});

test('parses letter-prefixed card sections from the decision-os formatting contract', () => {
  const markdown = task().markdown.replace('## Subtasks', '## B. Subtasks');
  const parsed = parseMasterTaskMarkdown(task({ markdown }));
  assert.equal(parsed.subtasks.length, 2);
  assert.equal(parsed.complete, 1);
  assert.equal(parsed.nextSubtask.cardId, 'card-b');
});

test('routes master-task cards back to the control room and regular cards back to their zone', () => {
  assert.match(mobile, /backButton\.replaceChildren\(backIcon, backLabel\)/);
  assert.match(mobile, /backButton\.dataset\.destination = parsedTask\.masterTask \? 'control-room' : 'zone'/);
  assert.match(mobile, /const controlRoomDestination = event\.currentTarget\.dataset\.destination === 'control-room';[\s\S]*const destination = controlRoomDestination \? controlRoomPath\(state\.controlTab\) : zonePath/);
});

test('commits retained Control Room and task-shell views before background route reads', () => {
  const navigate = mobile.match(/function navigate\(path, replace = false\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const commitRouteView = mobile.match(/function commitRouteView\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const loadRoute = mobile.match(/async function loadRoute\(\{ retainView = false \} = \{\}\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(navigate, /history\[replace[\s\S]*commitRouteView\(\)[\s\S]*void loadRoute\(\{ retainView: retained \}\)/);
  assert.match(commitRouteView, /location\.pathname === '\/' && state\.controlRoom[\s\S]*renderControlRoom\(\)/);
  assert.match(commitRouteView, /isProjectCardPath\(location\.pathname\)[\s\S]*renderTaskReplicaShell\(task\)/);
  assert.match(loadRoute, /if \(!retainView\) setView\('loading-view'\)/);
  assert.match(mobile, /response\.status === 202[\s\S]*renderTaskReplicaShell[\s\S]*loadRoute\(\{ retainView: true \}\)/);
});

test('renders accessible replica states and task-detail skeletons', () => {
  assert.match(mobile, /task-replica-status is-\$\{task\.replica/);
  assert.match(mobile, /shell\.setAttribute\('role', 'status'\)/);
  assert.match(mobile, /shell\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(styles, /\.task-replica-skeleton/);
  assert.match(styles, /@keyframes replica-skeleton/);
});

test('renders and persists the shared carousel resize handle in a Control Room master-card detail', () => {
  assert.match(mobile, /cardId: parsedTask\.masterTask \? String\(card\.id\) : undefined/);
  assert.match(mobile, /mediaSurface: parsedTask\.masterTask \? 'detail' : 'thread'/);
  assert.match(mobile, /onImageResize: parsedTask\.masterTask \? persistCardImageResize : undefined/);
  assert.match(mobile, /cardPatch: \{ id: card\.id, imageSizes: card\.imageSizes \}/);
  assert.match(mobile, /card\.imageSizes = previousImageSizes;\s*if \(state\.activeCardId === String\(card\.id\)\) renderCard\(card\)/);
  assert.match(mediaRenderer, /const cardResizeHandle = mediaSurface !== 'thread' \? renderCardImageResizeHandle/);
  assert.match(bootApplication, /responsive-interact-script[^\n]*interact-1\.10\.27\.min\.js/);
  assert.match(styles, /\.ledger-card-media-shell > \.ledger-card-media-resize-handle\s*\{[^}]*position: absolute;[^}]*width: 28px;[^}]*height: 28px;[^}]*cursor: ew-resize;[^}]*touch-action: none;/s);
  assert.match(styles, /\.ledger-card-media-resize-handle::before\s*\{[^}]*width: 16px;[^}]*height: 16px;[^}]*content: "";/s);
});

test('offers manual and configured-pipeline completion from the master-task detail', () => {
  assert.match(mobile, /action: 'complete-master-task', masterTaskId: card\.id/);
  assert.match(mobile, /navigate\(completionReturnPath\(\), true\)/);
  assert.match(mobile, /return returnPath\.startsWith\('\/'\) \? returnPath : controlRoomPath\('queue'\)/);
  assert.match(mobile, /manualCompleteButton\.textContent = card\.status === 'done' \? 'Master task complete' : 'Complete manually'/);
  assert.match(mobile, /pipelineCompleteButton\.textContent = 'Complete with pipeline'/);
  assert.match(mobile, /requestCodexPipelineRun\(\{ ledgerId: state\.activeLedgerId, sourceCardId: String\(card\.id\), pipelineId \}\)/);
  assert.match(mobile, /pipelineCompleteButton\.disabled = card\.status === 'done' \|\| !configured/);
  assert.match(mobile, /navigate\(controlRoomPath\('exec'\), true\)/);
  assert.match(mobile, /overview\.append\(status, heading, subtasks, completion\)/);
  assert.match(mobile, /elements\['card-body'\]\.replaceChildren\(overview, content\)/);
  assert.doesNotMatch(mobile, /complete-master-subtask|masterTaskId=|Mark task as done/);
  assert.match(styles, /\.complete-master-task-button \{ width: 100%; min-height: 52px;/);
  assert.match(styles, /\.master-task-completion-actions \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 12px;/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.master-task-completion-actions \{ grid-template-columns: 1fr; \}/);
});

test('deletes a master task from its detail after explicit confirmation', () => {
  assert.match(mobile, /completion\.append\(delayButton, completionActions, deleteButton\)/);
  assert.match(mobile, /deleteMasterTaskModal\.showModal\(\)/);
  assert.match(mobile, /action: 'delete-card', cardId/);
  assert.match(mobile, /navigate\(controlRoomPath\(state\.controlTab\), true\)/);
  assert.match(html, /class="delete-master-task-modal mobile-confirm-modal"/);
  assert.match(html, /Its linked subtask cards are kept\./);
  assert.match(styles, /\.delete-master-task-button \{ width: 100%; min-height: 52px; margin-top: 12px;/);
});

test('keeps four mobile actions and scopes project and node shortcuts to the desktop task-creation modal', () => {
  assert.match(mobile, /destination\('Control room', controlRoomPath\(state\.controlTab\), 'dashboard', 'control-room'\)/);
  assert.match(mobile, /destination\('Projects', projectPath\(\), 'folder', 'projects'\)/);
  assert.match(mobile, /destination\('Ledgers', '\/ledgers', 'book', 'ledgers'\)/);
  assert.match(mobile, /destination\('Pipelines', '\/pipelines', 'flow', 'pipelines', 'nav-pipelines-button'\)/);
  assert.match(mobile, /destination\('Skill library', '\/skills', 'library', 'skills', 'nav-skills-button'\)/);
  assert.doesNotMatch(styles, /\.ledger-link::before/);
  assert.match(styles, /svg\[data-nav-icon="dashboard"\]/);
  assert.doesNotMatch(html, /class="icon-button pipelines-button"/);
  assert.doesNotMatch(html, /class="control-heading"|class="live-dot"/);
  assert.match(html, /data-control-tab="backlog"[\s\S]*class="new-task-button mobile-new-task-button"/);
  assert.match(styles, /grid-template-columns: repeat\(4, 1fr\)/);
  assert.match(html, /desktop-new-task-button terminal-button terminal-button--action[\s\S]*terminal-button__key">X/);
  assert.match(mobile, /new-task-project-option'[\s\S]*button\.append\(shortcutKey\(String\(index \+ 1\)\)\)/);
  assert.match(mobile, /tab\.append\(shortcutKey\('C'\), label, presence\)/);
  assert.match(mobile, /newTaskProjectModal\.onkeydown = \(event\)[\s\S]*key === 'c'[\s\S]*selectNode\(nodes\[next\], true\)[\s\S]*\/\^\[1-9\]\$\/[\s\S]*option\.click\(\)/);
  assert.match(mobile, /desktopControlRoom[\s\S]*!newTaskProjectModal\.open[\s\S]*key === 'x'/);
  assert.doesNotMatch(mobile, /controlRoomNodes|cycleControlRoomNode|controlNodeIndex/);
  assert.doesNotMatch(styles, /\.project-filter-chip \.terminal-button__key|\.node-filter-cycle/);
  assert.match(styles, /\.new-task-node-tab\[aria-selected="true"\] \.terminal-button__key,[\s\S]*\.new-task-project-option \.terminal-button__key \{ display: inline-flex; \}/);
  assert.match(styles, /\.control-room:not\(\[hidden\]\) \{[^}]*grid-template-rows: max-content minmax\(0, 1fr\)/);
  assert.match(styles, /\.control-command \{[^}]*align-self: start;[^}]*align-content: start;[^}]*height: fit-content;/);
  assert.match(html, /class="nav-server-restart-button"/);
  assert.match(mobile, /fetch\('\/api\/server\/restart', \{ method: 'POST' \}\)/);
});
