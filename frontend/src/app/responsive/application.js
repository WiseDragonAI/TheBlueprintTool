/**
 * WHAT: Runs the complete responsive Decision OS application outside desktop canvas routes.
 * WHY: The former mobile feature set is the single application contract for every viewport.
 */
import { renderLedgerCardMarkdown } from '/src/runtime/ledger/component/render-ledger-card-markdown.js';
import { ledgerCardBody } from '/src/runtime/ledger/helper/ledger-card-body.js';
import { saveLedgerCardMediaCarouselSlide } from '/src/runtime/ledger/helper/persist-ledger-card-media-carousel.js';
import { closeMobileThread, handleResponsiveThreadShortcut, initializeMobileThread, openMobileThread, setMobileThreadCard, syncMobileThreadContext } from './thread.js';
import { initializeMobileCodex, openMobileCodexLibrary, setMobileCodexContext } from './codex.js';
import { executionAge, executionStopwatch, parseMasterTaskMarkdown, visibleMasterTaskMarkdown, waitingAge } from './control-room.js';
import { controlRoomPath, parseControlRoomRoute } from './control-room-route.js';
import { cardPathForProject, isProjectCardPath, ledgerPathForProject, parseProjectRoute, parseProjectScope, projectPath, zonePathForProject } from './project-route.js';
import { loadProjectSyncRuns, projectSettingsValues, saveProjectSettingsRequest, startProjectSyncRequest } from './project-settings.js';
import { isCardEditingKeyboardTarget } from '/src/runtime/input/helper/is-card-editing-keyboard-target.js';
import { committedProjectColor, hexToHsv, hsvToHex, projectColorPickerGradients } from './project-color-picker.js';
import { codexProcessLimitRange, loadCodexProcessSettings, saveCodexProcessSettings, stepCodexProcessLimit } from './codex-settings.js';
import { loadFederationSettings, saveFederationSettings } from './federation-settings.js';
import { hydrateFederationForm } from './federation-form-hydration.js';
import { createProjectRequest } from './project-creation.js';
import { installProjectRequestScope, projectScopedRequestPath } from '/src/runtime/project/helper/project-request-scope.js';
import { projectFilterChipPresentation } from './project-filter-chip.js';

installProjectRequestScope();

const state = {
  projectName: 'decision-os',
  projects: [],
  resourceProjectId: '',
  ledgers: [],
  ledger: null,
  activeLedgerId: '',
  activeZoneId: '',
  activeZoneColor: '',
  activeCardId: '',
  query: '',
  controlRoom: null,
  viewedProjectId: '',
  controlTab: 'queue',
  projectFilter: 'All',
  controlFilter: 'All',
  projectSyncRuns: [],
  controlNodeIndex: 0,
};

const elements = Object.fromEntries([
  'project-name', 'ledger-links', 'loading-view', 'error-view', 'error-message', 'empty-view',
  'projects-view', 'projects-summary', 'project-list', 'project-detail-view', 'project-detail-name', 'project-detail-description', 'settings-view',
  'project-detail-color', 'project-detail-status', 'project-detail-path',
  'overview-view', 'overview-summary', 'overview-ledgers', 'ledger-view', 'ledger-title', 'ledger-summary',
  'zone-list', 'zone-view', 'zone-title', 'zone-summary', 'card-search', 'card-list',
  'no-results', 'card-view', 'card-title', 'card-body', 'control-room-view', 'control-project-filters', 'control-filters',
  'control-task-list', 'control-empty', 'control-diagnostics', 'codex-settings-limit', 'codex-settings-message',
  'federation-connection-status', 'federation-state-duration', 'federation-attempt-timeout', 'federation-last-connection',
  'federation-last-issue', 'federation-peer-list', 'federation-settings-message'
].map((id) => [id, document.getElementById(id)]));

const asText = (value) => value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const defaultAccent = '#38d9e8';
const projectOwnerLabel = (project) => project.ownerNodeLabel || project.ownerNodeId || 'This server';
const routeParts = () => parseProjectScope(location.pathname)?.segments ?? [];
const creationModal = document.querySelector('.creation-modal');
const deleteMasterTaskModal = document.querySelector('.delete-master-task-modal');
const newTaskProjectModal = document.querySelector('.new-task-project-modal');
const projectSettingsModal = document.querySelector('.project-settings-modal');
const projectSettingsForm = document.querySelector('.project-settings-form');
const projectColorPickerModal = document.querySelector('.project-color-picker-modal');
const projectSettingsColorInput = document.querySelector('#project-settings-color');
const projectColorSliders = {
  hue: document.querySelector('#project-color-hue'),
  saturation: document.querySelector('#project-color-saturation'),
  value: document.querySelector('#project-color-value'),
};
const creationForm = document.querySelector('.creation-form');
let creationKind = '';
let controlRoomScrollFrame = 0;
let queuePersistenceSequence = 0;
let queuePersistenceActive = false;
let queueSortables = [];
let queuePersistenceTail = Promise.resolve(true);
let queueDragActive = false;
let queueDragSettling = false;
let queueDragInterrupted = false;
let queueDragOrigin = null;
let pendingControlRoomRefresh = false;
let controlRoomEventSource = null;
let controlRoomRefreshTimer = 0;
let controlRoomEtag = '';
let cardSearchTimer = 0;
let federationStatusRefreshTimer = 0;
let federationStatusClockTimer = 0;
let latestFederationSettings = null;
let federationFormDirty = false;
let federationSettingsLoadGeneration = 0;
let projectColorPickerOriginal = '';
let projectColorPickerDirty = false;
let projectSyncEventSource = null;

function createProjectColorSlider(element, start, maximum) {
  window.noUiSlider.create(element, {
    start,
    step: 1,
    connect: false,
    range: { min: 0, max: maximum },
    keyboardSupport: true,
    ariaFormat: {
      to: (value) => String(Math.round(value)),
      from: (value) => Number(value),
    },
  });
  element.querySelector('[role="slider"]')?.setAttribute('aria-labelledby', element.getAttribute('aria-labelledby'));
}

createProjectColorSlider(projectColorSliders.hue, 0, 360);
createProjectColorSlider(projectColorSliders.saturation, 70, 100);
createProjectColorSlider(projectColorSliders.value, 80, 100);

function projectColorPickerHsv() {
  return {
    hue: Number(projectColorSliders.hue.noUiSlider.get()),
    saturation: Number(projectColorSliders.saturation.noUiSlider.get()),
    value: Number(projectColorSliders.value.noUiSlider.get()),
  };
}

function renderProjectColorPicker() {
  const hsv = projectColorPickerHsv();
  const gradients = projectColorPickerGradients(hsv);
  projectColorSliders.hue.style.background = gradients.hue;
  projectColorSliders.saturation.style.background = gradients.saturation;
  projectColorSliders.value.style.background = gradients.value;
  projectColorPickerModal.style.setProperty('--project-color-picker-color', hsvToHex(hsv));
}

function renderProjectSettingsColorField(color) {
  const normalized = String(color).toLowerCase();
  document.querySelector('.project-settings-color-trigger').style.setProperty('--project-settings-color', normalized);
  document.querySelector('.project-settings-color-value').textContent = normalized;
}

function openProjectColorPicker() {
  projectColorPickerOriginal = projectSettingsColorInput.value;
  projectColorPickerDirty = false;
  const hsv = hexToHsv(projectColorPickerOriginal);
  projectColorSliders.hue.noUiSlider.set(hsv.hue);
  projectColorSliders.saturation.noUiSlider.set(hsv.saturation);
  projectColorSliders.value.noUiSlider.set(hsv.value);
  renderProjectColorPicker();
  projectColorPickerModal.showModal();
  window.requestAnimationFrame(() => projectColorSliders.hue.querySelector('[role="slider"]')?.focus());
}

function closeProjectColorPicker() {
  projectColorPickerModal.close();
  window.requestAnimationFrame(() => document.querySelector('.project-settings-color-trigger').focus());
}

Object.values(projectColorSliders).forEach((element) => {
  element.noUiSlider.on('update', renderProjectColorPicker);
  element.noUiSlider.on('start', () => { projectColorPickerDirty = true; });
  element.noUiSlider.on('slide', () => { projectColorPickerDirty = true; });
  element.noUiSlider.on('change', () => { projectColorPickerDirty = true; });
});
renderProjectColorPicker();

function projectFetch(url, options = {}, projectId = state.resourceProjectId) {
  return fetch(projectScopedRequestPath(url, projectId), options);
}

function setResourceProject(projectId) {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) return;
  state.resourceProjectId = project.id;
  state.projectName = project.name;
  state.ledgers = project.ledgers;
  state.ledger = null;
  elements['project-name'].textContent = project.name;
  document.documentElement.style.setProperty('--accent', project.color || defaultAccent);
  document.documentElement.style.setProperty('--accent-strong', project.color || defaultAccent);
}

function setView(name) {
  if (name !== 'card-view' && name !== 'loading-view' && !closeCardDetail()) return false;
  for (const id of ['loading-view', 'error-view', 'empty-view', 'projects-view', 'project-detail-view', 'settings-view', 'overview-view', 'control-room-view', 'ledger-view', 'zone-view', 'card-view']) {
    elements[id].hidden = id !== name;
  }
  if (name !== 'settings-view') {
    federationSettingsLoadGeneration += 1;
    window.clearTimeout(federationStatusRefreshTimer);
    window.clearInterval(federationStatusClockTimer);
    federationStatusRefreshTimer = 0;
    federationStatusClockTimer = 0;
    latestFederationSettings = null;
  }
  return true;
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
  return ledgerPathForProject(state.resourceProjectId, ledgerId);
}

function zonePath(ledgerId, zoneId) {
  return zonePathForProject(state.resourceProjectId, ledgerId, zoneId);
}

function cardPath(ledgerId, zoneId, cardId) {
  return cardPathForProject(state.resourceProjectId, ledgerId, zoneId, cardId);
}

function closeCardDetail() {
  const threadVisible = document.body.classList.contains('card-thread-open');
  if (!threadVisible) return true;
  return closeMobileThread();
}

function openCardDetail(card) {
  setMobileThreadCard(card);
  setMobileCodexContext({ projectId: state.resourceProjectId, ledgerId: state.activeLedgerId, cardId: state.activeCardId });
  setView('card-view');
  if (window.matchMedia?.('(min-width: 761px)').matches === true) {
    openMobileThread(card, state.activeZoneColor || 'var(--accent)');
  } else {
    closeMobileThread();
  }
}

