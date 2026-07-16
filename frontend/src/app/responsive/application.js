/**
 * WHAT: Runs the complete responsive Decision OS application outside desktop canvas routes.
 * WHY: The former mobile feature set is the single application contract for every viewport.
 */
import { renderLedgerCardMarkdown } from '/src/runtime/ledger/component/render-ledger-card-markdown.js';
import { ledgerCardBody } from '/src/runtime/ledger/helper/ledger-card-body.js';
import { saveLedgerCardMediaCarouselSlide } from '/src/runtime/ledger/helper/persist-ledger-card-media-carousel.js';
import { initializeMobileThread, openMobileThread, setMobileThreadCard, syncMobileThreadContext } from './thread.js';
import { initializeMobileCodex, openMobileCodexLibrary, setMobileCodexContext } from './codex.js';
import { activeAge, activeStopwatch, parseMasterTaskMarkdown, visibleMasterTaskMarkdown, waitingAge } from './control-room.js';
import { controlRoomPath, parseControlRoomRoute } from './control-room-route.js';
import { cardPathForProject, isProjectCardPath, ledgerPathForProject, parseProjectRoute, parseProjectScope, projectPath, zonePathForProject } from './project-route.js';
import { projectSettingsValues, saveProjectSettingsRequest } from './project-settings.js';
import { committedProjectColor, hexToHsv, hsvToHex, projectColorPickerGradients } from './project-color-picker.js';
import { codexProcessLimitRange, loadCodexProcessSettings, saveCodexProcessSettings, stepCodexProcessLimit } from './codex-settings.js';
import { createProjectRequest } from './project-creation.js';
import { installProjectRequestScope, projectScopedRequestPath } from '/src/runtime/project/helper/project-request-scope.js';

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
  controlFilter: 'All'
};

const elements = Object.fromEntries([
  'project-name', 'ledger-links', 'loading-view', 'error-view', 'error-message', 'empty-view',
  'projects-view', 'projects-summary', 'project-list', 'project-detail-view', 'project-detail-name', 'project-detail-description', 'settings-view',
  'project-detail-color', 'project-detail-status', 'project-detail-path',
  'overview-view', 'overview-summary', 'overview-ledgers', 'ledger-view', 'ledger-title', 'ledger-summary',
  'zone-list', 'zone-view', 'zone-title', 'zone-summary', 'card-search', 'card-list',
  'no-results', 'card-view', 'card-title', 'card-body', 'control-room-view', 'control-project-filters', 'control-filters',
  'control-task-list', 'control-empty', 'control-diagnostics', 'codex-settings-limit', 'codex-settings-message'
].map((id) => [id, document.getElementById(id)]));

const asText = (value) => value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const defaultAccent = '#38d9e8';
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
let queueSortable = null;
let controlRoomEventSource = null;
let controlRoomRefreshTimer = 0;
let controlRoomEtag = '';
let cardSearchTimer = 0;
let projectColorPickerOriginal = '';
let projectColorPickerDirty = false;

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
  for (const id of ['loading-view', 'error-view', 'empty-view', 'projects-view', 'project-detail-view', 'settings-view', 'overview-view', 'control-room-view', 'ledger-view', 'zone-view', 'card-view']) {
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
  return ledgerPathForProject(state.resourceProjectId, ledgerId);
}

function zonePath(ledgerId, zoneId) {
  return zonePathForProject(state.resourceProjectId, ledgerId, zoneId);
}

function cardPath(ledgerId, zoneId, cardId) {
  return cardPathForProject(state.resourceProjectId, ledgerId, zoneId, cardId);
}

function pathForTask(task) {
  return cardPathForProject(task.projectId, task.ledgerId, task.zoneId || 'ungrouped', task.cardId);
}

