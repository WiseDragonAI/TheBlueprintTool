import { renderLedgerCardMarkdown } from '/canvas-src/runtime/ledger/component/render-ledger-card-markdown.js';
import { ledgerCardBody } from '/canvas-src/runtime/ledger/helper/ledger-card-body.js';
import { initializeMobileThread, openMobileThread, setMobileThreadCard, syncMobileThreadContext } from './mobile-thread.js';
import { initializeMobileCodex, setMobileCodexContext } from './mobile-codex.js';
import { activeAge, activeStopwatch, deriveControlRoom, parseMasterTaskMarkdown, visibleMasterTaskMarkdown, waitingAge, withActiveStatus, withQueueRank } from './mobile-control-room.js';
import { controlRoomPath, parseControlRoomRoute } from './mobile-control-room-route.js';

const state = {
  projectName: 'decision-os',
  ledgers: [],
  ledger: null,
  activeLedgerId: '',
  activeZoneId: '',
  activeZoneColor: '',
  activeCardId: '',
  query: '',
  controlRoom: null,
  controlTab: 'queue',
  controlFilter: 'All',
  draggedTaskId: ''
};

const elements = Object.fromEntries([
  'project-name', 'ledger-links', 'loading-view', 'error-view', 'error-message', 'empty-view',
  'overview-view', 'overview-summary', 'overview-ledgers', 'ledger-view', 'ledger-title', 'ledger-summary',
  'zone-list', 'zone-view', 'zone-title', 'zone-summary', 'card-search', 'card-list',
  'no-results', 'card-view', 'card-title', 'card-body', 'control-room-view', 'control-filters',
  'control-task-list', 'control-empty', 'control-diagnostics'
].map((id) => [id, document.getElementById(id)]));

const asText = (value) => value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const routeParts = () => location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
const creationModal = document.querySelector('.creation-modal');
const creationForm = document.querySelector('.creation-form');
let creationKind = '';
let controlRoomScrollFrame = 0;

function setView(name) {
  for (const id of ['loading-view', 'error-view', 'empty-view', 'overview-view', 'control-room-view', 'ledger-view', 'zone-view', 'card-view']) {
    elements[id].hidden = id !== name;
  }
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  document.querySelector('.menu-button').setAttribute('aria-expanded', 'false');
}

function openMenu() {
  document.body.classList.add('menu-open');
  document.querySelector('.menu-button').setAttribute('aria-expanded', 'true');
}

function ledgerPath(ledgerId) {
  return `/${encodeURIComponent(ledgerId)}`;
}

function zonePath(ledgerId, zoneId) {
  return `${ledgerPath(ledgerId)}/zone/${encodeURIComponent(zoneId)}`;
}

function cardPath(ledgerId, zoneId, cardId) {
  return `${zonePath(ledgerId, zoneId)}/card/${encodeURIComponent(cardId)}`;
}

function pathForTask(task) {
  const ledger = state.controlRoom?.documents?.find((entry) => entry.ledgerId === task.ledgerId)?.document;
  const previous = state.ledger;
  state.ledger = ledger;
  const zone = ledgerZones().find((entry) => entry.cards.some((card) => String(card.id) === task.cardId));
  state.ledger = previous;
  return cardPath(task.ledgerId, zone?.id ?? 'ungrouped', task.cardId);
}

function navigate(path, replace = false) {
  const returnPath = `${location.pathname}${location.search}${location.hash}`;
  history[replace ? 'replaceState' : 'pushState']({ returnPath }, '', path);
  closeMenu();
  void loadRoute();
}

function completionReturnPath() {
  const returnPath = asText(history.state?.returnPath);
  return returnPath.startsWith('/') ? returnPath : '/';
}

function objectId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function openCreationModal(kind) {
  creationKind = kind;
  const labels = {
    ledger: ['New ledger', 'Ledger name', 'Create ledger'],
    zone: ['New zone', 'Zone name', 'Create zone'],
    card: ['New card', 'Card title', 'Create card']
  };
  const [title, placeholder, submit] = labels[kind];
  document.querySelector('#creation-title').textContent = title;
  document.querySelector('#creation-kind').textContent = `Create ${kind}`;
  const name = document.querySelector('#creation-name');
  name.value = '';
  name.placeholder = placeholder;
  document.querySelector('#creation-description').value = '';
  document.querySelector('.creation-description-field').hidden = kind !== 'card';
  document.querySelector('.creation-color-field').hidden = kind !== 'zone';
  document.querySelector('.creation-submit').textContent = submit;
  document.querySelector('.creation-error').hidden = true;
  creationModal.showModal();
  name.focus();
}