function pathForTask(task) {
  return cardPathForProject(task.projectId, task.ledgerId, task.zoneId || 'ungrouped', task.cardId);
}

function navigate(path, replace = false) {
  const destination = new URL(path, location.origin);
  const currentLocation = `${location.pathname}${location.search}${location.hash}`;
  const nextLocation = `${destination.pathname}${destination.search}${destination.hash}`;
  if (currentLocation !== nextLocation && !closeCardDetail()) return false;
  const projectScope = parseProjectScope(destination.pathname);
  const desktopCanvasRoute = window.matchMedia?.('(min-width: 761px)').matches === true
    && (destination.pathname === '/projects-canvas'
      || (projectScope?.segments[0] === 'ledgers' && !isProjectCardPath(destination.pathname)));
  // WHAT: Reload through the unified entry when a wide viewport enters a canvas-owned route.
  // WHY: Canvas initialization is intentionally desktop-only and must replace the responsive runtime.
  if (desktopCanvasRoute) {
    location.assign(destination.href);
    return;
  }
  const returnPath = `${location.pathname}${location.search}${location.hash}`;
  history[replace ? 'replaceState' : 'pushState']({ returnPath }, '', path);
  closeMenu();
  return loadRoute();
}

async function navigateVoiceSubmission() {
  await navigate(controlRoomPath('queue'), true);
}

async function navigateTaskBack(destination) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  if (typeof document.startViewTransition !== 'function' || reducedMotion) {
    await navigate(destination);
    return;
  }
  document.documentElement.dataset.taskBackHandoff = 'true';
  try {
    const transition = document.startViewTransition(() => navigate(destination));
    await transition.finished;
  } finally {
    delete document.documentElement.dataset.taskBackHandoff;
  }
}

function completionReturnPath() {
  const returnPath = asText(history.state?.returnPath);
  return returnPath.startsWith('/') ? returnPath : controlRoomPath('queue');
}