function navigate(path, replace = false) {
  const destination = new URL(path, location.origin);
  const projectScope = parseProjectScope(destination.pathname);
  const desktopCanvasRoute = window.matchMedia?.('(min-width: 761px)').matches === true
    && (destination.pathname === '/projects'
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
  void loadRoute();
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
  state.resourceProjectId = '';
  setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
  renderLedgerLinks();
  renderCodexProcessLimit(elements['codex-settings-limit'].value);
  setView('settings-view');
  void loadCodexSettings();
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
    badge.hidden = !project.remote;
    badge.textContent = project.online ? (project.ownerNodeLabel || project.ownerNodeId) : 'Owner offline';
    button.querySelector('.project-card-description').textContent = project.description || 'No description provided.';
    button.querySelector('code').textContent = project.remote ? `Owned by ${project.ownerNodeLabel || project.ownerNodeId}` : project.relativePath;
    button.setAttribute('aria-label', project.name);
    button.disabled = project.remote && !project.online;
    if (!button.disabled) button.addEventListener('click', () => navigate(projectPath(project.id)));
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
    ? 'Owner offline'
    : `${project.ledgers.length} ${project.ledgers.length === 1 ? 'ledger' : 'ledgers'}`;
  elements['project-detail-path'].textContent = project.remote ? `Owned by ${project.ownerNodeLabel || project.ownerNodeId}` : project.relativePath;
  document.querySelector('.project-settings-button').hidden = Boolean(project.remote);
  setView('project-detail-view');
  document.title = `${project.name} · Projects`;
}

function openProjectSettings() {
  const project = state.projects.find((entry) => entry.id === state.viewedProjectId);
  if (!project) return;
  const values = projectSettingsValues(project);
  document.querySelector('#project-settings-name').value = values.name;
  document.querySelector('#project-settings-description').value = values.description;
  projectSettingsColorInput.value = values.color;
  renderProjectSettingsColorField(values.color);
  document.querySelector('.project-settings-error').hidden = true;
  projectSettingsModal.showModal();
  document.querySelector('#project-settings-name').focus();
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

function filteredControlTasks() {
  const tasks = state.controlRoom?.[state.controlTab] ?? [];
  const projectTasks = state.projectFilter === 'All' ? tasks : tasks.filter((task) => task.projectId === state.projectFilter);
  return state.controlFilter === 'All' ? projectTasks : projectTasks.filter((task) => task.ledgerId === state.controlFilter);
}

function taskIdentity(task) {
  return [task.projectId, task.ledgerId, task.cardId].map((part) => encodeURIComponent(String(part))).join('--');
}

function syncQueueFromDom() {
  const orderedIds = [...elements['control-task-list'].querySelectorAll('.control-task')].map((row) => row.dataset.taskId);
  const visible = filteredControlTasks();
  const byId = new Map(visible.map((task) => [taskIdentity(task), task]));
  const reordered = orderedIds.map((taskId) => byId.get(taskId)).filter(Boolean);
  const visibleIds = new Set(visible.map(taskIdentity));
  let replacementIndex = 0;
  state.controlRoom.queue = state.controlRoom.queue.map((task) => visibleIds.has(taskIdentity(task)) ? reordered[replacementIndex++] : task);
}

function initializeQueueSortable() {
  queueSortable?.destroy();
  queueSortable = null;
  if (state.controlTab !== 'queue' || filteredControlTasks().length < 2 || typeof globalThis.Sortable !== 'function') return;
  queueSortable = globalThis.Sortable.create(elements['control-task-list'], {
    animation: 180,
    draggable: '.control-task',
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
    onEnd(event) {
      if (event.oldIndex === event.newIndex) return;
      syncQueueFromDom();
      queueMicrotask(() => void persistQueueOrder());
    }
  });
}

function controlTaskCount(tab) {
  const tasks = state.controlRoom?.[tab] ?? [];
  const projectTasks = state.projectFilter === 'All' ? tasks : tasks.filter((task) => task.projectId === state.projectFilter);
  return state.controlFilter === 'All' ? projectTasks.length : projectTasks.filter((task) => task.ledgerId === state.controlFilter).length;
}

function taskRow(task, index) {
  const article = document.createElement('article');
  article.className = `control-task${index === 0 && state.controlTab === 'queue' ? ' next-task' : ''}`;
  article.id = `task-${taskIdentity(task)}`;
  article.dataset.taskId = taskIdentity(task);
  article.draggable = false;
  const summary = document.createElement('button');
  summary.type = 'button';
  summary.className = 'control-task-summary';
  article.style.borderInlineStartColor = task.projectColor || 'transparent';
  article.style.setProperty('--accent', task.projectColor || defaultAccent);
  const active = state.controlTab === 'active';
  const queue = state.controlTab === 'queue';
  const directNavigation = active || queue;
  if (!directNavigation) summary.setAttribute('aria-expanded', 'false');
  summary.innerHTML = active
    ? `<span class="task-copy"><strong></strong></span><span class="task-runtime-status"></span>`
    : `<span class="task-copy"><strong></strong><span class="task-meta"></span>${task.nextSubtask ? '<span class="task-next"></span>' : ''}</span>${queue ? '' : '<span class="task-chevron">⌄</span>'}`;
  summary.querySelector('strong').textContent = task.title;
  if (active) {
    const runtimeStatus = summary.querySelector('.task-runtime-status');
    if (task.codexQueued) {
      runtimeStatus.className = 'task-queue-position';
      runtimeStatus.textContent = `Queued · position ${task.codexQueuePosition}`;
    } else if (task.activeSince) {
      runtimeStatus.className = 'task-stopwatch';
      runtimeStatus.dataset.activeSince = task.activeSince;
      runtimeStatus.textContent = activeStopwatch(task.activeSince);
    } else {
      runtimeStatus.textContent = 'Running';
    }
  }
  const age = task.status === 'task-backlog' ? 'backlog' : task.status === 'task-active' ? activeAge(task.activeSince) : waitingAge(task.waitingSince);
  const process = task.codexProcessing ? ` · Codex ${task.codexRunId}` : '';
  if (!active) {
    summary.querySelector('.task-meta').textContent = `${task.projectName} · ${task.ledger} · ${age}${process}`;
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
      const target = state.controlRoom.allTasks.find((candidate) => candidate.projectId === task.projectId && candidate.cardId === subtask.cardId && candidate.ledgerId === task.ledgerId);
      if (target) navigate(pathForTask(target));
      else navigate(cardPathForProject(task.projectId, task.ledgerId, subtask.zoneId || 'ungrouped', subtask.cardId));
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
  details.append(...subtasks, actions);
  summary.addEventListener('click', () => {
    details.hidden = !details.hidden;
    summary.setAttribute('aria-expanded', String(!details.hidden));
  });
  article.append(summary, details);
  return article;
}

function renderControlRoom() {
  queueSortable?.destroy();
  queueSortable = null;
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  const projectFilters = [{ id: 'All', name: 'All projects', color: '#20242b' }, ...state.projects];
  if (!projectFilters.some((project) => project.id === state.projectFilter)) state.projectFilter = 'All';
  const showProjectFilters = state.projectFilter === 'All';
  const projectButtons = projectFilters.map((project) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `project-filter-chip${project.id === 'All' ? ' all-projects-filter' : ''}`;
    button.textContent = project.name;
    button.setAttribute('aria-pressed', String(project.id === state.projectFilter));
    button.style.setProperty('--project-color', project.color);
    button.addEventListener('click', () => { state.projectFilter = project.id; state.controlFilter = 'All'; renderControlRoom(); });
    return button;
  });
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
  const tasks = filteredControlTasks();
  elements['control-task-list'].replaceChildren(...tasks.map(taskRow));
  initializeQueueSortable();
  elements['control-empty'].hidden = tasks.length > 0;
  elements['control-empty'].textContent = {
    queue: 'No waiting tasks',
    active: 'No active tasks',
    backlog: 'No backlog tasks'
  }[state.controlTab] ?? 'No tasks';
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

async function loadControlRoom() {
  const response = await fetch('/api/control-room', { cache: 'no-store', headers: controlRoomEtag ? { 'if-none-match': controlRoomEtag } : {} });
  if (response.status === 304 && state.controlRoom) return false;
  if (!response.ok) throw new Error(`Could not load the Control Room (${response.status}).`);
  state.controlRoom = await response.json();
  controlRoomEtag = response.headers.get('etag') ?? '';
  return true;
}

function subscribeControlRoomEvents() {
  if (controlRoomEventSource || typeof EventSource === 'undefined') return;
  controlRoomEventSource = new EventSource('/api/control-room-events');
  const refresh = () => {
    clearTimeout(controlRoomRefreshTimer);
    controlRoomRefreshTimer = window.setTimeout(async () => {
      if (location.pathname !== '/') return;
      try {
        if (await loadControlRoom()) renderControlRoom();
      } catch (cause) {
        elements['control-diagnostics'].hidden = false;
        elements['control-diagnostics'].textContent = cause instanceof Error ? cause.message : 'Control Room refresh failed.';
      }
    }, 80);
  };
  controlRoomEventSource.addEventListener('ledger-content-change', refresh);
  controlRoomEventSource.addEventListener('card-content-change', refresh);
}

async function persistQueueOrder() {
  const sequence = ++queuePersistenceSequence;
  const reordered = filteredControlTasks();
  const mutations = reordered.map((task, index) => {
    task.queueRank = index + 1;
    const source = state.controlRoom.allTasks.find((candidate) => candidate.projectId === task.projectId && candidate.cardId === task.cardId && candidate.ledgerId === task.ledgerId);
    if (source) source.queueRank = index + 1;
    return { task, queueRank: index + 1 };
  });
  renderControlRoom();
  try {
    await Promise.all(mutations.map(({ task, queueRank }) => ledgerMutation(task.ledgerId, {
      action: 'patch-card',
      cardPatch: { id: task.cardId, queueRank }
    }, task.projectId)));
  } catch (error) {
    if (sequence !== queuePersistenceSequence) return;
    await loadControlRoom();
    renderControlRoom();
    elements['error-message'].textContent = error instanceof Error ? error.message : 'Queue order persistence failed.';
    setView('error-view');
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
    onQuickVoiceSubmitted: () => navigate(controlRoomPath('queue'), true)
  });
  navigate(cardPath(ledgerRef.id, zone.id, cardId));
  openMobileThread(card, zone.color);
}

function openNewTaskProjectModal() {
  const list = document.querySelector('.new-task-project-list');
  const error = document.querySelector('.new-task-project-error');
  const cancel = document.querySelector('.new-task-project-cancel');
  delete newTaskProjectModal.dataset.busy;
  cancel.disabled = false;
  error.hidden = true;
  error.textContent = '';
  list.replaceChildren(...state.projects.map((project) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'new-task-project-option';
    button.style.setProperty('--project-color', project.color);
    const name = document.createElement('strong');
    name.textContent = project.name;
    button.append(name);
    button.addEventListener('click', async () => {
      const options = [...list.querySelectorAll('button')];
      options.forEach((option) => { option.disabled = true; });
      newTaskProjectModal.dataset.busy = 'true';
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
        options.forEach((option) => { option.disabled = false; });
        delete newTaskProjectModal.dataset.busy;
        cancel.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
    return button;
  }));
  newTaskProjectModal.showModal();
  list.querySelector('button')?.focus();
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
    labels: card.labels ?? [],
    cards: state.ledger?.cards ?? [],
    relationships: state.ledger?.relationships ?? []
  });
  const backButton = document.querySelector('.back-to-zone-button');
  backButton.textContent = '← Back';
  backButton.dataset.destination = parsedTask.masterTask ? 'control-room' : 'zone';
  destroyMobileCarousels(elements['card-body']);
  const content = renderLedgerCardMarkdown(parsedTask.masterTask ? visibleMasterTaskMarkdown(markdown) : markdown, { imageSizes, mediaSurface: 'thread', carouselDriver: 'external' });
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
  setMobileThreadCard(card);
  setMobileCodexContext({ projectId: state.resourceProjectId, ledgerId: state.activeLedgerId, cardId: state.activeCardId });
  setView('card-view');
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
    onQuickVoiceSubmitted: () => navigate(controlRoomPath('queue'), true),
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
          onQuickVoiceSubmitted: () => navigate(controlRoomPath('queue'), true)
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
document.querySelector('.back-to-ledger-button').addEventListener('click', () => navigate(ledgerPath(state.activeLedgerId)));
document.querySelector('.back-to-zone-button').addEventListener('click', (event) => {
  navigate(event.currentTarget.dataset.destination === 'control-room' ? controlRoomPath(state.controlTab) : zonePath(state.activeLedgerId, state.activeZoneId));
});
document.querySelector('.create-ledger-button').addEventListener('click', () => openCreationModal('ledger'));
document.querySelector('.create-project-button').addEventListener('click', () => openCreationModal('project'));
document.querySelector('.create-zone-button').addEventListener('click', () => openCreationModal('zone'));
document.querySelector('.create-card-button').addEventListener('click', () => openCreationModal('card'));
document.querySelector('.new-task-button').addEventListener('click', openNewTaskProjectModal);
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
window.addEventListener('popstate', () => loadRoute());
window.addEventListener('decision-os:codex-run-enqueued', () => { void loadRoute(); });
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
