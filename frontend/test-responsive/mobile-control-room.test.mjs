/** WHAT: Preserves the source responsive Control Room contract. WHY: Task lifecycle, routing, ordering, and display behavior must not regress during unification. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { executionPresentation, executionStopwatch, cardCodexRunId, projectMasterTask, waitingAge } from '../src/app/responsive/control-room.js';
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
  card: { id: 'card-a', title: 'Master A', labels: ['master-task'], lifecycle: { status: 'todo', waitingAt: '2026-07-10T10:00:00.000Z', changedAt: '2026-07-10T10:00:00.000Z', closedAt: null } },
  cards: [
    { id: 'card-r', title: 'Research', labels: [], lifecycle: { status: 'done' } },
    { id: 'card-b', title: 'Build', labels: ['subtask'], lifecycle: { status: 'todo' } },
  ],
  relationships: [
    { id: 'rel-b', from: 'card-a', to: 'card-b', label: 'subtask', position: 1 },
    { id: 'rel-r', from: 'card-a', to: 'card-r', label: 'subtask', position: 0 },
  ],
  ledgerTitle: 'Tasks',
  ...overrides
});

test('projects master-task lifecycle and positioned relationships without Markdown authority', () => {
  const parsed = projectMasterTask(task());
  assert.equal(parsed.valid, true);
  assert.equal(parsed.status, 'task-waiting');
  assert.equal(parsed.complete, 1);
  assert.equal(parsed.nextSubtask.cardId, 'card-b');
  assert.deepEqual(parsed.subtasks.map((entry) => entry.cardId), ['card-r', 'card-b']);
});

test('replicated execution intent is the only local task execution authority', () => {
  const projected = projectMasterTask(task({ card: { ...task().card, executionStatus: 'running', executionIntent: { id: 'intent-a', state: 'running', startedAt: '2026-07-10T10:30:00.000Z' } } }));
  assert.equal(projected.status, 'task-execution');
  assert.equal(projected.executionStatus, 'running');
});

test('replicated subtask execution intent projects the master into Exec', () => {
  const current = task();
  current.cards[1] = { ...current.cards[1], executionIntent: { id: 'run-child', state: 'running', startedAt: '2026-07-10T10:30:00.000Z' } };
  const projected = projectMasterTask(current);
  assert.equal(projected.status, 'task-execution');
  assert.equal(projected.executionStatus, 'running');
  assert.equal(projected.executionOwnerCardId, 'card-b');
  assert.equal(projected.executionOwnerKind, 'subtask');
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

test('reads task execution timing from replicated execution intent', () => {
  const startedAt = '2026-07-10T10:35:07.000Z';
  const parsed = projectMasterTask(task({ card: { ...task().card, executionIntent: { id: 'intent-a', state: 'running', startedAt } } }));
  assert.equal(parsed.executionStatus, 'running');
  assert.equal(executionStopwatch(startedAt, Date.parse('2026-07-10T10:37:12.000Z')), '02:05');
  assert.match(mobile, /fetch\('\/api\/control-room', \{ cache: 'no-store', signal: owner\?\.signal, headers:/);
  assert.doesNotMatch(mobile, /api\/codex\/pipelines\/runs\/\$\{encodeURIComponent\(pipelineRunId\)\}/);
  assert.doesNotMatch(mobile, /api\/codex\/skills\/runs\/\$\{encodeURIComponent\(runId\)\}/);
});

test('renders replicated queued execution supplied by the server projection', () => {
  assert.match(mobile, /executionPresentation\(task\)/);
  assert.equal(executionPresentation({ executionStatus: 'queued', executionSince: '2026-07-10T10:35:07.000Z' }, Date.parse('2026-07-10T10:37:12.000Z')).text, 'Queued · 02:05');
  assert.match(styles, /\.task-queue-position \{[^}]*white-space: nowrap/);
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
  assert.match(mobile, /const nextControlRoom = await response\.json\(\)[\s\S]*state\.controlRoom = nextControlRoom/);
  assert.doesNotMatch(mobile, /const runId = cardCodexRunId\(card\)/);
});

test('ordinary Markdown task tags cannot create a master task', () => {
  const parsed = projectMasterTask(task({ card: { ...task().card, labels: [], comment: { what: '#master-task #task-waiting' } } }));
  assert.equal(parsed.masterTask, false);
  assert.equal(parsed.valid, false);
});

test('parks and restores master tasks through the shared card status mutation', () => {
  assert.match(mobile, /delayButton\.textContent = backlog \? 'Restore to queue' : 'Move to backlog'/);
  assert.doesNotMatch(mobile, /Park task|Parking task/);
  assert.match(mobile, /const nextStatus = backlog \? 'todo' : 'backlog'/);
  assert.match(mobile, /runResponsiveLedgerTransaction\(\{[\s\S]*action: 'transition-card-lifecycle', cardId: card\.id, lifecycleStatus: nextStatus/);
  assert.match(mobile, /applyTaskIntentLocally\(task, \{ kind: 'lifecycle', lifecycleStatus: nextStatus \}\)/);
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
  assert.match(mobile, /function rememberControlRoomColumnScroll\(list\) \{\s*if \(!elements\['control-task-list'\]\.contains\(list\)\) return;[\s\S]*controlRoomColumnScrollTop\[column\] = Math\.max\(0, scrollTop\)[\s\S]*initializedControlRoomColumns\.add\(column\)/);
  assert.match(mobile, /function captureControlRoomColumnScroll\(\) \{\s*if \(elements\['control-room-view'\]\.hidden\) return;\s*if \(controlRoomColumnScrollFrame\) return;/);
  assert.match(mobile, /function renderControlRoom\(\) \{\s*captureControlRoomColumnScroll\(\);[\s\S]*replaceChildren\(\.\.\.columns\);\s*restoreControlRoomColumnScroll\(\);/);
  assert.match(mobile, /list\.addEventListener\('scroll', \(\) => rememberControlRoomColumnScroll\(list\), \{ passive: true \}\)/);
  assert.match(mobile, /list\.scrollTop = Math\.min\(controlRoomColumnScrollTop\[column\], maximum\);[\s\S]*controlRoomColumnScrollFrame = 0;/);
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
  assert.match(mobile, /onEnd\(event\)[\s\S]*persistControlTaskPlacement[\s\S]*settleQueueDrag/);
  assert.doesNotMatch(mobile, /syncQueueFromDom|queueQueueOrderPersistence|persistQueueOrder/);
  assert.match(mobile, /pointercancel[\s\S]*interruptQueueDrag/);
  assert.match(mobile, /touchcancel[\s\S]*interruptQueueDrag/);
  assert.match(mobile, /removeQueueDragArtifacts/);
  assert.doesNotMatch(mobile, /setPointerCapture|pointermove|control-task-placeholder|task-drag-handle/);
  assert.match(styles, /\.queue-task-fallback[^}]*opacity:\s*1\s*!important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('has no Queue-rank parsing or persistence contract', () => {
  assert.doesNotMatch(mobile, /queueRank|Queue rank|withQueueRank/);
  assert.match(mobile, /nextControlRoom\.queue\.sort\(compareControlRoomQueueTasks\)/);
});

test('persists optimistic Queue and Backlog placement and reconciles rejected changes', () => {
  const persistence = mobile.slice(mobile.indexOf('async function persistControlTaskPlacement'), mobile.indexOf('async function activateMasterTask'));
  assert.match(persistence, /state\.controlRoom\[sourceTab\] = source\.filter/);
  assert.match(persistence, /target\.splice\(insertionIndex, 0, task\)/);
  assert.match(persistence, /const lifecycleStatus = targetTab === 'backlog' \? 'backlog' : 'todo'/);
  assert.match(persistence, /cardId: task\.cardId,[\s\S]*lifecycleStatus/);
  assert.match(persistence, /if \(targetTab === 'queue'\) target\.sort\(compareControlRoomQueueTasks\)/);
  assert.match(persistence, /catch \(error\)[\s\S]*await loadControlRoom\(\{ force: true \}\)[\s\S]*renderControlRoom\(\)/);
  assert.match(mobile, /dataset\.controlColumnList !== 'exec'/);
});

test('defers authoritative Control Room refreshes until the queue gesture settles', () => {
  assert.match(mobile, /queueRefreshBlocked\(\)[\s\S]*return queueDragInProgress\(\)/);
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
  assert.match(mobile, /await createTaskIntake\(project\.id, project\.selectedAssignedNodeId, project\.replicaNodeId\)/);
  assert.match(mobile, /async function createTaskIntake\(projectId, assignedNodeId, replicaNodeId = assignedNodeId\) \{\s*setResourceProject\(projectId\)/);
  assert.match(mobile, /replicationState: 'local-only', persistenceState: 'creating'/);
  const intake = mobile.slice(mobile.indexOf('async function createTaskIntake'), mobile.indexOf('function openNewTaskProjectModal'));
  assert.match(intake, /createdAt: timestamp/);
  assert.match(intake, /const assignment = \{ nodeId: assignedNodeId, changedAt: timestamp, revision: 1 \}/);
  assert.match(intake, /ledgerMutation\(ledgerRef\.id, \{ action: 'create-task-intake', assignedNodeId, annotation: zone, card \}, projectId, replicaNodeId\)/);
  assert.match(intake, /ownerNodeId: replicaNodeId,[\s\S]*assignedNodeId,[\s\S]*assignment,/);
  assert.doesNotMatch(intake, /Waiting since:|## Subtasks|relationship-backed card links/);
  assert.match(mobile, /const locallyOwned = localCard\?\.persistenceState === 'creating' \|\| localCard\?\.persistenceState === 'failed';[\s\S]*let card = locallyOwned \? localCard : null;[\s\S]*if \(!card\) \{[\s\S]*projectFetch\(`\/api\/ledgers\/\$\{encodeURIComponent\(ledgerId\)\}\/cards/);
  const projectPicker = mobile.slice(mobile.indexOf('function openNewTaskProjectModal()'), mobile.indexOf('function cardOverlapArea'));
  assert.match(html, /class="new-task-node-tabs" role="tablist" aria-label="Choose a node"/);
  assert.match(html, /id="new-task-project-panel" class="new-task-project-list" role="tabpanel"/);
  assert.match(projectPicker, /const defaultNode = nodes\.find\(\(node\) => node\.local\) \?\? nodes\[0\]/);
  assert.match(projectPicker, /selectedAssignedNodeId: nodeId, replicaNodeId: nodeId/);
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

test('renders card Markdown as narrative without a runtime projection filter', () => {
  assert.match(mobile, /const markdown = ledgerCardBody\(card\);[\s\S]*renderLedgerCardMarkdown\(markdown,/);
  assert.doesNotMatch(mobile, /visibleMasterTaskMarkdown|parseMasterTaskMarkdown/);
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

test('routes master-task cards back to their task list and regular cards back to their zone', () => {
  assert.match(mobile, /backButton\.replaceChildren\(backIcon, backLabel\)/);
  assert.match(mobile, /backButton\.dataset\.destination = parsedTask\.masterTask \? 'control-room' : 'zone'/);
  assert.match(mobile, /const controlRoomDestination = event\.currentTarget\.dataset\.destination === 'control-room';[\s\S]*const destination = controlRoomDestination \? completionReturnPath\(\) : zonePath/);
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

test('renders accessible task states and task-detail skeletons', () => {
  assert.match(mobile, /task-state-status is-\$\{taskState/);
  assert.match(mobile, /shell\.setAttribute\('role', 'status'\)/);
  assert.match(mobile, /shell\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(styles, /\.task-state-skeleton/);
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
  assert.match(mobile, /const requestId = createExecutionRequestId\('pipeline'\)/);
  assert.match(mobile, /beginOptimisticExecution\(executionDetail\)/);
  assert.match(mobile, /requestCodexPipelineRun\(\{ ledgerId: state\.activeLedgerId, sourceCardId: String\(card\.id\), pipelineId, requestId \}\)/);
  assert.match(mobile, /const receipt = result\.receipts\?\.\[0\] \?\? \{\}/);
  assert.match(mobile, /acknowledgeOptimisticExecution\(\{ \.\.\.executionDetail, clientRequestId: executionDetail\.requestId, \.\.\.receipt \}\)/);
  assert.match(mobile, /pipelineCompleteButton\.disabled = card\.status === 'done' \|\| !configured/);
  assert.match(mobile, /navigate\(controlRoomPath\('exec'\), true\)/);
  assert.match(mobile, /overview\.append\(status, heading, subtasks, completion\)/);
  assert.match(mobile, /elements\['card-body'\]\.replaceChildren\(overview, \.\.\.\(persistenceFailure \? \[persistenceFailure\] : \[\]\), content\)/);
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
  assert.match(mobile, /destination\('Done', '\/done', 'check', 'done'\)/);
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

test('renders completed tasks in one project-first, date-sorted navigation list', () => {
  assert.match(html, /id="done-view"/);
  assert.match(html, /id="done-search"[^>]*placeholder="Search completed tasks"/);
  assert.match(html, /id="done-sort"[\s\S]*value="desc">Newest first[\s\S]*value="asc">Oldest first/);
  assert.match(html, /id="done-project-filter-group"/);
  assert.match(html, /id="done-label-filter-group" hidden/);
  assert.match(html, /id="done-project-filters"/);
  assert.match(html, /id="done-label-filters"/);
  assert.match(mobile, /owner\.route\.pathname === '\/done'/);
  assert.match(mobile, /const tasks = state\.controlRoom\?\.done \?\? \[\]/);
  assert.match(mobile, /filterCompletedTasks\(tasks/);
  assert.match(mobile, /completedTaskLabels\(projectScopedTasks\)/);
  assert.match(mobile, /task\.status === 'task-complete'[\s\S]*\? completedLabel/);
  assert.match(mobile, /const showProjectFilters = state\.doneProjectFilter === 'All'/);
  assert.match(mobile, /elements\['done-project-filter-group'\]\.hidden = !showProjectFilters/);
  assert.match(mobile, /elements\['done-label-filter-group'\]\.hidden = showProjectFilters/);
  assert.match(mobile, /order: state\.doneSort/);
  assert.match(styles, /\.done-task-list \{ display: grid; gap: 12px;/);
  assert.match(styles, /\.done-task-list \{ grid-template-columns: minmax\(0, 1fr\); gap: 16px; \}/);
  assert.doesNotMatch(styles, /\.done-task-list \{ grid-template-columns: repeat\(2,/);
  assert.match(styles, /\.task-labels \{ display: flex; flex-wrap: wrap;/);
});