function objectId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function openCreationModal(kind) {
  creationKind = kind;
  const labels = {
    project: ['New project', 'Project name', 'Create project'],
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
  document.querySelector('#creation-description').placeholder = kind === 'card' ? 'Markdown is supported' : 'Optional';
  document.querySelector('#creation-description-label').textContent = kind === 'project' ? 'Description (optional)' : 'Description';
  document.querySelector('.creation-description-field').hidden = kind !== 'card' && kind !== 'project';
  document.querySelector('.creation-color-field').hidden = kind !== 'zone';
  if (kind === 'zone') document.querySelector('#creation-color').value = state.projects.find((project) => project.id === state.resourceProjectId)?.color || defaultAccent;
  document.querySelector('.creation-submit').textContent = submit;
  document.querySelector('.creation-error').hidden = true;
  creationModal.showModal();
  name.focus();
}

async function ledgerMutation(ledgerId, mutation, projectId = state.resourceProjectId) {
  const response = await projectFetch(`/decision-os/${encodeURIComponent(ledgerId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  }, projectId);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  if (!payload?.ok || projectId !== state.resourceProjectId || ledgerId !== state.activeLedgerId || !state.ledger) return payload;
  if (payload.changedCard) {
    const cards = Array.isArray(state.ledger.cards) ? state.ledger.cards : [];
    state.ledger.cards = cards.some((card) => String(card.id) === String(payload.changedCard.id))
      ? cards.map((card) => String(card.id) === String(payload.changedCard.id) ? payload.changedCard : card)
      : [...cards, payload.changedCard];
  }
  if (Array.isArray(payload.removedCardIds) && payload.removedCardIds.length) {
    const removed = new Set(payload.removedCardIds.map(String));
    state.ledger.cards = (state.ledger.cards ?? []).filter((card) => !removed.has(String(card.id)));
  }
  if (payload.changedAnnotation) {
    const annotations = Array.isArray(state.ledger.annotations) ? state.ledger.annotations : [];
    state.ledger.annotations = annotations.some((entry) => String(entry.id) === String(payload.changedAnnotation.id))
      ? annotations.map((entry) => String(entry.id) === String(payload.changedAnnotation.id) ? payload.changedAnnotation : entry)
      : [...annotations, payload.changedAnnotation];
  }
  if (payload.changedThread) {
    state.ledger.threadFiles = { ...(state.ledger.threadFiles ?? {}), ...(payload.changedThread.threadFiles ?? {}) };
    state.ledger.notes = { ...(state.ledger.notes ?? {}), ...(payload.changedThread.notes ?? {}) };
    state.ledger.deletedNoteIds = { ...(state.ledger.deletedNoteIds ?? {}), ...(payload.changedThread.deletedNoteIds ?? {}) };
  }
  return state.ledger;
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
  const response = await projectFetch('/decision-os/ledgers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: name })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false || !payload?.tab?.id) throw new Error(payload?.error || 'Could not create ledger.');
  state.ledger = null;
  navigate(ledgerPath(payload.tab.id));
}

async function createProject(name, description) {
  const project = await createProjectRequest({ fetchImpl: fetch, name, description });
  state.projects = [...state.projects, project].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  setMobileCodexContext({ projects: state.projects });
  navigate(projectPath(project.id));
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
  syncMobileThreadContext({ projectId: state.resourceProjectId, ledgerId: state.activeLedgerId, ledger: state.ledger, ledgers: state.ledgers, onCodexStarted: activateMasterTask });
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
    if (creationKind === 'project') await createProject(name, document.querySelector('#creation-description').value);
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
  const route = location.pathname === '/' ? 'control-room' : location.pathname.split('/').filter(Boolean)[0] ?? '';
  const icons = {
    dashboard: '<path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z"/>',
    book: '<path d="M5 4h6a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm14 0h-2a3 3 0 0 0-3 3v13h2a3 3 0 0 0 3-3V4Z"/>',
    flow: '<path d="M5 5h4v4H5V5Zm10 10h4v4h-4v-4ZM7 9v3a5 5 0 0 0 5 5h3M9 7h6a2 2 0 0 1 2 2v6"/>',
    library: '<path d="M4 5h4v15H4V5Zm6-1h4v16h-4V4Zm6 3h4v13h-4V7Z"/>',
    settings: '<path d="M10.8 3h2.4l.6 2.2a7 7 0 0 1 1.5.9l2.2-.6 1.2 2.1-1.6 1.6c.1.5.2 1.1.2 1.8s-.1 1.3-.2 1.8l1.6 1.6-1.2 2.1-2.2-.6a7 7 0 0 1-1.5.9l-.6 2.2h-2.4l-.6-2.2a7 7 0 0 1-1.5-.9l-2.2.6-1.2-2.1 1.6-1.6A7 7 0 0 1 6.7 11c0-.7.1-1.3.2-1.8L5.3 7.6l1.2-2.1 2.2.6a7 7 0 0 1 1.5-.9L10.8 3Zm1.2 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>'
  };
  const destination = (label, href, icon, activeRoute, className = '') => {
    const link = document.createElement(href ? 'a' : 'button');
    link.className = `ledger-link ${className}${route === activeRoute ? ' active' : ''}`.trim();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.dataset.navIcon = icon;
    svg.innerHTML = icons[icon];
    const text = document.createElement('span');
    text.textContent = label;
    link.append(svg, text);
    if (route === activeRoute) link.setAttribute('aria-current', 'page');
    if (href) link.href = href;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (href) navigate(href);
    });
    return link;
  };
  elements['ledger-links'].replaceChildren(
    destination('Control room', controlRoomPath(state.controlTab), 'dashboard', 'control-room'),
    destination('Projects', projectPath(), 'folder', 'projects'),
    destination('Ledgers', '/ledgers', 'book', 'ledgers'),
    destination('Pipelines', '/pipelines', 'flow', 'pipelines', 'nav-pipelines-button'),
    destination('Skill library', '/skills', 'library', 'skills', 'nav-skills-button'),
    destination('Settings', '/settings', 'settings', 'settings', 'nav-settings-button')
  );
}

function renderCodexProcessLimit(value) {
  const limit = Number(value) || codexProcessLimitRange.minimum;
  elements['codex-settings-limit'].value = String(limit);
  elements['codex-settings-limit'].textContent = String(limit);
  document.querySelector('.codex-settings-increase').disabled = limit >= codexProcessLimitRange.maximum;
  document.querySelector('.codex-settings-decrease').disabled = limit <= codexProcessLimitRange.minimum;
}

async function loadCodexSettings() {
  elements['codex-settings-message'].textContent = 'Loading…';
  try {
    const settings = await loadCodexProcessSettings(fetch);
    renderCodexProcessLimit(settings.maxConcurrentCodexProcesses);
    elements['codex-settings-message'].textContent = '';
  } catch (error) {
    elements['codex-settings-message'].textContent = error instanceof Error ? error.message : 'Could not load settings.';
  }
}

function renderSettings() {
  const enteringSettings = elements['settings-view'].hidden;
  if (enteringSettings) {
    federationFormDirty = false;
    federationSettingsLoadGeneration += 1;
  }
  state.resourceProjectId = '';
  setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
  renderLedgerLinks();
  renderCodexProcessLimit(elements['codex-settings-limit'].value);
  setView('settings-view');
  void loadCodexSettings();
  void loadFederationConnectionSettings({ hydrateForm: enteringSettings, generation: federationSettingsLoadGeneration });
}

function compactDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function elapsedSince(settings, timestamp) {
  if (!timestamp) return 0;
  const serverElapsed = Math.max(0, Number(settings.observedAt || Date.now()) - Number(timestamp));
  return serverElapsed + Math.max(0, Date.now() - Number(settings.receivedAt || Date.now()));
}

function connectionPhase(settings) {
  if (settings.connected) return 'connected';
  if (!settings.configured) return 'not_configured';
  return ['connecting', 'retrying', 'disconnected'].includes(settings.phase) ? settings.phase : 'connecting';
}

function renderFederationStatusClock() {
  const settings = latestFederationSettings;
  if (!settings) return;
  const phase = connectionPhase(settings);
  const status = elements['federation-connection-status'];
  const label = status.querySelector('strong');
  const summary = status.querySelector('small');
  const attempt = Math.max(1, Number(settings.reconnectAttempt || 0) + 1);
  const phaseStartedAt = phase === 'connected'
    ? settings.connectedAt
    : settings.connectionStartedAt || settings.phaseSince;
  const duration = compactDuration(elapsedSince(settings, phaseStartedAt));
  const retryIn = settings.nextRetryAt
    ? compactDuration(Math.max(0, Number(settings.nextRetryAt) - Number(settings.observedAt || Date.now()) - (Date.now() - settings.receivedAt)))
    : '';
  const labels = { connected: 'Connected', connecting: 'Connecting', retrying: 'Retrying', disconnected: 'Not connected', not_configured: 'Not configured' };
  label.textContent = labels[phase];
  summary.textContent = phase === 'connected'
    ? `Online for ${duration}`
    : phase === 'connecting'
      ? `Attempt ${attempt} · ${duration}`
      : phase === 'retrying'
        ? `Attempt ${attempt}${retryIn ? ` · retry in ${retryIn}` : ''}`
        : phase === 'not_configured' ? 'Connection settings required' : `Offline for ${duration}`;
  status.dataset.state = phase;
  elements['federation-state-duration'].textContent = phase === 'connected'
    ? `Connected for ${duration}`
    : phase === 'retrying'
      ? `Retrying for ${duration}${retryIn ? `; next attempt in ${retryIn}` : ''}`
      : phase === 'connecting'
        ? `Connecting for ${duration}`
        : phase === 'not_configured' ? 'Not configured' : `Disconnected for ${duration}`;
}

function hydrateFederationFormFromSettings(settings, force = false) {
  const form = document.querySelector('.federation-settings-form');
  const hydrated = hydrateFederationForm(form, settings, { dirty: federationFormDirty, force });
  if (hydrated) federationFormDirty = false;
}

function renderFederationConnection(settings, { hydrateForm = false, forceHydration = false } = {}) {
  settings.receivedAt = Date.now();
  latestFederationSettings = settings;
  if (hydrateForm) hydrateFederationFormFromSettings(settings, forceHydration);
  renderFederationStatusClock();
  elements['federation-attempt-timeout'].textContent = settings.connectTimeoutMs
    ? `${Math.round(settings.connectTimeoutMs / 1000)} seconds per attempt`
    : 'Not reported by this server';
  elements['federation-last-connection'].textContent = settings.lastConnectedAt
    ? new Date(settings.lastConnectedAt).toLocaleString()
    : 'Never connected since server start';
  const close = settings.lastCloseCode ? ` (code ${settings.lastCloseCode}${settings.lastCloseReason ? `: ${settings.lastCloseReason}` : ''})` : '';
  elements['federation-last-issue'].textContent = settings.lastError ? `${settings.lastError}${close}` : 'None';
  elements['federation-peer-list'].replaceChildren(...(settings.peers || []).map((peer) => {
    const row = document.createElement('div');
    row.className = 'federation-peer';
    row.innerHTML = '<span><strong></strong><br><small></small></span><span class="federation-peer-state"></span>';
    row.querySelector('strong').textContent = peer.nodeLabel || peer.nodeId;
    row.querySelector('small').textContent = `${peer.nodeId} · ${peer.projectCount} ${peer.projectCount === 1 ? 'project' : 'projects'}`;
    row.querySelector('.federation-peer-state').textContent = peer.online ? 'Online' : 'Offline';
    row.querySelector('.federation-peer-state').dataset.online = String(Boolean(peer.online));
    return row;
  }));
  document.querySelector('.federation-settings-disconnect').disabled = !settings.configured;
}

async function loadFederationConnectionSettings({ hydrateForm = false, generation = federationSettingsLoadGeneration } = {}) {
  window.clearTimeout(federationStatusRefreshTimer);
  if (hydrateForm) elements['federation-settings-message'].textContent = 'Loading…';
  try {
    const settings = await loadFederationSettings(fetch);
    if (generation !== federationSettingsLoadGeneration || elements['settings-view'].hidden) return;
    renderFederationConnection(settings, { hydrateForm });
    elements['federation-settings-message'].textContent = '';
    if (!federationStatusClockTimer) federationStatusClockTimer = window.setInterval(renderFederationStatusClock, 1000);
    const refreshDelay = latestFederationSettings?.connected ? 10_000 : 2_000;
    federationStatusRefreshTimer = window.setTimeout(() => {
      if (!elements['settings-view'].hidden) void loadFederationConnectionSettings({ generation });
    }, refreshDelay);
  } catch (error) {
    if (generation !== federationSettingsLoadGeneration || elements['settings-view'].hidden) return;
    elements['federation-settings-message'].textContent = error instanceof Error ? error.message : 'Could not load federation settings.';
    federationStatusRefreshTimer = window.setTimeout(() => {
      if (!elements['settings-view'].hidden) void loadFederationConnectionSettings({ generation });
    }, 5_000);
  }
}

async function submitFederationSettings(enabled = true) {
  const form = document.querySelector('.federation-settings-form');
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  elements['federation-settings-message'].textContent = enabled ? 'Connecting…' : 'Disconnecting…';
  try {
    const values = Object.fromEntries(new FormData(form));
    const result = await saveFederationSettings(fetch, { enabled, ...values });
    renderFederationConnection(result, { hydrateForm: true, forceHydration: true });
    elements['federation-settings-message'].textContent = enabled ? 'Settings saved. Connection is updating.' : 'Federation disconnected.';
    await loadRoute();
  } catch (error) {
    elements['federation-settings-message'].textContent = error instanceof Error ? error.message : 'Could not save federation settings.';
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function submitCodexProcessSettings() {
  const save = document.querySelector('.codex-settings-save');
  save.disabled = true;
  elements['codex-settings-message'].textContent = '';
  try {
    const result = await saveCodexProcessSettings(fetch, elements['codex-settings-limit'].value);
    renderCodexProcessLimit(result.maxConcurrentCodexProcesses);
    elements['codex-settings-message'].textContent = 'Settings saved.';
  } catch (error) {
    elements['codex-settings-message'].textContent = error instanceof Error ? error.message : 'Could not save settings.';
  } finally {
    save.disabled = false;
  }
}

function renderProjects() {
  state.resourceProjectId = '';
  setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
  state.activeLedgerId = '';
  state.activeZoneId = '';
  state.viewedProjectId = '';
  renderLedgerLinks();
  elements['projects-summary'].textContent = `${state.projects.length} ${state.projects.length === 1 ? 'project' : 'projects'}`;
  elements['project-list'].replaceChildren(...state.projects.map((project) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-card';
    button.style.setProperty('--project-color', project.color);
    button.innerHTML = '<span class="project-card-copy"><span class="project-card-heading"><strong></strong><small></small></span><span class="project-card-description"></span><code></code></span><span class="row-arrow">›</span>';
    button.querySelector('strong').textContent = project.name;
    const badge = button.querySelector('small');
    badge.hidden = false;
    badge.textContent = projectPresenceLabel(project);
    button.querySelector('.project-card-description').textContent = project.description || 'No description provided.';
    button.querySelector('code').textContent = `Owned by ${projectOwnerLabel(project)} · ${project.id}`;
    button.setAttribute('aria-label', `${project.name}, ${projectPresenceLabel(project)}`);
    button.disabled = project.remote && !project.online;
    if (!button.disabled) button.addEventListener('click', () => {
      state.viewedProjectId = project.id;
      openProjectSettings();
    });
    return button;
  }));
  setView('projects-view');
  document.title = 'Projects · Decision OS';
}

function renderProjectDetail(project) {
  state.resourceProjectId = '';
  setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
  state.activeLedgerId = '';
  state.activeZoneId = '';
  state.viewedProjectId = project.id;
  document.documentElement.style.setProperty('--accent', project.color || defaultAccent);
  document.documentElement.style.setProperty('--accent-strong', project.color || defaultAccent);
  renderLedgerLinks();
  elements['project-detail-name'].textContent = project.name;
  elements['project-detail-description'].textContent = project.description || 'No description provided.';
  elements['project-detail-color'].style.setProperty('--project-color', project.color);
  elements['project-detail-color'].style.backgroundColor = project.color;
  elements['project-detail-status'].textContent = project.remote && !project.online
    ? `${projectOwnerLabel(project)} · Offline`
    : `${projectPresenceLabel(project)} · ${project.ledgers.length} ${project.ledgers.length === 1 ? 'ledger' : 'ledgers'}`;
  elements['project-detail-path'].textContent = `Owned by ${projectOwnerLabel(project)} · ${project.id}`;
  document.querySelector('.project-settings-button').hidden = Boolean(project.remote);
  setView('project-detail-view');
  document.title = `${project.name} · Projects`;
}

function openProjectSettings() {
  const project = state.projects.find((entry) => entry.id === state.viewedProjectId);
  if (!project) return;
  const values = projectSettingsValues(project);
  const name = document.querySelector('#project-settings-name');
  const description = document.querySelector('#project-settings-description');
  name.value = values.name;
  description.value = values.description;
  name.disabled = Boolean(project.remote);
  description.disabled = Boolean(project.remote);
  projectSettingsColorInput.value = values.color;
  document.querySelector('.project-settings-color-trigger').disabled = Boolean(project.remote);
  document.querySelector('.project-settings-save').hidden = Boolean(project.remote);
  document.querySelector('.project-settings-owner').textContent = `${projectPresenceLabel(project)} · ${project.id}`;
  const sync = document.querySelector('.project-settings-sync');
  sync.disabled = !project.originFingerprint || project.online === false;
  sync.dataset.projectId = project.id;
  renderProjectSyncStatus(project.id);
  renderProjectSettingsColorField(values.color);
  document.querySelector('.project-settings-error').hidden = true;
  projectSettingsModal.showModal();
  (project.remote ? sync : name).focus();
}

function projectSyncRunFor(projectId) {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) return null;
  return state.projectSyncRuns.find((run) => run.sourceNodeId === project.ownerNodeId && run.sourceProjectId === project.localProjectId)
    || state.projectSyncRuns.find((run) => run.initiatorProjectId === project.localProjectId)
    || null;
}

function renderProjectSyncStatus(projectId = state.viewedProjectId) {
  const status = document.querySelector('.project-settings-sync-status');
  if (!status) return;
  const run = projectSyncRunFor(projectId);
  status.textContent = run
    ? run.phase === 'failed' ? `Failed · ${run.error?.message || 'Review the run evidence.'}` : `Sync ${run.phase.replaceAll('_', ' ')} · ${run.syncId}`
    : 'No synchronization has been started from this node.';
  status.dataset.phase = run?.phase || 'idle';
  const button = document.querySelector('.project-settings-sync');
  if (button) button.disabled = Boolean(run && !['complete', 'failed'].includes(run.phase));
}

function notifyProjectSync(run) {
  if (!['complete', 'failed'].includes(run.phase)) return;
  const existing = document.querySelector(`[data-sync-notification="${CSS.escape(run.syncId)}"]`);
  if (existing) return;
  const notification = document.createElement('button');
  notification.type = 'button';
  notification.className = 'project-sync-notification';
  notification.dataset.syncNotification = run.syncId;
  notification.textContent = run.phase === 'complete' ? 'Project synchronization complete.' : `Project synchronization failed: ${run.error?.message || 'Unknown failure.'}`;
  notification.addEventListener('click', () => {
    const project = state.projects.find((entry) => entry.localProjectId === run.initiatorProjectId || entry.localProjectId === run.sourceProjectId);
    if (project) {
      state.viewedProjectId = project.id;
      openProjectSettings();
    }
    notification.remove();
  });
  document.querySelector('.project-sync-notifications').append(notification);
}

async function refreshProjectSyncRuns() {
  try {
    state.projectSyncRuns = await loadProjectSyncRuns(fetch);
    renderProjectSyncStatus();
    state.projectSyncRuns.forEach(notifyProjectSync);
  } catch { /* Connection recovery is driven by the next SSE event or route load. */ }
}

async function startSelectedProjectSync() {
  const project = state.projects.find((entry) => entry.id === state.viewedProjectId);
  if (!project) return;
  const button = document.querySelector('.project-settings-sync');
  button.disabled = true;
  try {
    const run = await startProjectSyncRequest({ fetchImpl: fetch, sourceProjectId: project.id, idempotencyKey: `${project.id}:${project.originFingerprint}` });
    state.projectSyncRuns = [run, ...state.projectSyncRuns.filter((entry) => entry.syncId !== run.syncId)];
    renderProjectSyncStatus(project.id);
  } catch (error) {
    const status = document.querySelector('.project-settings-sync-status');
    status.textContent = error instanceof Error ? error.message : 'Synchronization could not start.';
    status.dataset.phase = 'failed';
    button.disabled = false;
  }
}

function subscribeProjectSyncEvents() {
  if (projectSyncEventSource || typeof EventSource === 'undefined') return;
  projectSyncEventSource = new EventSource('/api/project-sync/events');
  projectSyncEventSource.addEventListener('project-sync', (event) => {
    const run = JSON.parse(event.data);
    state.projectSyncRuns = [run, ...state.projectSyncRuns.filter((entry) => entry.syncId !== run.syncId)];
    renderProjectSyncStatus();
    notifyProjectSync(run);
  });
}

async function submitProjectSettings() {
  const project = state.projects.find((entry) => entry.id === state.viewedProjectId);
  if (!project || !projectSettingsForm.reportValidity()) return;
  const save = document.querySelector('.project-settings-save');
  const error = document.querySelector('.project-settings-error');
  save.disabled = true;
  save.setAttribute('aria-busy', 'true');
  error.hidden = true;
  try {
    const result = await saveProjectSettingsRequest({
      fetchImpl: fetch,
      projects: state.projects,
      projectId: project.id,
      values: {
        name: document.querySelector('#project-settings-name').value,
        description: document.querySelector('#project-settings-description').value,
        color: projectSettingsColorInput.value,
      },
    });
    state.projects = result.projects;
    if (state.resourceProjectId === result.project.id) setResourceProject(result.project.id);
    projectSettingsModal.close();
    renderProjectDetail(result.project);
    window.requestAnimationFrame(() => document.querySelector('.project-settings-button').focus());
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Project update failed.';
    error.hidden = false;
  } finally {
    save.disabled = false;
    save.removeAttribute('aria-busy');
  }
}

function renderOverview() {
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  document.querySelector('.create-ledger-button').hidden = false;
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

function renderGlobalLedgers() {
  state.resourceProjectId = '';
  state.projectName = 'Decision OS';
  setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  const ledgers = state.projects.flatMap((project) => project.ledgers.map((ledger) => ({ project, ledger })));
  elements['overview-summary'].textContent = `${ledgers.length} ${ledgers.length === 1 ? 'ledger' : 'ledgers'} across ${state.projects.length} projects`;
  elements['overview-ledgers'].replaceChildren(...ledgers.map(({ project, ledger }) => {
    const link = document.createElement('a');
    link.className = 'overview-ledger';
    link.href = ledgerPathForProject(project.id, ledger.id);
    link.innerHTML = '<span><h2></h2><p></p></span><span class="row-arrow">›</span>';
    link.querySelector('h2').textContent = ledger.title;
    link.querySelector('p').textContent = `${project.name} · ${ledger.id}`;
    link.addEventListener('click', (event) => { event.preventDefault(); navigate(link.getAttribute('href')); });
    return link;
  }));
  document.querySelector('.create-ledger-button').hidden = true;
  setView('overview-view');
  document.title = 'Ledgers · Decision OS';
}

function filteredControlTasks(tab = state.controlTab) {
  const tasks = state.controlRoom?.[tab] ?? [];
  const projectTasks = state.projectFilter === 'All' ? tasks : tasks.filter((task) => task.projectId === state.projectFilter);
  return state.controlFilter === 'All' ? projectTasks : projectTasks.filter((task) => task.ledgerId === state.controlFilter);
}

function taskIdentity(task) {
  return [task.projectId, task.ledgerId, task.cardId].map((part) => encodeURIComponent(String(part))).join('--');
}

function syncQueueFromDom() {
  const queueList = elements['control-task-list'].querySelector('[data-control-column-list="queue"]');
  const rows = [...(queueList?.querySelectorAll('.control-task') ?? [])];
  const orderedIds = rows.map((row) => row.dataset.taskId);
  const visible = filteredControlTasks('queue');
  const byId = new Map(visible.map((task) => [taskIdentity(task), task]));
  const reordered = orderedIds.map((taskId) => byId.get(taskId)).filter(Boolean);
  const visibleIds = new Set(visible.map(taskIdentity));
  let replacementIndex = 0;
  state.controlRoom.queue = state.controlRoom.queue.map((task) => visibleIds.has(taskIdentity(task)) ? reordered[replacementIndex++] : task);
  rows.forEach((row, index) => row.classList.toggle('next-task', index === 0));
}

function destroyQueueSortables() {
  queueSortables.forEach((sortable) => sortable.destroy());
  queueSortables = [];
}

function queueDragInProgress() {
  return queueDragActive || queueDragSettling;
}

function queueRefreshBlocked() {
  return queueDragInProgress() || queuePersistenceActive;
}

function removeQueueDragArtifacts() {
  const taskList = elements['control-task-list'];
  document.querySelectorAll('.queue-task-fallback, .queue-task-ghost, .queue-task-chosen, .queue-task-dragging').forEach((node) => {
    if (node.classList.contains('control-task') && !taskList.contains(node)) {
      node.remove();
      return;
    }
    node.classList.remove('queue-task-fallback', 'queue-task-ghost', 'queue-task-chosen', 'queue-task-dragging');
  });
}

async function settleQueueDrag({ persist = false, rerender = false } = {}) {
  removeQueueDragArtifacts();
  if (rerender) renderControlRoom();
  try {
    if (persist) queueQueueOrderPersistence();
  } finally {
    removeQueueDragArtifacts();
    queueDragActive = false;
    queueDragSettling = false;
    queueDragInterrupted = false;
    initializeQueueSortable();
    await flushPendingControlRoomRefresh();
  }
}

function interruptQueueDrag() {
  if (!queueDragActive) return;
  queueDragInterrupted = true;
  queueDragActive = false;
  queueDragSettling = true;
  destroyQueueSortables();
  queueMicrotask(() => void settleQueueDrag({ rerender: true }));
}

function initializeQueueSortable() {
  destroyQueueSortables();
  if (typeof globalThis.Sortable !== 'function') return;
  const desktop = window.matchMedia('(min-width: 760px)').matches;
  const lists = [...elements['control-task-list'].querySelectorAll('[data-control-column-list]')]
    .filter((list) => desktop || list.dataset.controlColumnList === 'queue')
    .filter((list) => list.dataset.controlColumnList !== 'exec');
  queueSortables = lists.map((list) => globalThis.Sortable.create(list, {
    animation: 180,
    draggable: '.control-task',
    group: desktop ? { name: 'control-room-workflow', pull: true, put: true } : undefined,
    sort: list.dataset.controlColumnList === 'queue',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 4,
    delay: 300,
    delayOnTouchOnly: true,
    touchStartThreshold: 8,
    chosenClass: 'queue-task-chosen',
    dragClass: 'queue-task-dragging',
    ghostClass: 'queue-task-ghost',
    fallbackClass: 'queue-task-fallback',
    onStart(event) {
      queueDragActive = true;
      queueDragSettling = false;
      queueDragInterrupted = false;
      queueDragOrigin = {
        tab: event.from.dataset.controlColumnList,
        taskId: event.item.dataset.taskId,
      };
    },
    onEnd(event) {
      queueDragActive = false;
      if (queueDragInterrupted) return;
      queueDragSettling = true;
      const sourceTab = queueDragOrigin?.tab;
      const targetTab = event.to.dataset.controlColumnList;
      const taskId = queueDragOrigin?.taskId;
      queueDragOrigin = null;
      const placementChanged = sourceTab && targetTab && sourceTab !== targetTab;
      const orderChanged = targetTab === 'queue' && event.oldIndex !== event.newIndex;
      if (placementChanged) {
        queueMicrotask(() => void persistControlTaskPlacement({ taskId, sourceTab, targetTab, newIndex: event.newIndex }));
        return;
      }
      if (orderChanged) syncQueueFromDom();
      queueMicrotask(() => void settleQueueDrag({ persist: orderChanged }));
    }
  }));
}

document.addEventListener('pointercancel', interruptQueueDrag, true);
document.addEventListener('touchcancel', interruptQueueDrag, true);
window.addEventListener('blur', interruptQueueDrag);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) interruptQueueDrag();
});

function controlTaskCount(tab) {
  const tasks = state.controlRoom?.[tab] ?? [];
  const projectTasks = state.projectFilter === 'All' ? tasks : tasks.filter((task) => task.projectId === state.projectFilter);
  return state.controlFilter === 'All' ? projectTasks.length : projectTasks.filter((task) => task.ledgerId === state.controlFilter).length;
}

function controlRoomNodes() {
  return [...state.projects.reduce((groups, project) => {
    const nodeId = project.ownerNodeId || 'local';
    const existing = groups.get(nodeId);
    if (existing) existing.projects.push(project);
    else groups.set(nodeId, { nodeId, label: projectOwnerLabel(project), projects: [project] });
    return groups;
  }, new Map()).values()];
}

function shortcutKey(value) {
  const key = document.createElement('span');
  key.className = 'terminal-button__key';
  key.textContent = value;
  return key;
}

function selectControlProject(projectId) {
  state.projectFilter = projectId;
  state.controlFilter = 'All';
  renderControlRoom();
}

function cycleControlRoomNode() {
  const nodes = controlRoomNodes();
  if (nodes.length < 2) return;
  state.controlNodeIndex = (state.controlNodeIndex + 1) % nodes.length;
  selectControlProject('All');
}

function taskRow(task, tab, index) {
  const article = document.createElement('article');
  article.className = `control-task${index === 0 && tab === 'queue' ? ' next-task' : ''}`;
  article.id = `task-${taskIdentity(task)}`;
  article.dataset.taskId = taskIdentity(task);
  article.draggable = false;
  const summary = document.createElement('button');
  summary.type = 'button';
  summary.className = 'control-task-summary';
  article.style.borderInlineStartColor = task.projectColor || 'transparent';
  article.style.setProperty('--accent', task.projectColor || defaultAccent);
  const executing = tab === 'exec';
  summary.innerHTML = `<span class="task-copy"><strong></strong><span class="task-meta"></span>${task.nextSubtask || executing ? '<span class="task-next"></span>' : ''}</span>`;
  summary.querySelector('strong').textContent = task.title;
  if (executing) {
    const runtimeStatus = summary.querySelector('.task-next');
    if (task.codexQueued) {
      runtimeStatus.className = 'task-queue-position';
      runtimeStatus.textContent = Number.isInteger(task.codexQueuePosition)
        ? `Queued · position ${task.codexQueuePosition}`
        : 'Queued · waiting for execution';
    } else if (task.executionSince) {
      runtimeStatus.className = 'task-stopwatch';
      runtimeStatus.dataset.executionSince = task.executionSince;
      runtimeStatus.textContent = executionStopwatch(task.executionSince);
    } else {
      runtimeStatus.textContent = 'Running';
    }
  }
  const age = task.status === 'task-backlog' ? 'backlog' : task.status === 'task-execution' ? executionAge(task.executionSince) : waitingAge(task.waitingSince);
  const process = task.codexProcessing ? ` · Codex ${task.codexRunId}` : '';
  const taskOwner = task.ownerNodeLabel || task.ownerNodeId || state.projects.find((project) => project.id === task.projectId)?.ownerNodeLabel || 'This server';
  if (summary.querySelector('.task-meta')) {
    summary.querySelector('.task-meta').textContent = `${task.projectName} · ${taskOwner} · ${task.ledger} · ${age}${process}`;
  }
  const nextSubtask = !executing ? summary.querySelector('.task-next') : null;
  if (nextSubtask) nextSubtask.textContent = `Next: ${task.nextSubtask.title}`;
  if (task.diagnostics.length) {
    article.classList.add('has-diagnostics');
    const diagnostic = document.createElement('span');
    diagnostic.className = 'task-diagnostic';
    diagnostic.textContent = task.diagnostics.join(' · ');
    summary.querySelector('.task-copy').append(diagnostic);
  }
  summary.addEventListener('click', () => navigate(pathForTask(task)));
  article.append(summary);
  return article;
}

function renderControlRoom() {
  destroyQueueSortables();
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  const nodes = controlRoomNodes();
  state.controlNodeIndex = nodes.length ? state.controlNodeIndex % nodes.length : 0;
  const activeNode = nodes[state.controlNodeIndex];
  const projectFilters = [{ id: 'All', name: 'All projects', color: '#20242b' }, ...(activeNode?.projects ?? state.projects)];
  if (!projectFilters.some((project) => project.id === state.projectFilter)) state.projectFilter = 'All';
  const showProjectFilters = state.projectFilter === 'All';
  const projectButtons = projectFilters.map((project, index) => {
    const presentation = projectFilterChipPresentation(project);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `project-filter-chip${project.id === 'All' ? ' all-projects-filter' : ''}`;
    const label = document.createElement('span');
    label.className = 'project-filter-label';
    label.textContent = presentation.label;
    button.append(label);
    if (project.id !== 'All' && index <= 9) button.append(shortcutKey(String(index)));
    button.title = project.id === 'All' ? project.name : `${project.name} (${project.id}) owned by ${projectOwnerLabel(project)}`;
    button.disabled = project.online === false;
    button.setAttribute('aria-pressed', String(project.id === state.projectFilter));
    button.style.setProperty('--project-color', project.color);
    button.style.setProperty('--project-foreground', presentation.foreground);
    if (presentation.showRemoteMarker) {
      const remoteIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      remoteIcon.classList.add('project-filter-remote-icon');
      remoteIcon.setAttribute('aria-hidden', 'true');
      remoteIcon.setAttribute('viewBox', '0 0 16 16');
      remoteIcon.innerHTML = '<path d="M5.5 3.5h-2v9h9v-2M8 3.5h4.5V8M12 4 7 9" />';
      button.append(remoteIcon);
    }
    button.addEventListener('click', () => selectControlProject(project.id));
    return button;
  });
  if (nodes.length > 1) {
    const nodeCycle = document.createElement('button');
    nodeCycle.type = 'button';
    nodeCycle.className = 'node-filter-cycle terminal-button terminal-button--nav';
    nodeCycle.append(shortcutKey('C'));
    const label = document.createElement('span');
    label.className = 'terminal-button__label';
    label.textContent = activeNode?.label ?? 'Node';
    nodeCycle.append(label);
    nodeCycle.title = 'Show projects from the next node';
    nodeCycle.addEventListener('click', cycleControlRoomNode);
    projectButtons.push(nodeCycle);
  }
  elements['control-project-filters'].hidden = !showProjectFilters;
  elements['control-project-filters'].replaceChildren(...(showProjectFilters ? projectButtons : []));
  const scopedLedgers = state.projects.find((project) => project.id === state.projectFilter)?.ledgers ?? [];
  const filters = [{ id: 'All', title: 'All ledgers' }, ...scopedLedgers];
  if (!filters.some((filter) => filter.id === state.controlFilter)) state.controlFilter = 'All';
  const ledgerButtons = filters.map((filter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ledger-filter-chip';
    button.textContent = filter.title;
    button.setAttribute('aria-pressed', String(filter.id === state.controlFilter));
    button.addEventListener('click', () => { state.controlFilter = filter.id; renderControlRoom(); });
    return button;
  });
  const clearProject = document.createElement('button');
  clearProject.type = 'button';
  clearProject.className = 'filter-clear-button';
  clearProject.textContent = 'Clear';
  clearProject.setAttribute('aria-label', 'Clear project and ledger filters');
  clearProject.addEventListener('click', () => {
    state.projectFilter = 'All';
    state.controlFilter = 'All';
    renderControlRoom();
  });
  elements['control-filters'].hidden = showProjectFilters;
  elements['control-filters'].replaceChildren(...(showProjectFilters ? [] : [...ledgerButtons, clearProject]));
  document.querySelectorAll('[data-control-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.controlTab === state.controlTab));
    const count = controlTaskCount(button.dataset.controlTab);
    button.querySelector('small').textContent = `${count} ${count === 1 ? 'task' : 'tasks'}`;
  });
  const columns = ['queue', 'exec', 'backlog'].map((tab) => {
    const tasks = filteredControlTasks(tab);
    const column = document.createElement('section');
    column.className = 'control-task-column';
    column.dataset.controlColumn = tab;
    column.dataset.active = String(tab === state.controlTab);
    const heading = document.createElement('header');
    heading.className = 'control-task-column-header';
    const title = document.createElement('h2');
    title.textContent = { queue: 'Queue', exec: 'Exec', backlog: 'Backlog' }[tab];
    const count = document.createElement('small');
    count.textContent = String(tasks.length);
    heading.append(title, count);
    const list = document.createElement('div');
    list.className = 'control-task-column-list';
    list.dataset.controlColumnList = tab;
    list.replaceChildren(...tasks.map((task, index) => taskRow(task, tab, index)));
    const empty = document.createElement('p');
    empty.className = 'control-column-empty';
    empty.hidden = tasks.length > 0;
    empty.textContent = { queue: 'No waiting tasks', exec: 'No executing tasks', backlog: 'No backlog tasks' }[tab];
    list.append(empty);
    column.append(heading, list);
    return column;
  });
  elements['control-task-list'].replaceChildren(...columns);
  initializeQueueSortable();
  elements['control-empty'].hidden = true;
  const diagnostics = Array.isArray(state.controlRoom?.diagnostics) ? state.controlRoom.diagnostics : [];
  const messages = [
    ...(state.controlRoom?.stale ? [`Showing cached revision ${state.controlRoom.revision}; the server is rebuilding.`] : []),
    ...diagnostics.map((entry) => Array.isArray(entry?.diagnostics) ? entry.diagnostics.join(' · ') : asText(entry?.message)).filter(Boolean)
  ];
  elements['control-diagnostics'].hidden = messages.length === 0;
  elements['control-diagnostics'].replaceChildren(...messages.map((message) => {
    const row = document.createElement('p');
    row.textContent = message;
    return row;
  }));
  setView('control-room-view');
  document.title = 'Control room · Decision OS';
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

async function loadControlRoom({ force = false, deferDuringQueueDrag = false } = {}) {
  const response = await fetch('/api/control-room', { cache: 'no-store', headers: !force && controlRoomEtag ? { 'if-none-match': controlRoomEtag } : {} });
  if (response.status === 304 && state.controlRoom) return false;
  if (!response.ok) throw new Error(`Could not load the Control Room (${response.status}).`);
  const nextControlRoom = await response.json();
  const nextEtag = response.headers.get('etag') ?? '';
  if (deferDuringQueueDrag && queueRefreshBlocked()) {
    pendingControlRoomRefresh = true;
    return false;
  }
  state.controlRoom = nextControlRoom;
  controlRoomEtag = nextEtag;
  return true;
}

async function refreshControlRoomFromEvent() {
  if (queueRefreshBlocked()) {
    pendingControlRoomRefresh = true;
    return;
  }
  try {
    if (await loadControlRoom({ deferDuringQueueDrag: true })) renderControlRoom();
  } catch (cause) {
    elements['control-diagnostics'].hidden = false;
    elements['control-diagnostics'].textContent = cause instanceof Error ? cause.message : 'Control Room refresh failed.';
  }
}

async function flushPendingControlRoomRefresh() {
  if (!pendingControlRoomRefresh || queueRefreshBlocked()) return;
  pendingControlRoomRefresh = false;
  await refreshControlRoomFromEvent();
}

function subscribeControlRoomEvents() {
  if (controlRoomEventSource || typeof EventSource === 'undefined') return;
  controlRoomEventSource = new EventSource('/api/control-room-events');
  const refresh = () => {
    clearTimeout(controlRoomRefreshTimer);
    controlRoomRefreshTimer = window.setTimeout(() => {
      if (location.pathname !== '/') return;
      void refreshControlRoomFromEvent();
    }, 80);
  };
  controlRoomEventSource.addEventListener('ledger-content-change', refresh);
  controlRoomEventSource.addEventListener('card-content-change', refresh);
}

function queueQueueOrderPersistence() {
  const sequence = ++queuePersistenceSequence;
  queuePersistenceActive = true;
  const reordered = filteredControlTasks('queue');
  const mutations = reordered.flatMap((task, index) => {
    const queueRank = index + 1;
    if (task.queueRank === queueRank) return [];
    task.queueRank = queueRank;
    const source = state.controlRoom.allTasks.find((candidate) => candidate.projectId === task.projectId && candidate.cardId === task.cardId && candidate.ledgerId === task.ledgerId);
    if (source) source.queueRank = queueRank;
    return [{ task, queueRank }];
  });
  queuePersistenceTail = queuePersistenceTail.then(async (previousSucceeded) => {
    if (!previousSucceeded) return false;
    return persistQueueOrder(mutations);
  });
  void queuePersistenceTail.then(async (persisted) => {
    if (sequence !== queuePersistenceSequence) return;
    try {
      if (!persisted) {
        pendingControlRoomRefresh = false;
        await loadControlRoom({ force: true });
        renderControlRoom();
        setView('error-view');
      }
    } finally {
      if (!persisted) queuePersistenceTail = Promise.resolve(true);
      queuePersistenceActive = false;
      await flushPendingControlRoomRefresh();
    }
  });
}

async function persistQueueOrder(mutations) {
  try {
    for (const { task, queueRank } of mutations) {
      await ledgerMutation(task.ledgerId, {
        action: 'patch-card',
        cardPatch: { id: task.cardId, queueRank }
      }, task.projectId);
    }
    return true;
  } catch (error) {
    elements['error-message'].textContent = error instanceof Error ? error.message : 'Queue order persistence failed.';
    return false;
  }
}

async function persistControlTaskPlacement({ taskId, sourceTab, targetTab, newIndex }) {
  const source = state.controlRoom?.[sourceTab] ?? [];
  const task = source.find((candidate) => taskIdentity(candidate) === taskId);
  if (!task || !['queue', 'backlog'].includes(sourceTab) || !['queue', 'backlog'].includes(targetTab)) {
    await loadControlRoom({ force: true });
    await settleQueueDrag({ rerender: true });
    return;
  }
  state.controlRoom[sourceTab] = source.filter((candidate) => candidate !== task);
  const target = state.controlRoom[targetTab];
  const visibleTarget = filteredControlTasks(targetTab);
  const before = visibleTarget[newIndex];
  const after = visibleTarget[newIndex - 1];
  const insertionIndex = before
    ? target.indexOf(before)
    : after ? target.indexOf(after) + 1 : target.length;
  target.splice(insertionIndex, 0, task);
  task.status = targetTab === 'backlog' ? 'task-backlog' : 'task-waiting';
  const canonical = state.controlRoom.allTasks.find((candidate) => taskIdentity(candidate) === taskId);
  if (canonical) canonical.status = task.status;
  renderControlRoom();
  try {
    await ledgerMutation(task.ledgerId, {
      action: 'patch-card',
      cardPatch: { id: task.cardId, status: targetTab === 'backlog' ? 'backlog' : 'todo' }
    }, task.projectId);
    if (targetTab === 'queue') queueQueueOrderPersistence();
  } catch (error) {
    await loadControlRoom({ force: true });
    renderControlRoom();
    elements['control-diagnostics'].hidden = false;
    elements['control-diagnostics'].textContent = error instanceof Error ? error.message : 'Task placement persistence failed.';
  } finally {
    await settleQueueDrag();
  }
}

async function activateMasterTask({ ledgerId, cardId }) {
  const ledger = await projectFetch(`/api/ledgers/${encodeURIComponent(ledgerId)}/canvas`, { cache: 'no-store' }).then((response) => response.json());
  const card = ledger.cards?.find((entry) => String(entry.id) === String(cardId));
  if (!card || !parseMasterCandidate(card)) return ledger;
  return ledger;
}

function parseMasterCandidate(card) {
  const labels = Array.isArray(card?.labels) ? card.labels.map(String) : [];
  return labels.includes('master-task') || (!labels.some((label) => label === 'master-task' || label === 'subtask') && /^\s*(?:#[a-z][a-z0-9-]*\s*)*#master-task\b(?:\s*#[a-z][a-z0-9-]*)*\s*$/im.test(ledgerCardBody(card)));
}

async function createTaskIntake(projectId) {
  setResourceProject(projectId);
  if (state.resourceProjectId !== projectId) throw new Error('The project is no longer available.');
  const ledgerRef = state.ledgers.find((entry) => entry.title === state.controlFilter || entry.id === state.controlFilter) ?? state.ledgers[0];
  if (!ledgerRef) throw new Error('Create a ledger before starting a task.');
  const ledger = await projectFetch(`/api/ledgers/${encodeURIComponent(ledgerRef.id)}/canvas`, { cache: 'no-store' }).then((response) => response.json());
  state.ledger = ledger;
  state.activeLedgerId = ledgerRef.id;
  const rect = nextZoneRect();
  const projectColor = state.projects.find((project) => project.id === projectId)?.color || defaultAccent;
  const zone = { id: objectId('zone'), ...rect, color: projectColor, label: 'New task intake', comments: [] };
  await ledgerMutation(ledgerRef.id, { action: 'create-zone', annotation: zone });
  const cardId = objectId('card');
  const timestamp = new Date().toISOString();
  const markdown = `Ledger: ${ledgerRef.title}\nWaiting since: ${timestamp}\n\n## Intake\n\nDescribe the task in this thread, attach the required files, then launch Codex. Categorize the task, keep this mandatory new zone, rename this master task and zone, create actionable subtask cards in this zone, and write canonical relationship-backed card links under \`## Subtasks\`.\n\n## Subtasks\n`;
  const card = { id: cardId, title: 'New task intake', cardType: 'note', domainId: ledgerRef.id, status: 'todo', labels: ['master-task'], x: rect.x + 60, y: rect.y + 60, w: 360, h: 240, comment: { what: markdown }, facts: [], fields: [] };
  const updated = await ledgerMutation(ledgerRef.id, { action: 'create-card', card });
  state.ledger = updated;
  state.activeZoneId = zone.id;
  state.activeZoneColor = zone.color;
  syncMobileThreadContext({
    projectId,
    ledgerId: ledgerRef.id,
    ledger: updated,
    ledgers: state.ledgers,
    onCodexStarted: activateMasterTask,
    onQuickVoiceSubmitted: navigateVoiceSubmission
  });
  await navigate(cardPath(ledgerRef.id, zone.id, cardId));
}

function openNewTaskProjectModal() {
  const tabList = document.querySelector('.new-task-node-tabs');
  const list = document.querySelector('.new-task-project-list');
  const error = document.querySelector('.new-task-project-error');
  const cancel = document.querySelector('.new-task-project-cancel');
  const nodes = [...state.projects.reduce((groups, project) => {
    const nodeId = project.ownerNodeId || 'local';
    const existing = groups.get(nodeId);
    if (existing) existing.projects.push(project);
    else groups.set(nodeId, {
      nodeId,
      label: projectOwnerLabel(project),
      online: project.online !== false,
      local: project.remote !== true,
      projects: [project],
    });
    return groups;
  }, new Map()).values()];
  const defaultNode = nodes.find((node) => node.local) ?? nodes[0];
  let activeNode = defaultNode;
  let tabButtons = [];

  delete newTaskProjectModal.dataset.busy;
  cancel.disabled = false;
  error.hidden = true;
  error.textContent = '';

  const renderProjects = () => {
    const projects = activeNode?.projects ?? [];
    list.replaceChildren(...projects.map((project) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'new-task-project-option';
      button.style.setProperty('--project-color', project.color);
      button.textContent = project.name;
      button.disabled = activeNode.online === false || Boolean(newTaskProjectModal.dataset.busy);
      button.addEventListener('click', async () => {
        newTaskProjectModal.dataset.busy = 'true';
        tabButtons.forEach((tab) => { tab.disabled = true; });
        [...list.querySelectorAll('button')].forEach((option) => { option.disabled = true; });
        cancel.disabled = true;
        button.setAttribute('aria-busy', 'true');
        error.hidden = true;
        try {
          await createTaskIntake(project.id);
          delete newTaskProjectModal.dataset.busy;
          newTaskProjectModal.close();
        } catch (cause) {
          error.textContent = cause instanceof Error ? cause.message : 'Task intake creation failed.';
          error.hidden = false;
          delete newTaskProjectModal.dataset.busy;
          cancel.disabled = false;
          tabButtons.forEach((tab) => { tab.disabled = false; });
          renderProjects();
        }
      });
      return button;
    }));
  };

  const selectNode = (node, focus = false) => {
    activeNode = node;
    tabButtons.forEach((tab, index) => {
      const selected = nodes[index] === node;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) list.setAttribute('aria-labelledby', tab.id);
    });
    renderProjects();
    if (focus) tabButtons[nodes.indexOf(node)]?.focus();
  };

  tabButtons = nodes.map((node, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `new-task-node-tab-${index}`;
    tab.className = 'new-task-node-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'new-task-project-panel');
    const label = document.createElement('strong');
    label.textContent = node.label;
    const presence = document.createElement('small');
    presence.textContent = node.online ? 'Online' : 'Offline';
    presence.dataset.online = String(node.online);
    tab.append(label, presence);
    tab.addEventListener('click', () => selectNode(node));
    tab.addEventListener('keydown', (event) => {
      const current = nodes.indexOf(activeNode);
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? nodes.length - 1
          : event.key === 'ArrowRight' ? (current + 1) % nodes.length
            : event.key === 'ArrowLeft' ? (current - 1 + nodes.length) % nodes.length
              : -1;
      if (next < 0) return;
      event.preventDefault();
      selectNode(nodes[next], true);
    });
    return tab;
  });
  tabList.replaceChildren(...tabButtons);
  if (defaultNode) selectNode(defaultNode);
  else list.replaceChildren();
  newTaskProjectModal.showModal();
  tabButtons.find((tab) => tab.getAttribute('aria-selected') === 'true')?.focus();
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
    if (card.serverMatch === true) return true;
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
    button.style.setProperty('--accent', state.activeZoneColor || defaultAccent);
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

const mobileCarouselInstances = new WeakMap();

function destroyMobileCarousels(root) {
  for (const shell of root.querySelectorAll('.ledger-card-media-carousel')) {
    const instance = mobileCarouselInstances.get(shell);
    if (instance?.titleTimer) clearTimeout(instance.titleTimer);
    instance?.api.destroy();
    mobileCarouselInstances.delete(shell);
  }
}

function initializeMobileCarousels(root) {
  for (const shell of root.querySelectorAll('.ledger-card-media-carousel[data-carousel-driver="external"]')) {
    const track = shell.querySelector('.ledger-card-media-track');
    const slides = Array.from(track?.children ?? []);
    if (!track || slides.length < 2 || typeof globalThis.EmblaCarousel !== 'function') continue;
    const startIndex = Math.max(0, Math.min(slides.length - 1, Number(shell.dataset.carouselStartIndex) || 0));
    const api = globalThis.EmblaCarousel(shell, {
      align: 'center',
      container: track,
      slides,
      containScroll: 'trimSnaps',
      dragFree: false,
      slidesToScroll: 1,
      skipSnaps: false,
      duration: 25,
      loop: false,
      startIndex
    });
    const replaceControl = (selector, action) => {
      const current = shell.querySelector(selector);
      if (!current) return null;
      const control = current.cloneNode(true);
      current.replaceWith(control);
      control.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        action();
      });
      return control;
    };
    replaceControl('.ledger-card-media-nav .ledger-card-media-button:first-child', () => api.scrollPrev());
    replaceControl('.ledger-card-media-nav .ledger-card-media-button:nth-child(2)', () => api.scrollNext());
    const selectors = Array.from(shell.querySelectorAll('.ledger-card-media-slide-button'));
    selectors.forEach((button, index) => {
      const replacement = button.cloneNode(true);
      button.replaceWith(replacement);
      selectors[index] = replacement;
      replacement.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        api.scrollTo(index);
      });
    });
    const instance = { api, titleTimer: null };
    mobileCarouselInstances.set(shell, instance);
    const sync = () => {
      const selected = api.selectedScrollSnap();
      selectors.forEach((button, index) => {
        const active = index === selected;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', active ? 'true' : 'false');
      });
      if (shell.dataset.carouselStateId) saveLedgerCardMediaCarouselSlide(shell.dataset.carouselStateId, selected, slides.length);
    };
    const hideTitles = () => {
      if (instance.titleTimer) clearTimeout(instance.titleTimer);
      for (const title of shell.querySelectorAll('.ledger-card-media-title')) title.classList.remove('is-visible');
      instance.titleTimer = null;
    };
    const revealTitle = () => {
      hideTitles();
      const title = slides[api.selectedScrollSnap()]?.querySelector('.ledger-card-media-title');
      if (!title) return;
      title.classList.add('is-visible');
      instance.titleTimer = setTimeout(() => {
        title.classList.remove('is-visible');
        instance.titleTimer = null;
      }, 1000);
    };
    api.on('pointerDown', hideTitles).on('select', () => {
      sync();
      hideTitles();
    }).on('settle', revealTitle).on('reInit', () => {
      sync();
      revealTitle();
    });
    sync();
    revealTitle();
  }
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
    executionStatus: card.executionStatus,
    labels: card.labels ?? [],
    cards: state.ledger?.cards ?? [],
    relationships: state.ledger?.relationships ?? []
  });
  const backButton = document.querySelector('.back-to-zone-button');
  backButton.textContent = '← Back';
  backButton.dataset.destination = parsedTask.masterTask ? 'control-room' : 'zone';
  destroyMobileCarousels(elements['card-body']);
  const persistCardImageResize = async (source, dimensions) => {
    const previousImageSizes = card.imageSizes && typeof card.imageSizes === 'object' ? { ...card.imageSizes } : {};
    card.imageSizes = { ...previousImageSizes, [source]: dimensions };
    try {
      state.ledger = await ledgerMutation(state.activeLedgerId, {
        action: 'patch-card',
        cardPatch: { id: card.id, imageSizes: card.imageSizes }
      });
    } catch (cause) {
      card.imageSizes = previousImageSizes;
      if (state.activeCardId === String(card.id)) renderCard(card);
      elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Carousel resize failed.';
    }
  };
  const content = renderLedgerCardMarkdown(parsedTask.masterTask ? visibleMasterTaskMarkdown(markdown) : markdown, {
    cardId: parsedTask.masterTask ? String(card.id) : undefined,
    imageSizes,
    mediaSurface: parsedTask.masterTask ? 'detail' : 'thread',
    carouselDriver: 'external',
    onImageResize: parsedTask.masterTask ? persistCardImageResize : undefined
  });
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
    const backlog = card.status === 'backlog';
    const delayButton = document.createElement('button');
    delayButton.type = 'button';
    delayButton.className = 'delay-master-task-button';
    delayButton.textContent = backlog ? 'Restore to queue' : 'Move to backlog';
    delayButton.disabled = card.status === 'done';
    delayButton.addEventListener('click', async () => {
      const nextStatus = backlog ? 'todo' : 'backlog';
      delayButton.disabled = true;
      delayButton.textContent = backlog ? 'Restoring task…' : 'Moving to backlog…';
      try {
        state.ledger = await ledgerMutation(state.activeLedgerId, { action: 'patch-card', cardPatch: { id: card.id, status: nextStatus } });
        navigate(controlRoomPath(nextStatus === 'backlog' ? 'backlog' : 'queue'), true);
      } catch (cause) {
        delayButton.disabled = false;
        delayButton.textContent = backlog ? 'Restore to queue' : 'Move to backlog';
        elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Master task status update failed.';
        setView('error-view');
      }
    });
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
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-master-task-button';
    deleteButton.textContent = 'Delete master task';
    deleteButton.addEventListener('click', () => {
      deleteMasterTaskModal.dataset.cardId = String(card.id);
      deleteMasterTaskModal.showModal();
    });
    completion.append(delayButton, completeButton, deleteButton);
    overview.append(status, heading, subtasks, completion);
    // The relationship-backed task summary is the navigation surface for a master task.
    // Keep it ahead of the narrative so linked cards remain visible on long mobile cards.
    elements['card-body'].replaceChildren(overview, content);
  } else elements['card-body'].replaceChildren(content);
  initializeMobileCarousels(elements['card-body']);
  elements['card-view'].style.setProperty('--zone-color', state.activeZoneColor || 'var(--accent)');
  elements['card-view'].style.setProperty('--accent', state.activeZoneColor || defaultAccent);
  openCardDetail(card);
  document.title = `${elements['card-title'].textContent} · ${state.projectName}`;
}