async function ledgerMutation(ledgerId, mutation) {
  const response = await fetch(`/decision-os/${encodeURIComponent(ledgerId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

function nextZoneRect() {
  const zones = (state.ledger?.annotations ?? []).filter((zone) => zone?.variant !== 'group' && typeof zone?.color === 'string');
  if (!zones.length) return { x: 0, y: 0, width: 1200, height: 900 };
  const left = Math.min(...zones.map((zone) => Number(zone.x ?? 0)).filter(Number.isFinite));
  const bottom = Math.max(...zones.map((zone) => Number(zone.y ?? 0) + Number(zone.height ?? zone.h ?? 0)).filter(Number.isFinite));
  return { x: Number.isFinite(left) ? left : 0, y: Number.isFinite(bottom) ? bottom + 120 : 0, width: 1200, height: 900 };
}

function nextCardRect(zone) {
  const zoneWidth = Math.max(340, Number(zone.width ?? zone.w ?? 1200));
  const zoneHeight = Math.max(260, Number(zone.height ?? zone.h ?? 900));
  const padding = 60;
  const gap = 40;
  const width = Math.max(220, Math.min(320, zoneWidth - padding * 2));
  const height = 180;
  const columns = Math.max(1, Math.floor((zoneWidth - padding * 2 + gap) / (width + gap)));
  const existing = Array.isArray(zone.cards) ? zone.cards : [];
  let index = 0;
  let column = 0;
  let row = 0;
  for (; index < existing.length + 200; index += 1) {
    column = index % columns;
    row = Math.floor(index / columns);
    const candidate = {
      x: Number(zone.x ?? 0) + padding + column * (width + gap),
      y: Number(zone.y ?? 0) + padding + row * (height + gap),
      w: width,
      h: height
    };
    const occupied = existing.some((card) => {
      const cardX = Number(card.x ?? 0);
      const cardY = Number(card.y ?? 0);
      const cardWidth = Number(card.w ?? card.width ?? 280);
      const cardHeight = Number(card.h ?? card.height ?? 132);
      return candidate.x < cardX + cardWidth + gap && candidate.x + candidate.w + gap > cardX
        && candidate.y < cardY + cardHeight + gap && candidate.y + candidate.h + gap > cardY;
    });
    if (!occupied) break;
  }
  const rect = {
    x: Number(zone.x ?? 0) + padding + column * (width + gap),
    y: Number(zone.y ?? 0) + padding + row * (height + gap),
    width,
    height
  };
  const requiredHeight = padding + (row + 1) * height + row * gap + padding;
  return { rect, requiredZoneHeight: Math.max(zoneHeight, requiredHeight) };
}

async function createLedger(name) {
  const response = await fetch('/decision-os/ledgers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: name })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false || !payload?.tab?.id) throw new Error(payload?.error || 'Could not create ledger.');
  state.ledger = null;
  navigate(ledgerPath(payload.tab.id));
}

async function createZone(name, color) {
  const rect = nextZoneRect();
  const annotation = { id: objectId('zone'), ...rect, color, label: name, comments: [] };
  state.ledger = await ledgerMutation(state.activeLedgerId, { action: 'create-zone', annotation });
  navigate(zonePath(state.activeLedgerId, annotation.id));
}

async function createCard(name, description) {
  const zone = ledgerZones().find((entry) => String(entry.id) === state.activeZoneId);
  if (!zone || zone.id === 'ungrouped') throw new Error('Choose a canvas zone before creating a card.');
  const { rect, requiredZoneHeight } = nextCardRect(zone);
  const currentHeight = Number(zone.height ?? zone.h ?? 0);
  if (requiredZoneHeight > currentHeight) {
    state.ledger = await ledgerMutation(state.activeLedgerId, {
      action: 'patch-geometry',
      geometry: { zones: { [zone.id]: { x: Number(zone.x ?? 0), y: Number(zone.y ?? 0), width: Number(zone.width ?? zone.w ?? 1200), height: requiredZoneHeight } } }
    });
  }
  const card = {
    id: objectId('card'),
    title: name,
    cardType: 'note',
    domainId: state.activeLedgerId,
    status: 'todo',
    x: rect.x,
    y: rect.y,
    w: rect.width,
    h: rect.height,
    comment: { what: description || 'New description' },
    facts: [],
    fields: []
  };
  state.ledger = await ledgerMutation(state.activeLedgerId, { action: 'create-card', card });
  syncMobileThreadContext({ ledgerId: state.activeLedgerId, ledger: state.ledger, ledgers: state.ledgers, onCodexStarted: activateMasterTask });
  navigate(cardPath(state.activeLedgerId, state.activeZoneId, card.id));
}

async function submitCreation() {
  const name = document.querySelector('#creation-name').value.trim();
  if (!name) return;
  const submit = document.querySelector('.creation-submit');
  const error = document.querySelector('.creation-error');
  submit.disabled = true;
  error.hidden = true;
  try {
    if (creationKind === 'ledger') await createLedger(name);
    if (creationKind === 'zone') await createZone(name, document.querySelector('#creation-color').value);
    if (creationKind === 'card') await createCard(name, document.querySelector('#creation-description').value.trim());
    creationModal.close();
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Creation failed.';
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

function renderLedgerLinks() {
  const route = `/${routeParts()[0] ?? ''}`;
  const destination = (label, href, className = '') => {
    const link = document.createElement(href ? 'a' : 'button');
    link.className = `ledger-link ${className}${route === href ? ' active' : ''}`.trim();
    link.textContent = label;
    if (href) link.href = href;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (href) navigate(href);
    });
    return link;
  };
  elements['ledger-links'].replaceChildren(
    destination('Control room', '/'),
    destination('Ledgers', '/ledgers'),
    destination('Pipelines', '', 'nav-pipelines-button'),
    destination('Skill library', '', 'nav-skills-button')
  );
}

function renderOverview() {
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  elements['overview-summary'].textContent = `${state.ledgers.length} ${state.ledgers.length === 1 ? 'ledger' : 'ledgers'}`;
  elements['overview-ledgers'].replaceChildren(...state.ledgers.map((ledger) => {
    const link = document.createElement('a');
    link.className = 'overview-ledger';
    link.href = ledgerPath(ledger.id);
    const copy = document.createElement('span');
    const title = document.createElement('h2');
    title.textContent = ledger.title;
    const detail = document.createElement('p');
    detail.textContent = ledger.id;
    copy.append(title, detail);
    const arrow = document.createElement('span');
    arrow.className = 'row-arrow';
    arrow.textContent = '›';
    link.append(copy, arrow);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.getAttribute('href'));
    });
    return link;
  }));
  setView('overview-view');
  document.title = `Ledgers · ${state.projectName}`;
}

function filteredControlTasks() {
  const tasks = state.controlRoom?.[state.controlTab] ?? [];
  return state.controlFilter === 'All' ? tasks : tasks.filter((task) => task.ledger === state.controlFilter);
}

function controlTaskCount(tab) {
  const tasks = state.controlRoom?.[tab] ?? [];
  return state.controlFilter === 'All' ? tasks.length : tasks.filter((task) => task.ledger === state.controlFilter).length;
}

function taskRow(task, index) {
  const article = document.createElement('article');
  article.className = `control-task${index === 0 && state.controlTab === 'queue' ? ' next-task' : ''}`;
  article.id = `task-${task.cardId}`;
  article.dataset.cardId = task.cardId;
  article.draggable = false;
  const summary = document.createElement('button');
  summary.type = 'button';
  summary.className = 'control-task-summary';
  const active = state.controlTab === 'active';
  const queue = state.controlTab === 'queue';
  const directNavigation = active || queue;
  if (!directNavigation) summary.setAttribute('aria-expanded', 'false');
  summary.innerHTML = active
    ? `<span class="task-copy"><strong></strong></span><span class="task-stopwatch" data-active-since=""></span>`
    : `<span class="task-copy"><strong></strong><span class="task-meta"></span>${task.nextSubtask ? '<span class="task-next"></span>' : ''}</span>${queue ? '' : '<span class="task-chevron">⌄</span>'}`;
  summary.querySelector('strong').textContent = task.title;
  if (active) {
    const stopwatch = summary.querySelector('.task-stopwatch');
    stopwatch.dataset.activeSince = task.activeSince;
    stopwatch.textContent = activeStopwatch(task.activeSince);
  }
  const age = task.status === 'task-complete' ? 'completed' : task.status === 'task-active' ? activeAge(task.activeSince) : waitingAge(task.waitingSince);
  const process = task.codexProcessing ? ` · Codex ${task.codexRunId}` : '';
  if (!active) {
    summary.querySelector('.task-meta').textContent = `${task.ledger} · ${age}${process} · ${task.complete}/${task.subtasks.length} complete`;
    const nextSubtask = summary.querySelector('.task-next');
    if (nextSubtask) nextSubtask.textContent = `Next: ${task.nextSubtask.title}`;
  }
  if (task.diagnostics.length) {
    article.classList.add('has-diagnostics');
    const diagnostic = document.createElement('span');
    diagnostic.className = 'task-diagnostic';
    diagnostic.textContent = task.diagnostics.join(' · ');
    summary.querySelector('.task-copy').append(diagnostic);
  }
  if (queue) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'task-drag-handle';
    handle.draggable = true;
    handle.setAttribute('aria-label', `Reorder ${task.title}`);
    handle.textContent = '⠿';
    let pressTimer = 0;
    let touchActive = false;
    let touchTarget = article;
    handle.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      pressTimer = window.setTimeout(() => {
        touchActive = true;
        state.draggedTaskId = task.cardId;
        article.classList.add('dragging');
        handle.setPointerCapture(event.pointerId);
      }, 350);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!touchActive) return;
      event.preventDefault();
      const candidate = document.elementFromPoint(event.clientX, event.clientY)?.closest('.control-task');
      if (candidate && candidate !== touchTarget) {
        touchTarget.classList.remove('drag-target');
        touchTarget = candidate;
        touchTarget.classList.add('drag-target');
      }
    });
    const finishTouch = () => {
      window.clearTimeout(pressTimer);
      if (!touchActive) return;
      const targetId = touchTarget.dataset.cardId;
      const targetIndex = filteredControlTasks().findIndex((candidate) => candidate.cardId === targetId);
      article.classList.remove('dragging');
      touchTarget.classList.remove('drag-target');
      touchActive = false;
      state.draggedTaskId = '';
      if (targetIndex >= 0) void moveTask(task.cardId, targetIndex);
    };
    handle.addEventListener('pointerup', finishTouch);
    handle.addEventListener('pointercancel', finishTouch);
    article.prepend(handle);
    article.addEventListener('dragstart', (event) => {
      state.draggedTaskId = task.cardId;
      article.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
    });
    article.addEventListener('dragend', () => { state.draggedTaskId = ''; article.classList.remove('dragging'); });
    article.addEventListener('dragover', (event) => { event.preventDefault(); article.classList.add('drag-target'); });
    article.addEventListener('dragleave', () => article.classList.remove('drag-target'));
    article.addEventListener('drop', (event) => {
      event.preventDefault();
      article.classList.remove('drag-target');
      if (state.draggedTaskId) void moveTask(state.draggedTaskId, index);
    });
  }
  if (directNavigation) {
    summary.addEventListener('click', () => navigate(pathForTask(task)));
    article.append(summary);
    return article;
  }
  const details = document.createElement('section');
  details.className = 'control-task-details';
  details.hidden = true;
  const subtasks = task.subtasks.map((subtask) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'subtask-row';
    button.innerHTML = '<span></span><small></small>';
    button.querySelector('span').textContent = subtask.title;
    button.querySelector('small').textContent = subtask.status;
    button.addEventListener('click', () => {
      const target = state.controlRoom.allTasks.find((candidate) => candidate.cardId === subtask.cardId && candidate.ledgerId === task.ledgerId);
      if (target) navigate(pathForTask(target));
      else {
        const ledger = state.controlRoom.documents.find((entry) => entry.ledgerId === task.ledgerId)?.document;
        const previous = state.ledger;
        state.ledger = ledger;
        const zone = ledgerZones().find((entry) => entry.cards.some((card) => String(card.id) === subtask.cardId));
        state.ledger = previous;
        navigate(cardPath(task.ledgerId, zone?.id ?? 'ungrouped', subtask.cardId));
      }
    });
    return button;
  });
  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'Open master task';
  open.addEventListener('click', () => navigate(pathForTask(task)));
  actions.append(open);
  if (state.controlTab === 'queue') {
    for (const [label, delta] of [['Move up', -1], ['Move down', 1]]) {
      const move = document.createElement('button');
      move.type = 'button';
      move.textContent = label;
      move.disabled = index + delta < 0 || index + delta >= filteredControlTasks().length;
      move.addEventListener('click', () => void moveTask(task.cardId, index + delta));
      actions.append(move);
    }
  }
  details.append(...subtasks, actions);
  summary.addEventListener('click', () => {
    details.hidden = !details.hidden;
    summary.setAttribute('aria-expanded', String(!details.hidden));
  });
  article.append(summary, details);
  return article;
}

function renderControlRoom() {
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  const filters = ['All', ...(state.controlRoom?.ledgers ?? [])];
  if (!filters.includes(state.controlFilter)) state.controlFilter = 'All';
  elements['control-filters'].replaceChildren(...filters.map((filter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    button.textContent = filter;
    button.setAttribute('aria-pressed', String(filter === state.controlFilter));
    button.addEventListener('click', () => { state.controlFilter = filter; renderControlRoom(); });
    return button;
  }));
  document.querySelectorAll('[data-control-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.controlTab === state.controlTab));
    const count = controlTaskCount(button.dataset.controlTab);
    button.querySelector('small').textContent = `${count} ${count === 1 ? 'task' : 'tasks'}`;
  });
  const tasks = filteredControlTasks();
  elements['control-task-list'].replaceChildren(...tasks.map(taskRow));
  elements['control-empty'].hidden = tasks.length > 0;
  elements['control-empty'].textContent = {
    queue: 'No waiting tasks',
    active: 'No active tasks',
    done: 'No completed tasks'
  }[state.controlTab] ?? 'No tasks';
  elements['control-diagnostics'].hidden = true;
  elements['control-diagnostics'].replaceChildren();
  setView('control-room-view');
  document.title = `Control room · ${state.projectName}`;
  const { anchor } = parseControlRoomRoute(location.href);
  if (anchor) window.requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
}

function persistControlRoomScrollAnchor() {
  if (location.pathname !== '/' || elements['control-room-view'].hidden) return;
  window.cancelAnimationFrame(controlRoomScrollFrame);
  controlRoomScrollFrame = window.requestAnimationFrame(() => {
    const rows = [...elements['control-task-list'].querySelectorAll('.control-task')];
    const nearest = rows.reduce((best, row) => {
      const distance = Math.abs(row.getBoundingClientRect().top);
      return !best || distance < best.distance ? { row, distance } : best;
    }, null)?.row;
    const nextPath = controlRoomPath(state.controlTab, nearest?.id ?? '');
    if (`${location.pathname}${location.search}${location.hash}` !== nextPath) history.replaceState({}, '', nextPath);
  });
}

async function loadControlRoom() {
  const documents = await Promise.all(state.ledgers.map(async (ledger) => ({
    ledgerId: ledger.id,
    document: await fetch(`/decision-os/${encodeURIComponent(ledger.id)}`, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${ledger.title} (${response.status}).`);
      return response.json();
    })
  })));
  const allTasks = (await Promise.all(documents.flatMap(({ ledgerId, document }) => {
    const ledgerTitle = state.ledgers.find((entry) => entry.id === ledgerId)?.title ?? ledgerId;
    const cards = document.cards ?? [];
    return cards.map(async (card) => {
      const markdown = ledgerCardBody(card);
      const runId = String(card.codexThreadRunId ?? '');
      let codexStatus = '';
      if (runId && /#task-active\b/i.test(markdown)) {
        const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(runId)}?ledgerId=${encodeURIComponent(ledgerId)}&cardId=${encodeURIComponent(card.id)}&since=0`, { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          codexStatus = String(payload.run?.status ?? payload.status ?? '');
        }
      }
      return { cardId: card.id, title: card.title, ledgerId, ledgerTitle, markdown, cardStatus: card.status, cards, codexRunId: runId, codexStatus };
    });
  }))).flat();
  state.controlRoom = { ...deriveControlRoom(allTasks), allTasks, documents };
}

async function moveTask(cardId, targetIndex) {
  const visible = filteredControlTasks();
  const sourceIndex = visible.findIndex((task) => task.cardId === cardId);
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= visible.length || sourceIndex === targetIndex) return;
  const reordered = visible.slice();
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  await Promise.all(reordered.map((task, index) => ledgerMutation(task.ledgerId, {
    action: 'patch-card',
    cardPatch: { id: task.cardId, description: withQueueRank(task.markdown, index + 1) }
  })));
  await loadControlRoom();
  renderControlRoom();
}

async function activateMasterTask({ ledgerId, cardId, startedAt }) {
  const ledger = await fetch(`/decision-os/${encodeURIComponent(ledgerId)}`, { cache: 'no-store' }).then((response) => response.json());
  const card = ledger.cards?.find((entry) => String(entry.id) === String(cardId));
  if (!card || !parseMasterCandidate(card)) return ledger;
  return ledgerMutation(ledgerId, {
    action: 'patch-card',
    cardPatch: { id: cardId, description: withActiveStatus(ledgerCardBody(card), startedAt) }
  });
}

function parseMasterCandidate(card) {
  return /^\s*(?:#[a-z][a-z0-9-]*\s*)*#master-task\b(?:\s*#[a-z][a-z0-9-]*)*\s*$/im.test(ledgerCardBody(card));
}

async function createTaskIntake() {
  const ledgerRef = state.ledgers.find((entry) => entry.title === state.controlFilter || entry.id === state.controlFilter) ?? state.ledgers[0];
  if (!ledgerRef) throw new Error('Create a ledger before starting a task.');
  const ledger = await fetch(`/decision-os/${encodeURIComponent(ledgerRef.id)}`, { cache: 'no-store' }).then((response) => response.json());
  state.ledger = ledger;
  state.activeLedgerId = ledgerRef.id;
  const rect = nextZoneRect();
  const zone = { id: objectId('zone'), ...rect, color: '#38d9e8', label: 'New task intake', comments: [] };
  await ledgerMutation(ledgerRef.id, { action: 'create-zone', annotation: zone });
  const cardId = objectId('card');
  const timestamp = new Date().toISOString();
  const markdown = `#master-task #task-waiting\n\nLedger: ${ledgerRef.title}\nWaiting since: ${timestamp}\n\n## Intake\n\nDescribe the task in this thread, attach the required files, then launch Codex. Categorize the task, keep this mandatory new zone, rename this master task and zone, create actionable subtask cards in this zone, and write canonical card links and statuses under \`## Subtasks\`.\n\n## Subtasks\n`;
  const card = { id: cardId, title: 'New task intake', cardType: 'note', domainId: ledgerRef.id, status: 'todo', x: rect.x + 60, y: rect.y + 60, w: 360, h: 240, comment: { what: markdown }, facts: [], fields: [] };
  const updated = await ledgerMutation(ledgerRef.id, { action: 'create-card', card });
  state.ledger = updated;
  state.activeZoneId = zone.id;
  state.activeZoneColor = zone.color;
  syncMobileThreadContext({ ledgerId: ledgerRef.id, ledger: updated, ledgers: state.ledgers, onCodexStarted: activateMasterTask });
  navigate(cardPath(ledgerRef.id, zone.id, cardId));
  openMobileThread(card, zone.color);
}

function cardOverlapArea(card, zone) {
  const cardLeft = Number(card.x ?? 0);
  const cardTop = Number(card.y ?? 0);
  const cardWidth = Math.max(0, Number(card.w ?? card.width ?? 280));
  const cardHeight = Math.max(0, Number(card.h ?? card.height ?? 132));
  const zoneLeft = Number(zone.x ?? 0);
  const zoneTop = Number(zone.y ?? 0);
  const zoneWidth = Math.max(0, Number(zone.width ?? zone.w ?? 0));
  const zoneHeight = Math.max(0, Number(zone.height ?? zone.h ?? 0));
  if (![cardLeft, cardTop, cardWidth, cardHeight, zoneLeft, zoneTop, zoneWidth, zoneHeight].every(Number.isFinite)) return 0;
  const width = Math.max(0, Math.min(cardLeft + cardWidth, zoneLeft + zoneWidth) - Math.max(cardLeft, zoneLeft));
  const height = Math.max(0, Math.min(cardTop + cardHeight, zoneTop + zoneHeight) - Math.max(cardTop, zoneTop));
  return width * height;
}

function ledgerZones() {
  const cards = Array.isArray(state.ledger?.cards) ? state.ledger.cards : [];
  const annotations = Array.isArray(state.ledger?.annotations) ? state.ledger.annotations : [];
  const zones = annotations
    .filter((zone) => zone?.variant !== 'group' && typeof zone?.color === 'string' && zone.id)
    .map((zone) => ({ ...zone, cards: [] }));
  const ungrouped = { id: 'ungrouped', label: 'Ungrouped', color: '#9ba3ad', cards: [] };
  for (const card of cards) {
    let bestZone = null;
    let bestArea = 0;
    for (const zone of zones) {
      const area = cardOverlapArea(card, zone);
      if (area <= bestArea) continue;
      bestArea = area;
      bestZone = zone;
    }
    (bestZone ?? ungrouped).cards.push(card);
  }
  if (ungrouped.cards.length) zones.push(ungrouped);
  return zones;
}

function renderCards(cards) {
  const query = state.query.trim().toLocaleLowerCase();
  const filtered = cards.filter((card) => {
    if (!query) return true;
    return [card.title, ledgerCardBody(card)]
      .some((value) => asText(value).toLocaleLowerCase().includes(query));
  });
  const rows = filtered.map((card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-row';
    const copy = document.createElement('span');
    const title = document.createElement('h2');
    title.textContent = asText(card.title).trim() || `Card ${card.id}`;
    copy.append(title);
    button.style.setProperty('--zone-color', state.activeZoneColor || 'var(--accent)');
    const arrow = document.createElement('span');
    arrow.className = 'card-row-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    button.append(copy, arrow);
    button.addEventListener('click', () => navigate(cardPath(state.activeLedgerId, state.activeZoneId, card.id)));
    return button;
  });
  elements['card-list'].replaceChildren(...rows);
  elements['no-results'].hidden = rows.length > 0;
  elements['zone-summary'].textContent = `${filtered.length === cards.length ? cards.length : `${filtered.length} of ${cards.length}`} cards`;
}

function renderCard(card) {
  state.activeCardId = asText(card.id);
  elements['card-title'].textContent = asText(card.title).trim() || `Card ${card.id}`;
  const imageSizes = card.imageSizes && typeof card.imageSizes === 'object' ? card.imageSizes : {};
  const markdown = ledgerCardBody(card);
  const parsedTask = parseMasterTaskMarkdown({
    cardId: card.id,
    title: card.title,
    ledgerId: state.activeLedgerId,
    ledgerTitle: state.ledgers.find((entry) => entry.id === state.activeLedgerId)?.title ?? state.activeLedgerId,
    markdown,
    cardStatus: card.status,
    cards: state.ledger?.cards ?? []
  });
  const backButton = document.querySelector('.back-to-zone-button');
  backButton.textContent = '← Back';
  backButton.dataset.destination = parsedTask.masterTask ? 'control-room' : 'zone';
  const content = renderLedgerCardMarkdown(parsedTask.masterTask ? visibleMasterTaskMarkdown(markdown) : markdown, { imageSizes, mediaSurface: 'thread' });
  if (parsedTask.masterTask) {
    const overview = document.createElement('section');
    overview.className = 'task-overview';
    const status = document.createElement('p');
    status.className = 'task-status-line';
    status.innerHTML = '<strong></strong><span></span>';
    status.querySelector('strong').textContent = parsedTask.status.replace('task-', '');
    status.querySelector('span').textContent = `${parsedTask.complete} of ${parsedTask.subtasks.length} complete`;
    const heading = document.createElement('h2');
    heading.textContent = 'Subtasks';
    const subtasks = document.createElement('div');
    subtasks.className = 'task-subtasks';
    subtasks.replaceChildren(...parsedTask.subtasks.map((subtask) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'subtask-row';
      button.innerHTML = '<span></span><small></small>';
      button.querySelector('span').textContent = subtask.title;
      button.querySelector('small').textContent = subtask.status;
      button.addEventListener('click', () => {
        const zone = ledgerZones().find((entry) => entry.cards.some((entryCard) => String(entryCard.id) === subtask.cardId));
        navigate(cardPath(state.activeLedgerId, zone?.id ?? 'ungrouped', subtask.cardId));
      });
      return button;
    }));
    const completion = document.createElement('section');
    completion.className = 'master-task-completion';
    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.className = 'complete-master-task-button';
    completeButton.textContent = card.status === 'done' ? 'Master task complete' : 'Complete master task';
    completeButton.disabled = card.status === 'done';
    completeButton.addEventListener('click', async () => {
      completeButton.disabled = true;
      completeButton.textContent = 'Completing task…';
      try {
        state.ledger = await ledgerMutation(state.activeLedgerId, { action: 'complete-master-task', masterTaskId: card.id });
        navigate(completionReturnPath(), true);
      } catch (cause) {
        completeButton.disabled = false;
        completeButton.textContent = 'Complete master task';
        elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Master task completion failed.';
        setView('error-view');
      }
    });
    completion.append(completeButton);
    overview.append(status, heading, subtasks, completion);
    elements['card-body'].replaceChildren(content, overview);
  } else elements['card-body'].replaceChildren(content);
  elements['card-view'].style.setProperty('--zone-color', state.activeZoneColor || 'var(--accent)');
  setMobileThreadCard(card);
  setMobileCodexContext({ ledgerId: state.activeLedgerId, cardId: state.activeCardId });
  setView('card-view');
  document.title = `${elements['card-title'].textContent} · ${state.projectName}`;
}

function renderLedger() {
  const active = state.ledgers.find((ledger) => ledger.id === state.activeLedgerId);
  const zones = ledgerZones();
  elements['ledger-title'].textContent = active?.title ?? state.activeLedgerId;
  elements['ledger-summary'].textContent = `${zones.length} ${zones.length === 1 ? 'zone' : 'zones'}`;
  elements['zone-list'].replaceChildren(...zones.map((zone) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zone-row';
    button.style.setProperty('--zone-color', zone.color);
    const copy = document.createElement('span');
    const title = document.createElement('h2');
    title.textContent = asText(zone.label).trim() || 'Untitled zone';
    const detail = document.createElement('p');
    detail.textContent = `${zone.cards.length} ${zone.cards.length === 1 ? 'card' : 'cards'}`;
    copy.append(title, detail);
    const arrow = document.createElement('span');
    arrow.className = 'row-arrow';
    arrow.textContent = '›';
    button.append(copy, arrow);
    button.addEventListener('click', () => navigate(zonePath(state.activeLedgerId, zone.id)));
    return button;
  }));
  setView('ledger-view');
  document.title = `${active?.title ?? state.activeLedgerId} · ${state.projectName}`;
}

function renderZone(zone) {
  state.activeZoneId = asText(zone.id);
  state.activeZoneColor = asText(zone.color);
  state.query = '';
  elements['zone-title'].textContent = asText(zone.label).trim() || 'Untitled zone';
  elements['zone-summary'].textContent = `${zone.cards.length} ${zone.cards.length === 1 ? 'card' : 'cards'}`;
  elements['card-search'].value = '';
  document.querySelector('.create-card-button').disabled = zone.id === 'ungrouped';
  renderCards(zone.cards);
  setView('zone-view');
  document.title = `${elements['zone-title'].textContent} · ${state.projectName}`;
}

async function loadLedger(ledgerId) {
  const response = await fetch(`/decision-os/${encodeURIComponent(ledgerId)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
  const ledger = await response.json();
  if (!ledger || !Array.isArray(ledger.cards)) throw new Error('The ledger response does not contain a card list.');
  state.ledger = ledger;
  state.activeLedgerId = ledgerId;
  renderLedgerLinks();
  syncMobileThreadContext({
    ledgerId,
    ledger,
    ledgers: state.ledgers,
    onCodexStarted: activateMasterTask,
    onLedgerRefresh: async (activeLedgerId) => {
      const refreshed = await fetch(`/decision-os/${encodeURIComponent(activeLedgerId)}`, { cache: 'no-store' }).then((result) => result.ok ? result.json() : null);
      if (refreshed && activeLedgerId === state.activeLedgerId) state.ledger = refreshed;
      return refreshed;
    }
  });
}

async function loadRoute() {
  setView('loading-view');
  try {
    const response = await fetch('/decision-os/state', { cache: 'no-store' });
    if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
    const project = await response.json();
    state.projectName = 'decision-os';
    state.ledgers = Array.isArray(project.ledgers) ? project.ledgers.filter((ledger) => ledger?.id && ledger?.title) : [];
    elements['project-name'].textContent = state.projectName;
    if (!state.ledgers.length) {
      renderLedgerLinks();
      setView('empty-view');
      return;
    }

    const [requestedLedger, zoneMarker, requestedZone, cardMarker, requestedCard] = routeParts();
    if (!requestedLedger) {
      const route = parseControlRoomRoute(location.href);
      state.controlTab = route.tab;
      const canonicalPath = controlRoomPath(route.tab, route.anchor);
      if (`${location.pathname}${location.search}${location.hash}` !== canonicalPath) history.replaceState({}, '', canonicalPath);
      await loadControlRoom();
      renderControlRoom();
      return;
    }
    if (requestedLedger === 'ledgers') {
      state.activeLedgerId = '';
      renderLedgerLinks();
      renderOverview();
      return;
    }
    const ledgerId = state.ledgers.some((ledger) => ledger.id === requestedLedger) ? requestedLedger : '';
    if (!ledgerId) {
      navigate('/', true);
      return;
    }
    if (state.activeLedgerId !== ledgerId || !state.ledger) await loadLedger(ledgerId);
    const zones = ledgerZones();
    const zone = zoneMarker === 'zone' ? zones.find((entry) => String(entry.id) === requestedZone) : null;
    if (zone && cardMarker === 'card' && requestedCard) {
      const card = zone.cards.find((entry) => String(entry.id) === requestedCard);
      if (card) renderCard(card);
      else navigate(zonePath(ledgerId, zone.id), true);
    } else if (zone) {
      renderZone(zone);
    } else {
      state.activeCardId = '';
      setMobileCodexContext({ ledgerId: state.activeLedgerId, cardId: '' });
      state.activeZoneId = '';
      renderLedger();
    }
  } catch (error) {
    elements['error-message'].textContent = error instanceof Error ? error.message : 'Unknown loading error.';
    setView('error-view');
  }
}

document.querySelector('.menu-button').addEventListener('click', openMenu);
document.querySelector('.close-menu-button').addEventListener('click', closeMenu);
document.querySelector('.nav-scrim').addEventListener('click', closeMenu);
document.querySelector('.nav-server-restart-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Restarting…';
  await fetch('/api/server/restart', { method: 'POST' }).catch(() => undefined);
  window.setTimeout(() => location.reload(), 1500);
});
document.querySelector('.refresh-button').addEventListener('click', () => {
  state.ledger = null;
  void loadRoute();
});
document.querySelector('.retry-button').addEventListener('click', () => loadRoute());
document.querySelector('.back-to-ledger-button').addEventListener('click', () => navigate(ledgerPath(state.activeLedgerId)));
document.querySelector('.back-to-zone-button').addEventListener('click', (event) => {
  navigate(event.currentTarget.dataset.destination === 'control-room' ? '/' : zonePath(state.activeLedgerId, state.activeZoneId));
});
document.querySelector('.create-ledger-button').addEventListener('click', () => openCreationModal('ledger'));
document.querySelector('.create-zone-button').addEventListener('click', () => openCreationModal('zone'));
document.querySelector('.create-card-button').addEventListener('click', () => openCreationModal('card'));
document.querySelector('.new-task-button').addEventListener('click', async () => {
  const button = document.querySelector('.new-task-button');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try { await createTaskIntake(); }
  catch (cause) {
    elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Task intake creation failed.';
    setView('error-view');
  } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
});
document.querySelectorAll('[data-control-tab]').forEach((button) => button.addEventListener('click', () => {
  state.controlTab = button.dataset.controlTab;
  history.pushState({}, '', controlRoomPath(state.controlTab));
  window.scrollTo({ top: 0 });
  renderControlRoom();
}));
document.querySelector('.creation-cancel').addEventListener('click', () => creationModal.close());
creationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitCreation();
});
elements['card-search'].addEventListener('input', (event) => {
  state.query = event.target.value;
  renderCards(state.ledger?.cards ?? []);
});
window.addEventListener('popstate', () => loadRoute());
window.addEventListener('scroll', persistControlRoomScrollAnchor, { passive: true });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
});

initializeMobileThread();
initializeMobileCodex();
window.setInterval(() => {
  document.querySelectorAll('.task-stopwatch[data-active-since]').forEach((stopwatch) => {
    stopwatch.textContent = activeStopwatch(stopwatch.dataset.activeSince);
  });
}, 1000);
void loadRoute();