document.querySelector('.cancel-delete-master-task-button').addEventListener('click', () => deleteMasterTaskModal.close());
document.querySelector('.confirm-delete-master-task-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const cardId = deleteMasterTaskModal.dataset.cardId;
  if (!cardId) return;
  button.disabled = true;
  button.textContent = 'Deleting task…';
  try {
    state.ledger = await ledgerMutation(state.activeLedgerId, { action: 'delete-card', cardId });
    deleteMasterTaskModal.close();
    navigate(controlRoomPath(state.controlTab), true);
  } catch (cause) {
    deleteMasterTaskModal.close();
    elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Master task deletion failed.';
    setView('error-view');
  } finally {
    button.disabled = false;
    button.textContent = 'Delete master task';
  }
});

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
  const response = await projectFetch(`/api/ledgers/${encodeURIComponent(ledgerId)}/navigation`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
  const ledger = await response.json();
  if (!ledger || !Array.isArray(ledger.cards)) throw new Error('The ledger response does not contain a card list.');
  state.ledger = ledger;
  state.activeLedgerId = ledgerId;
  renderLedgerLinks();
  syncMobileThreadContext({
    projectId: state.resourceProjectId,
    ledgerId,
    ledger,
    ledgers: state.ledgers,
    onCodexStarted: activateMasterTask,
    onQuickVoiceSubmitted: navigateVoiceSubmission,
    onLedgerRefresh: async (activeLedgerId) => {
      const refreshed = await projectFetch(`/api/ledgers/${encodeURIComponent(activeLedgerId)}/navigation`, { cache: 'no-store' }).then((result) => result.ok ? result.json() : null);
      if (refreshed && activeLedgerId === state.activeLedgerId) state.ledger = refreshed;
      return refreshed;
    }
  });
}

async function loadRoute() {
  setView('loading-view');
  try {
    const catalogResponse = await fetch('/decision-os/projects', { cache: 'no-store' });
    if (!catalogResponse.ok) throw new Error(`The project catalog returned HTTP ${catalogResponse.status}.`);
    const catalog = await catalogResponse.json();
    state.projects = Array.isArray(catalog.projects) ? catalog.projects : [];
    document.documentElement.style.setProperty('--accent', defaultAccent);
    document.documentElement.style.setProperty('--accent-strong', defaultAccent);
    setMobileCodexContext({ projects: state.projects });
    const projectRoute = parseProjectRoute(location.pathname);
    if (projectRoute?.view === 'index') {
      renderProjects();
      return;
    }
    if (projectRoute?.view === 'detail') {
      const viewedProject = state.projects.find((project) => project.id === projectRoute.projectId);
      if (!viewedProject) throw new Error('Project not found.');
      renderProjectDetail(viewedProject);
      return;
    }
    if (projectRoute?.view === 'invalid') throw new Error('Project route not found.');
    if (!state.projects.length) {
      state.ledgers = [];
      renderLedgerLinks();
      setView('empty-view');
      return;
    }
    if (location.pathname === '/') {
      state.resourceProjectId = '';
      setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
      state.projectName = 'Decision OS';
      elements['project-name'].textContent = 'Decision OS';
      const route = parseControlRoomRoute(location.href);
      state.controlTab = route.tab;
      const canonicalPath = controlRoomPath(route.tab, route.anchor);
      if (`${location.pathname}${location.search}${location.hash}` !== canonicalPath) history.replaceState({}, '', canonicalPath);
      await loadControlRoom();
      renderControlRoom();
      subscribeControlRoomEvents();
      return;
    }
    if (location.pathname === '/ledgers') {
      renderGlobalLedgers();
      return;
    }
    if (location.pathname === '/settings') {
      renderSettings();
      return;
    }
    if (location.pathname === '/pipelines' || location.pathname === '/skills') {
      state.resourceProjectId = '';
      setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
      renderLedgerLinks();
      setView('empty-view');
      openMobileCodexLibrary(location.pathname.slice(1));
      return;
    }
    const scope = parseProjectScope(location.pathname);
    if (!scope || scope.segments[0] !== 'ledgers') throw new Error('Route not found.');
    const routeProject = state.projects.find((project) => project.id === scope.projectId);
    if (!routeProject) throw new Error('Project not found.');
    if (state.resourceProjectId !== routeProject.id) setResourceProject(routeProject.id);
    const response = await projectFetch('/decision-os/state', { cache: 'no-store' });
    if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
    const project = await response.json();
    state.projectName = state.projects.find((entry) => entry.id === state.resourceProjectId)?.name || project.projectName || state.projectName;
    state.ledgers = Array.isArray(project.ledgers) ? project.ledgers.filter((ledger) => ledger?.id && ledger?.title) : [];
    elements['project-name'].textContent = state.projectName;
    if (!state.ledgers.length) {
      renderLedgerLinks();
      setView('empty-view');
      return;
    }

    const [section, requestedLedger, zoneMarker, requestedZone, cardMarker, requestedCard] = routeParts();
    if (section === 'ledgers' && !requestedLedger) {
      state.activeLedgerId = '';
      renderLedgerLinks();
      renderOverview();
      return;
    }
    const ledgerId = section === 'ledgers' && state.ledgers.some((ledger) => ledger.id === requestedLedger) ? requestedLedger : '';
    if (!ledgerId) {
      navigate('/ledgers', true);
      return;
    }
    if (state.activeLedgerId !== ledgerId || !state.ledger) await loadLedger(ledgerId);
    const zones = ledgerZones();
    const zone = zoneMarker === 'zones' ? zones.find((entry) => String(entry.id) === requestedZone) : null;
    if (zone && cardMarker === 'cards' && requestedCard) {
      const detailResponse = await projectFetch(`/api/ledgers/${encodeURIComponent(ledgerId)}/cards/${encodeURIComponent(requestedCard)}`, { cache: 'no-store' });
      const card = detailResponse.ok ? await detailResponse.json() : null;
      if (card) {
        state.ledger.cards = state.ledger.cards.map((entry) => String(entry.id) === requestedCard ? card : entry);
        state.activeZoneId = asText(zone.id);
        state.activeZoneColor = asText(zone.color);
        syncMobileThreadContext({
          projectId: state.resourceProjectId,
          ledgerId,
          ledger: state.ledger,
          ledgers: state.ledgers,
          onCodexStarted: activateMasterTask,
          onQuickVoiceSubmitted: navigateVoiceSubmission
        });
        renderCard(card);
      }
      else navigate(zonePath(ledgerId, zone.id), true);
    } else if (zone) {
      renderZone(zone);
    } else {
      state.activeCardId = '';
      setMobileCodexContext({ projectId: state.resourceProjectId, ledgerId: state.activeLedgerId, cardId: '' });
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
document.querySelector('.back-to-projects-button').addEventListener('click', () => navigate(projectPath()));
document.querySelector('.open-project-button').addEventListener('click', () => {
  navigate(ledgerPathForProject(state.viewedProjectId));
});
document.querySelector('.project-settings-button').addEventListener('click', openProjectSettings);
document.querySelector('.project-settings-sync').addEventListener('click', () => void startSelectedProjectSync());
document.querySelector('.project-settings-color-trigger').addEventListener('click', openProjectColorPicker);
document.querySelector('.project-color-picker-cancel').addEventListener('click', closeProjectColorPicker);
document.querySelector('.project-color-picker-set').addEventListener('click', () => {
  const color = committedProjectColor(projectColorPickerOriginal, projectColorPickerHsv(), projectColorPickerDirty);
  projectSettingsColorInput.value = color;
  renderProjectSettingsColorField(color);
  closeProjectColorPicker();
});
projectColorPickerModal.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeProjectColorPicker();
});
document.querySelector('.project-settings-cancel').addEventListener('click', () => {
  if (!projectSettingsModal.dataset.busy) projectSettingsModal.close();
});
projectSettingsModal.addEventListener('cancel', (event) => {
  if (document.querySelector('.project-settings-save').disabled) event.preventDefault();
});
projectSettingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitProjectSettings();
});
document.querySelector('.codex-settings-increase').addEventListener('click', () => renderCodexProcessLimit(stepCodexProcessLimit(elements['codex-settings-limit'].value, 1)));
document.querySelector('.codex-settings-decrease').addEventListener('click', () => renderCodexProcessLimit(stepCodexProcessLimit(elements['codex-settings-limit'].value, -1)));
document.querySelector('.codex-process-settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void submitCodexProcessSettings();
});
document.querySelector('.federation-settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void submitFederationSettings(true);
});
document.querySelector('.federation-settings-form').addEventListener('input', () => {
  federationFormDirty = true;
});
document.querySelector('.federation-settings-disconnect').addEventListener('click', () => void submitFederationSettings(false));
document.querySelector('.back-to-ledger-button').addEventListener('click', () => navigate(ledgerPath(state.activeLedgerId)));
document.querySelector('.back-to-zone-button').addEventListener('click', (event) => {
  const controlRoomDestination = event.currentTarget.dataset.destination === 'control-room';
  const destination = controlRoomDestination ? controlRoomPath(state.controlTab) : zonePath(state.activeLedgerId, state.activeZoneId);
  if (controlRoomDestination) {
    void navigateTaskBack(destination);
    return;
  }
  navigate(destination);
});
document.querySelector('.create-ledger-button').addEventListener('click', () => openCreationModal('ledger'));
document.querySelector('.create-project-button').addEventListener('click', () => openCreationModal('project'));
document.querySelector('.create-zone-button').addEventListener('click', () => openCreationModal('zone'));
document.querySelector('.create-card-button').addEventListener('click', () => openCreationModal('card'));
document.querySelectorAll('.new-task-button').forEach((button) => button.addEventListener('click', openNewTaskProjectModal));
document.querySelector('.new-task-project-cancel').addEventListener('click', () => {
  if (!newTaskProjectModal.dataset.busy) newTaskProjectModal.close();
});
newTaskProjectModal.addEventListener('cancel', (event) => {
  if (newTaskProjectModal.dataset.busy) event.preventDefault();
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
  clearTimeout(cardSearchTimer);
  if (!state.query.trim()) {
    const zone = ledgerZones().find((entry) => String(entry.id) === state.activeZoneId);
    renderCards(zone?.cards ?? []);
    return;
  }
  cardSearchTimer = window.setTimeout(async () => {
    const query = new URLSearchParams({ zoneId: state.activeZoneId, q: state.query });
    const response = await projectFetch(`/api/ledgers/${encodeURIComponent(state.activeLedgerId)}/search?${query}`, { cache: 'no-store' });
    if (!response.ok) return;
    const result = await response.json();
    renderCards(Array.isArray(result.matches) ? result.matches : []);
  }, 120);
});
window.addEventListener('popstate', () => {
  if (closeCardDetail()) void loadRoute();
});
window.addEventListener('decision-os:codex-run-enqueued', () => { void loadRoute(); });
window.addEventListener('scroll', persistControlRoomScrollAnchor, { passive: true });
window.addEventListener('keydown', async (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (isCardEditingKeyboardTarget(target)) return;
  const desktopControlRoom = location.pathname === '/'
    && !elements['control-room-view'].hidden
    && window.matchMedia('(min-width: 760px)').matches
    && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (desktopControlRoom && !event.repeat && !event.shiftKey) {
    const key = event.key.toLowerCase();
    if (key === 'c' && controlRoomNodes().length > 1) {
      event.preventDefault();
      cycleControlRoomNode();
      return;
    }
    if (/^[1-9]$/.test(key)) {
      const project = controlRoomNodes()[state.controlNodeIndex]?.projects[Number(key) - 1];
      if (project && project.online !== false) {
        event.preventDefault();
        selectControlProject(project.id);
        return;
      }
    }
    const shortcutControl = key === 'x' ? document.querySelector('.desktop-new-task-button') : null;
    if (shortcutControl && !shortcutControl.disabled) {
      event.preventDefault();
      shortcutControl.click();
      return;
    }
  }
  if (await handleResponsiveThreadShortcut(event)) return;
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
});

window.matchMedia('(min-width: 760px)').addEventListener('change', () => {
  if (location.pathname === '/' && !elements['control-room-view'].hidden) renderControlRoom();
});

initializeMobileThread();
initializeMobileCodex();
subscribeProjectSyncEvents();
void refreshProjectSyncRuns();
window.setInterval(() => {
  document.querySelectorAll('.task-stopwatch[data-execution-since]').forEach((stopwatch) => {
    stopwatch.textContent = executionStopwatch(stopwatch.dataset.executionSince);
  });
}, 1000);
void loadRoute();
