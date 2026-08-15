/**
 * WHAT: Runs the complete responsive Decision OS application outside desktop canvas routes.
 * WHY: The former mobile feature set is the single application contract for every viewport.
 */
import { renderLedgerCardMarkdown } from '/src/runtime/ledger/component/render-ledger-card-markdown.js';
import { renderLedgerCardFacts } from '/src/runtime/ledger/component/render-ledger-card-facts.js';
import { ledgerCardBody, ledgerCardHasHydratedBody } from '/src/runtime/ledger/helper/ledger-card-body.js';
import { saveLedgerCardMediaCarouselSlide } from '/src/runtime/ledger/helper/persist-ledger-card-media-carousel.js';
import { requestCodexPipelineRun } from '/src/runtime/codex/effect/request-codex-pipeline-run.js';
import { closeMobileThread, handleResponsiveThreadShortcut, initializeMobileThread, openMobileThread, setMobileThreadCard, syncMobileThreadContext } from './thread.js';
import { upsertResponsiveRouteCard } from './upsert-responsive-route-card.js';
import { initializeMobileCodex, openMobileCodexLibrary, openMobileSkillRoute, setMobileCodexContext } from './codex.js';
import { closeCodexRouteScreens } from './codex-view.js';
import { compareControlRoomQueueTasks, executionPresentation, parentMasterTask, projectMasterTask, visibleMasterTaskSubtasks, waitingAge } from './control-room.js';
import { controlRoomPath, parseControlRoomRoute } from './control-room-route.js';
import { cardPathForProject, isProjectCardPath, ledgerPathForProject, parseProjectRoute, parseProjectScope, projectPath, zonePathForProject } from './project-route.js';
import { projectSettingsValues, projectSyncRequestInput, saveProjectSettingsRequest, startProjectSyncRequest } from './project-settings.js';
import { isCardEditingKeyboardTarget } from '/src/runtime/input/helper/is-card-editing-keyboard-target.js';
import { committedProjectColor, hexToHsv, hsvToHex, projectColorPickerGradients } from './project-color-picker.js';
import { taskFamilyCardAccent, taskFamilyCardIds } from '/src/runtime/ledger/helper/task-family-accent.js';
import { codexProcessLimitRange, loadCodexProcessSettings, saveCodexProcessSettings, stepCodexProcessLimit } from './codex-settings.js';
import { loadFederationSettings, saveFederationSettings } from './federation-settings.js';
import { hydrateFederationForm } from './federation-form-hydration.js';
import { createProjectRequest, loadProjectDirectoryRequest } from './project-creation.js';
import { installProjectRequestScope, projectScopedRequestPath } from '/src/runtime/project/helper/project-request-scope.js';
import { projectFilterChipPresentation, projectFilterGroups, projectFilterIncludes } from './project-filter-chip.js';
import { acceptedRunOwnsRoute, captureRouteSnapshot, cardPresentationIdentity, contentEventOwnsCard, federationEventOwnsCard, sameRouteSnapshot } from './navigation-ownership.js';
import { completedTaskLabels, filterCompletedTasks } from './completed-tasks.js';
import { createOptimisticLedgerTransactionCoordinator } from '/src/runtime/ledger/helper/optimistic-ledger-transaction.js';
import { applyTaskIntentToProjection, taskIdentity, taskIntentConfirmed } from './optimistic-task-projection.js';
import {
  applyOptimisticExecutionIntent,
  controlRoomTaskForExecution,
  createOptimisticExecutionIntent,
  materializePendingExecutionIntents,
  optimisticExecutionConfirmed,
  removeAcknowledgedExecutionIntent,
  removeRejectedExecutionIntent,
} from './optimistic-execution-projection.js';
import { createExecutionRequestId } from '/src/runtime/codex/helper/create-execution-request-id.js';
import { requestTaskExecutionState } from '/src/runtime/codex/effect/request-task-execution-state.js';
import { applyMasterSubtaskExecutionState } from './master-subtask-execution-state.js';
import {
  reconcileMasterSubtaskDisclosureIdentity,
  toggleMasterSubtaskDisclosureIdentity,
} from './master-subtask-disclosure-state.js';
import { renderMasterSubtaskDisclosure } from './render-master-subtask-disclosure.js';
import {
  openLedgerCardEditor,
  requestActiveLedgerCardEditorClose,
} from '/src/runtime/content-authoring/controller/ledger-card-editor.js';
import {
  openSkillLibraryEditor,
  requestSkillLibraryEditorClose,
} from '/src/runtime/codex/effect/render-skill-library-editor-modal.js';
import { loadRuntimeDiagnostics, projectRuntimeRows } from './runtime-status.js';
import { taskClockFromResponse } from '/src/runtime/refresh/helper/task-causal-clock.js';
import { telemetry } from '/src/runtime/telemetry/effect/telemetry.js';

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
  doneQuery: '',
  doneProjectFilter: 'All',
  doneLabelFilter: 'All',
  doneSort: 'desc',
  masterTaskCompletionPipelineId: '',
  codexSettingsLoaded: false,
};

const elements = Object.fromEntries([
  'project-name', 'ledger-links', 'loading-view', 'error-view', 'error-message', 'empty-view',
  'projects-view', 'projects-summary', 'project-list', 'project-detail-view', 'project-detail-name', 'project-detail-description', 'settings-view',
  'runtime-status-view', 'runtime-status-summary', 'runtime-project-status-summary', 'runtime-project-list',
  'project-detail-color', 'project-detail-status', 'project-detail-path',
  'overview-view', 'overview-summary', 'overview-ledgers', 'ledger-view', 'ledger-title', 'ledger-summary',
  'zone-list', 'zone-view', 'zone-title', 'zone-summary', 'card-search', 'card-list',
  'no-results', 'card-view', 'card-title', 'card-body', 'control-room-view', 'control-project-filters', 'control-filters',
  'control-task-list', 'control-empty', 'codex-settings-limit', 'codex-settings-voice-pipeline', 'codex-settings-master-task-completion-pipeline', 'codex-settings-message',
  'done-view', 'done-summary', 'done-search', 'done-sort', 'done-project-filter-group', 'done-project-filters',
  'done-label-filter-group', 'done-label-filters', 'done-task-list', 'done-empty',
  'federation-connection-status', 'federation-state-duration', 'federation-attempt-timeout', 'federation-last-connection',
  'federation-last-issue', 'federation-peer-list', 'federation-settings-message',
  'mutation-error', 'mutation-error-message'
].map((id) => [id, document.getElementById(id)]));

const asText = (value) => value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const defaultAccent = '#38d9e8';
const projectReplicas = (project) => Array.isArray(project?.replicas) ? project.replicas : [];
const projectLocalReplica = (project) => projectReplicas(project).find((replica) => replica.local === true);
const projectOwnerLabel = (project) => projectReplicas(project).map((replica) => replica.nodeLabel || replica.nodeId).join(', ') || 'No replicas';
const projectPresenceLabel = (project) => `${projectReplicas(project).filter((replica) => replica.online !== false).length}/${projectReplicas(project).length} replicas online`;
const routeParts = () => parseProjectScope(location.pathname)?.segments ?? [];
const creationModal = document.querySelector('.creation-modal');
const deleteMasterTaskModal = document.querySelector('.delete-master-task-modal');
const deleteTaskCardTitle = deleteMasterTaskModal.querySelector('.delete-task-card-title');
const deleteTaskCardMessage = deleteMasterTaskModal.querySelector('.delete-task-card-message');
const confirmDeleteTaskCardButton = deleteMasterTaskModal.querySelector('.confirm-delete-master-task-button');
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
let projectDirectoryListings = new Map();
let expandedProjectDirectories = new Set();
let loadingProjectDirectories = new Set();
let selectedProjectDirectory = '';
let controlRoomScrollFrame = 0;
let controlRoomColumnScrollFrame = 0;
const controlRoomColumnScrollTop = { queue: 0, exec: 0, backlog: 0 };
const initializedControlRoomColumns = new Set();
let queueSortables = [];
let queueDragActive = false;
let queueDragSettling = false;
let queueDragInterrupted = false;
let queueDragOrigin = null;
let pendingControlRoomRefresh = false;
let controlRoomEventSource = null;
let controlRoomRefreshTimer = 0;
let activeCardRefreshTimer = 0;
const controlRoomExecutionRevisions = new Map();
let controlRoomEtag = '';
let controlRoomHydrating = false;
let controlRoomHydrationGeneration = 0;
let cardSearchTimer = 0;
let federationStatusRefreshTimer = 0;
let federationStatusClockTimer = 0;
let latestFederationSettings = null;
let federationFormDirty = false;
let federationSettingsLoadGeneration = 0;
let projectColorPickerOriginal = '';
let projectColorPickerDirty = false;
let replicaRetryTimer = 0;
let presentedCardIdentity = '';
let routeLoadGeneration = 0;
let routeLoadController = null;
let masterSubtaskExecutionController = null;
let activeResponsiveTaskClock = null;
let codexSettingsRequest = null;
let expandedMasterSubtaskIdentity = '';
const optimisticExecutionIntents = new Map();
const pendingOptimisticExecutionDetails = new Map();
const optimisticTaskIntents = new Map();

function currentRouteSnapshot() {
  return captureRouteSnapshot(location, parseProjectScope);
}

function beginRouteLoad() {
  routeLoadController?.abort();
  masterSubtaskExecutionController?.abort();
  masterSubtaskExecutionController = null;
  routeLoadController = new AbortController();
  return Object.freeze({ generation: ++routeLoadGeneration, route: currentRouteSnapshot(), signal: routeLoadController.signal });
}

function ownsRouteLoad(owner) {
  return owner.generation === routeLoadGeneration && !owner.signal.aborted && sameRouteSnapshot(owner.route, currentRouteSnapshot());
}

function requireRouteOwnership(owner) {
  if (!ownsRouteLoad(owner)) throw new DOMException('Superseded route load.', 'AbortError');
}

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

function projectFetch(url, options = {}, projectId = state.resourceProjectId, replicaNodeId = '') {
  const headers = new Headers(options.headers);
  if (replicaNodeId) headers.set('x-decision-os-replica-node', replicaNodeId);
  return fetch(projectScopedRequestPath(url, projectId), { ...options, headers });
}

function replicaAddress(path, nodeId = new URLSearchParams(location.search).get('replica') || '') {
  if (!nodeId) return path;
  const url = new URL(path, location.origin);
  url.searchParams.set('replica', nodeId);
  return `${url.pathname}${url.search}${url.hash}`;
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
  // WHAT: Reject a non-loading leave transition while card-detail tooling still owns the active surface.
  // WHY: A blocked close must preserve both the rendered card and its current disclosure identity.
  if (name !== 'card-view' && name !== 'loading-view' && !closeCardDetail()) return false;
  // WHAT: Clear the route-local disclosure identity whenever the card surface is left or loading starts.
  // WHY: Re-entering a master-task card must begin collapsed instead of retaining a disclosure from a previous view.
  if (name !== 'card-view') expandedMasterSubtaskIdentity = '';
  for (const id of ['loading-view', 'error-view', 'empty-view', 'projects-view', 'project-detail-view', 'settings-view', 'runtime-status-view', 'overview-view', 'control-room-view', 'done-view', 'ledger-view', 'zone-view', 'card-view']) {
    elements[id].hidden = id !== name;
  }
  if (name !== 'card-view' && name !== 'loading-view') presentedCardIdentity = '';
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
  return replicaAddress(ledgerPathForProject(state.resourceProjectId, ledgerId));
}

function zonePath(ledgerId, zoneId) {
  return replicaAddress(zonePathForProject(state.resourceProjectId, ledgerId, zoneId));
}

function cardPath(ledgerId, zoneId, cardId) {
  return replicaAddress(cardPathForProject(state.resourceProjectId, ledgerId, zoneId, cardId));
}

function closeCardDetail(options) {
  const threadVisible = document.body.classList.contains('card-thread-open');
  if (!threadVisible) return true;
  return closeMobileThread(options);
}

function responsiveCardAccent(card, fallback = state.activeZoneColor || defaultAccent, taskIds) {
  const projectColor = state.projects.find((project) => project.id === state.resourceProjectId)?.color || defaultAccent;
  return taskFamilyCardAccent({ ledger: state.ledger, cardId: String(card?.id || ''), projectColor, taskIds }) || fallback;
}

function openCardDetail(card, cardAccent = responsiveCardAccent(card)) {
  const nextIdentity = cardPresentationIdentity(currentRouteSnapshot());
  const routeEntry = nextIdentity !== presentedCardIdentity;
  const subtask = (state.ledger.relationships ?? []).some((relationship) => (
    String(relationship.to) === String(card.id) && relationship.label === 'subtask'
  ));
  setMobileThreadCard(card, { subtask });
  setMobileCodexContext({ projectId: state.resourceProjectId, ledgerId: state.activeLedgerId, cardId: state.activeCardId });
  setView('card-view');
  if (routeEntry) {
    if (window.matchMedia?.('(min-width: 761px)').matches === true) openMobileThread(card, cardAccent);
    else closeMobileThread({ fromHistory: true });
  }
  presentedCardIdentity = nextIdentity;
}

function pathForTask(task) {
  return replicaAddress(cardPathForProject(task.projectId, task.ledgerId, task.zoneId || 'ungrouped', task.cardId), task.ownerNodeId);
}

function taskForCurrentRoute() {
  const route = captureRouteSnapshot(location, parseProjectScope);
  return (state.controlRoom?.allTasks ?? []).find((task) => (
    task.projectId === route.projectId && task.ledgerId === route.ledgerId && task.cardId === route.cardId
  )) ?? null;
}

function renderTaskReplicaShell(task, replica = task?.replica) {
  const route = captureRouteSnapshot(location, parseProjectScope);
  const project = state.projects.find((entry) => entry.id === route.projectId);
  if (project) setResourceProject(project.id);
  state.activeLedgerId = route.ledgerId || task?.ledgerId || '';
  state.activeZoneId = route.zoneId || task?.zoneId || 'ungrouped';
  state.activeZoneColor = task?.projectColor || project?.color || defaultAccent;
  state.activeCardId = route.cardId || task?.cardId || '';
  setMobileCodexContext({ projectId: state.resourceProjectId, ledgerId: state.activeLedgerId, cardId: state.activeCardId });
  const status = replica?.status || 'synchronizing';
  const label = {
    replicated: 'Refreshing the local replica…',
    synchronizing: 'Synchronizing this task from its owner…',
    stale: 'Refreshing stale task data…',
    blocked: 'Task synchronization is blocked. Retrying…',
    offline: 'The owner is offline. Waiting for a retained replica…'
  }[status] || 'Synchronizing this task…';
  elements['card-title'].textContent = task?.title || 'Loading task';
  const backButton = document.querySelector('.back-to-zone-button');
  const backIcon = document.createElement('span');
  backIcon.className = 'back-button__icon';
  backIcon.setAttribute('aria-hidden', 'true');
  backIcon.textContent = '←';
  const backLabel = document.createElement('span');
  backLabel.textContent = 'Back';
  backButton.replaceChildren(backIcon, backLabel);
  backButton.dataset.destination = 'control-room';
  const shell = document.createElement('section');
  shell.className = 'task-state-skeleton';
  shell.dataset.replicaStatus = status;
  shell.setAttribute('role', 'status');
  shell.setAttribute('aria-live', 'polite');
  shell.innerHTML = '<p class="task-state-message"></p><div></div><div></div><div></div>';
  shell.querySelector('.task-state-message').textContent = replica?.message || label;
  elements['card-body'].replaceChildren(shell);
  elements['card-view'].style.setProperty('--zone-color', state.activeZoneColor || 'var(--accent)');
  elements['card-view'].style.setProperty('--accent', state.activeZoneColor || defaultAccent);
  setView('card-view');
  document.title = `${elements['card-title'].textContent} · ${project?.name || state.projectName}`;
}

function commitRouteView() {
  if (location.pathname === '/' && state.controlRoom) {
    state.controlTab = parseControlRoomRoute(location.href).tab;
    renderControlRoom();
    return true;
  }
  if (location.pathname === '/done' && state.controlRoom) {
    renderDone();
    return true;
  }
  if (isProjectCardPath(location.pathname)) {
    const task = taskForCurrentRoute();
    const { ledgerId, cardId } = currentRouteSnapshot();
    const cached = state.activeLedgerId === ledgerId && state.ledger?.cards?.find((card) => String(card.id) === cardId);
    // WHAT: Render a cached card only when its Markdown body has been hydrated.
    // WHY: Navigation projections omit comment.what and must not become the visible `Ledger card` fallback.
    if (cached && ledgerCardHasHydratedBody(cached)) renderCard(cached);
    else renderTaskReplicaShell(task);
    return true;
  }
  return false;
}

function navigate(path, replace = false, returnPathOverride = '') {
  const destination = new URL(path, location.origin);
  const currentLocation = `${location.pathname}${location.search}${location.hash}`;
  const nextLocation = `${destination.pathname}${destination.search}${destination.hash}`;
  if (currentLocation !== nextLocation && !requestActiveLedgerCardEditorClose('route')) return false;
  if (currentLocation !== nextLocation && !requestSkillLibraryEditorClose('route')) return false;
  if (currentLocation !== nextLocation && !closeCardDetail({ discardHistory: true })) return false;
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
  const returnPath = returnPathOverride || `${location.pathname}${location.search}${location.hash}`;
  history[replace ? 'replaceState' : 'pushState']({ returnPath }, '', path);
  closeCodexRouteScreens();
  closeMenu();
  const retained = commitRouteView();
  void loadRoute({ retainView: retained });
  return true;
}

function removeEditorQuery(expectedEditor) {
  const url = new URL(location.href);
  if (url.searchParams.get('editor') !== expectedEditor) return;
  url.searchParams.delete('editor');
  url.searchParams.delete('name');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function beginOptimisticExecution(detail) {
  // WHAT: Ignore execution events that cannot own an optimistic request identity.
  // WHY: Reconciliation must never use an empty identity that could match unrelated work.
  if (!detail?.requestId) return '';
  // WHAT: Retain cold-route execution details until the first Control Room projection arrives.
  // WHY: A directly opened card has no hydrated task from which to build its preparing intent.
  if (!state.controlRoom) {
    pendingOptimisticExecutionDetails.set(String(detail.requestId), detail);
    telemetry('optimistic-projection-installed', { requestId: String(detail.requestId), kind: String(detail.kind ?? ''), outcome: 'pending-control-room' });
    return String(detail.requestId);
  }
  const task = controlRoomTaskForExecution(state.controlRoom, detail);
  // WHAT: Decline to project an execution that has no matching task in the hydrated Control Room.
  // WHY: Optimism must not synthesize a task outside the authoritative task inventory.
  if (!task) return '';
  const intent = createOptimisticExecutionIntent(task, detail);
  const identity = taskIdentity(task);
  optimisticExecutionIntents.set(identity, intent);
  applyOptimisticExecutionIntent(state.controlRoom, intent);
  telemetry('optimistic-projection-installed', { requestId: String(detail.requestId), kind: String(detail.kind ?? ''), outcome: 'projected', taskIdentity: identity });
  if (location.pathname === '/') renderControlRoom();
  return identity;
}

function acknowledgeOptimisticExecution(detail) {
  const clientRequestId = String(detail?.clientRequestId ?? detail?.requestId ?? '');
  pendingOptimisticExecutionDetails.delete(clientRequestId);
  const removed = removeAcknowledgedExecutionIntent(optimisticExecutionIntents, detail);
  void loadControlRoom({ force: true }).then(() => {
    telemetry('admission-reconciled', { requestId: clientRequestId, kind: String(detail?.kind ?? ''), outcome: 'accepted', removed });
    if (location.pathname === '/') renderControlRoom();
  }).catch((error) => console.error('Execution admission confirmation failed.', error));
}

function rejectOptimisticExecution(detail) {
  const rejectedRequestId = String(detail?.requestId ?? '');
  pendingOptimisticExecutionDetails.delete(rejectedRequestId);
  const removed = removeRejectedExecutionIntent(optimisticExecutionIntents, detail);
  elements['mutation-error-message'].textContent = String(detail?.error || 'Execution admission was rejected and confirmed state was restored.');
  elements['mutation-error'].hidden = false;
  void loadControlRoom({ force: true }).then(() => {
    telemetry('rejection-reconciled', { requestId: rejectedRequestId, kind: String(detail?.kind ?? ''), outcome: 'rejected', removed });
    if (location.pathname === '/') renderControlRoom();
  }).catch((error) => console.error('Execution admission reconciliation failed.', error));
}

async function navigateVoiceSubmission(detail) {
  beginOptimisticExecution(detail);
  return navigate(controlRoomPath('exec'), true);
}

async function navigateAcceptedProcess(detail) {
  const snapshot = currentRouteSnapshot();
  const threadGeneration = Number(document.body.dataset.threadPresentationGeneration || 0);
  if (!acceptedRunOwnsRoute(detail, snapshot, threadGeneration)) return false;
  return navigate(controlRoomPath('exec'), true);
}

async function navigateTaskBack(destination) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  if (typeof document.startViewTransition !== 'function' || reducedMotion) {
    navigate(destination);
    return;
  }
  document.documentElement.dataset.taskBackHandoff = 'true';
  try {
    const transition = document.startViewTransition(() => { navigate(destination); });
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
  const directoryField = document.querySelector('.creation-directory-field');
  directoryField.hidden = kind !== 'project';
  creationModal.classList.toggle('project-creation-modal', kind === 'project');
  document.querySelector('#creation-directory').value = '';
  document.querySelector('#creation-directory-display').value = '';
  document.querySelector('.creation-directory-browser').hidden = true;
  projectDirectoryListings = new Map();
  expandedProjectDirectories = new Set();
  loadingProjectDirectories = new Set();
  selectedProjectDirectory = '';
  document.querySelector('.creation-color-field').hidden = kind !== 'zone';
  if (kind === 'zone') document.querySelector('#creation-color').value = state.projects.find((project) => project.id === state.resourceProjectId)?.color || defaultAccent;
  document.querySelector('.creation-submit').textContent = submit;
  document.querySelector('.creation-error').hidden = true;
  creationModal.showModal();
  name.focus();
}

function projectDirectoryBadges(directory) {
  const badges = document.createElement('span');
  badges.className = 'creation-directory-badges';
  for (const badgeText of [directory.hasGit ? 'Git' : '', directory.hasDecisionOs ? 'Decision OS' : ''].filter(Boolean)) {
    const badge = document.createElement('span');
    badge.className = 'creation-directory-badge';
    badge.textContent = badgeText;
    badges.append(badge);
  }
  return badges;
}

function selectDirectoryTreeItem(directory) {
  selectedProjectDirectory = directory.path;
  document.querySelector('#creation-directory').value = directory.path;
  document.querySelector('#creation-directory-display').value = directory.absolutePath;
  const name = document.querySelector('#creation-name');
  if (!name.value.trim()) name.value = directory.name;
  renderProjectDirectoryTree();
}

async function toggleProjectDirectory(directory) {
  if (expandedProjectDirectories.has(directory.path)) {
    expandedProjectDirectories.delete(directory.path);
    renderProjectDirectoryTree();
    return;
  }
  expandedProjectDirectories.add(directory.path);
  renderProjectDirectoryTree();
  if (!projectDirectoryListings.has(directory.path)) await loadProjectDirectory(directory.path);
}

function projectDirectoryNode(directory, level) {
  const item = document.createElement('div');
  item.className = 'creation-directory-treeitem';
  item.dataset.path = directory.path;
  item.setAttribute('role', 'treeitem');
  item.setAttribute('aria-level', String(level));
  item.setAttribute('aria-expanded', String(expandedProjectDirectories.has(directory.path)));
  item.setAttribute('aria-selected', String(selectedProjectDirectory === directory.path));
  item.tabIndex = selectedProjectDirectory === directory.path || (!selectedProjectDirectory && level === 1) ? 0 : -1;

  const row = document.createElement('div');
  row.className = 'creation-directory-row';
  row.style.setProperty('--tree-depth', String(level - 1));
  const disclosure = document.createElement('button');
  disclosure.type = 'button';
  disclosure.className = 'creation-directory-disclosure';
  disclosure.setAttribute('aria-label', `${expandedProjectDirectories.has(directory.path) ? 'Collapse' : 'Expand'} ${directory.name}`);
  disclosure.textContent = loadingProjectDirectories.has(directory.path) ? '…' : expandedProjectDirectories.has(directory.path) ? '▾' : '▸';
  disclosure.addEventListener('click', (event) => {
    event.stopPropagation();
    void toggleProjectDirectory(directory);
  });
  const label = document.createElement('span');
  label.className = 'creation-directory-name';
  label.textContent = directory.name;
  const link = document.createElement('span');
  link.className = 'creation-directory-link';
  link.hidden = !directory.isSymbolicLink;
  link.setAttribute('aria-label', 'Symbolic link');
  link.textContent = '↗';
  row.append(disclosure, label, link, projectDirectoryBadges(directory));
  row.addEventListener('click', () => selectDirectoryTreeItem(directory));
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectDirectoryTreeItem(directory);
    } else if (event.key === 'ArrowRight' && !expandedProjectDirectories.has(directory.path)) {
      event.preventDefault();
      void toggleProjectDirectory(directory);
    } else if (event.key === 'ArrowLeft' && expandedProjectDirectories.has(directory.path)) {
      event.preventDefault();
      void toggleProjectDirectory(directory);
    }
  });
  item.append(row);

  const listing = projectDirectoryListings.get(directory.path);
  if (expandedProjectDirectories.has(directory.path) && listing) {
    const group = document.createElement('div');
    group.setAttribute('role', 'group');
    group.append(...listing.directories.map((child) => projectDirectoryNode(child, level + 1)));
    item.append(group);
  }
  return item;
}

function renderProjectDirectoryTree() {
  const rootListing = projectDirectoryListings.get('.');
  const tree = document.querySelector('.creation-directory-tree');
  if (!rootListing) {
    tree.replaceChildren();
    return;
  }
  tree.replaceChildren(projectDirectoryNode({
    path: rootListing.path,
    absolutePath: rootListing.absolutePath,
    name: rootListing.name || 'Catalog',
    hasGit: rootListing.hasGit,
    hasDecisionOs: rootListing.hasDecisionOs,
  }, 1));
}

async function loadProjectDirectory(path = '.') {
  const browser = document.querySelector('.creation-directory-browser');
  const status = document.querySelector('.creation-directory-status');
  browser.hidden = false;
  loadingProjectDirectories.add(path);
  if (path === '.') expandedProjectDirectories.add('.');
  status.textContent = path === '.' ? 'Loading directories…' : `Loading ${path}…`;
  renderProjectDirectoryTree();
  try {
    const listing = await loadProjectDirectoryRequest({ fetchImpl: fetch, path });
    projectDirectoryListings.set(path, listing);
    status.textContent = 'Expand folders and select the project directory.';
  } catch (cause) {
    expandedProjectDirectories.delete(path);
    status.textContent = cause instanceof Error ? cause.message : 'Directory listing failed.';
  } finally {
    loadingProjectDirectories.delete(path);
    renderProjectDirectoryTree();
  }
}

function responsiveLedgerScope({ projectId = state.resourceProjectId, replicaNodeId = currentRouteSnapshot().replicaNodeId, ledgerId = state.activeLedgerId } = {}) {
  return { projectId: String(projectId || ''), replicaNodeId: String(replicaNodeId || ''), ledgerId: String(ledgerId || '') };
}

function responsiveLedgerScopeKey(scope) {
  return JSON.stringify(responsiveLedgerScope(scope));
}

async function requestLedgerMutation(ledgerId, mutation, projectId, replicaNodeId) {
  const response = await projectFetch(`/decision-os/${encodeURIComponent(ledgerId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  }, projectId, replicaNodeId);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

const responsiveLedgerTransactions = createOptimisticLedgerTransactionCoordinator({
  read: () => state.ledger,
  write: (ledger) => { state.ledger = ledger; },
  isScopeActive: (scopeKey) => {
    const scope = JSON.parse(scopeKey);
    return scope.projectId === state.resourceProjectId
      && scope.replicaNodeId === currentRouteSnapshot().replicaNodeId
      && scope.ledgerId === state.activeLedgerId;
  },
  persist: async (scopeKey, mutation) => {
    const scope = JSON.parse(scopeKey);
    try {
      const mutations = Array.isArray(mutation) ? mutation : [mutation];
      const applied = [];
      try {
        for (const entry of mutations) {
          await requestLedgerMutation(scope.ledgerId, entry, scope.projectId, scope.replicaNodeId);
          applied.push(entry);
        }
      } catch (error) {
        const createdCard = applied.find((entry) => entry.action === 'create-card')?.card;
        if (createdCard?.id) {
          await requestLedgerMutation(scope.ledgerId, { action: 'delete-card', cardId: createdCard.id }, scope.projectId, scope.replicaNodeId).catch(() => undefined);
        }
        throw error;
      }
      const response = await projectFetch(`/api/ledgers/${encodeURIComponent(scope.ledgerId)}/canvas`, { cache: 'no-store' }, scope.projectId, scope.replicaNodeId);
      const confirmed = await response.json().catch(() => null);
      if (!response.ok || !confirmed || typeof confirmed !== 'object' || Array.isArray(confirmed)) {
        console.error(`Ledger confirmation refresh failed with HTTP ${response.status}; the accepted mutation remains optimistic.`);
        return { ok: true };
      }
      return { ok: true, confirmed };
    } catch (error) {
      return { ok: false, error };
    }
  },
});

function runResponsiveLedgerTransaction({ mutation, apply, scope = responsiveLedgerScope(), render, onRejected }) {
  return responsiveLedgerTransactions.run({ scope: responsiveLedgerScopeKey(scope), mutation, apply, render, onRejected });
}

async function ledgerMutation(ledgerId, mutation, projectId = state.resourceProjectId, replicaNodeId = currentRouteSnapshot().replicaNodeId) {
  const payload = await requestLedgerMutation(ledgerId, mutation, projectId, replicaNodeId);
  if (!payload?.ok
    || projectId !== state.resourceProjectId
    || replicaNodeId !== currentRouteSnapshot().replicaNodeId
    || ledgerId !== state.activeLedgerId
    || !state.ledger) return payload;
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

async function createProject(name, description, directory) {
  const project = await createProjectRequest({ fetchImpl: fetch, name, description, directory });
  state.projects = [...state.projects, project].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  setMobileCodexContext({ projects: state.projects });
  navigate(projectPath(project.id));
}

async function createZone(name, color) {
  const rect = nextZoneRect();
  const annotation = { id: objectId('zone'), ...rect, color, label: name, comments: [] };
  const previousPath = `${location.pathname}${location.search}${location.hash}`;
  const destination = zonePath(state.activeLedgerId, annotation.id);
  const committed = runResponsiveLedgerTransaction({
    mutation: { action: 'create-zone', annotation },
    apply: (ledger) => {
      ledger.annotations = (ledger.annotations ?? []).filter((entry) => String(entry.id) !== annotation.id).concat(structuredClone(annotation));
    },
    onRejected: () => {
      if (location.pathname === new URL(destination, location.origin).pathname) navigate(previousPath, true);
    },
  });
  navigate(destination);
  if (!await committed) throw new Error('Zone creation failed and was restored.');
}

async function createCard(name, description) {
  const zone = ledgerZones().find((entry) => String(entry.id) === state.activeZoneId);
  if (!zone || zone.id === 'ungrouped') throw new Error('Choose a canvas zone before creating a card.');
  const { rect, requiredZoneHeight } = nextCardRect(zone);
  const currentHeight = Number(zone.height ?? zone.h ?? 0);
  const mutations = [{ action: 'create-card', card: null }];
  if (requiredZoneHeight > currentHeight) mutations.push({
      action: 'patch-geometry',
      geometry: { zones: { [zone.id]: { x: Number(zone.x ?? 0), y: Number(zone.y ?? 0), width: Number(zone.width ?? zone.w ?? 1200), height: requiredZoneHeight } } }
  });
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
  mutations[0].card = card;
  const scope = responsiveLedgerScope();
  const previousPath = `${location.pathname}${location.search}${location.hash}`;
  const destination = cardPath(state.activeLedgerId, state.activeZoneId, card.id);
  const committed = runResponsiveLedgerTransaction({
    scope,
    mutation: mutations,
    apply: (ledger) => {
      ledger.cards = (ledger.cards ?? []).filter((entry) => String(entry.id) !== card.id).concat(structuredClone(card));
      if (requiredZoneHeight > currentHeight) {
        const annotation = (ledger.annotations ?? []).find((entry) => String(entry.id) === String(zone.id));
        if (annotation) annotation.height = requiredZoneHeight;
      }
    },
    onRejected: () => {
      if (location.pathname === new URL(destination, location.origin).pathname) navigate(previousPath, true);
    },
  });
  syncMobileThreadContext({ projectId: state.resourceProjectId, replicaNodeId: currentRouteSnapshot().replicaNodeId, ledgerId: state.activeLedgerId, ledger: state.ledger, ledgers: state.ledgers, onCodexStarted: activateMasterTask, localProjection: true });
  navigate(destination);
  if (!await committed) throw new Error('Card creation failed and was restored.');
}

async function submitCreation() {
  const name = document.querySelector('#creation-name').value.trim();
  if (!name) return;
  const submit = document.querySelector('.creation-submit');
  const error = document.querySelector('.creation-error');
  submit.disabled = true;
  error.hidden = true;
  try {
    if (creationKind === 'project') {
      const directory = document.querySelector('#creation-directory').value;
      if (!directory) throw new Error('Choose a project directory.');
      await createProject(name, document.querySelector('#creation-description').value, directory);
    }
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
    check: '<path d="M5 12.5 9.5 17 19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z"/>',
    book: '<path d="M5 4h6a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm14 0h-2a3 3 0 0 0-3 3v13h2a3 3 0 0 0 3-3V4Z"/>',
    flow: '<path d="M5 5h4v4H5V5Zm10 10h4v4h-4v-4ZM7 9v3a5 5 0 0 0 5 5h3M9 7h6a2 2 0 0 1 2 2v6"/>',
    library: '<path d="M4 5h4v15H4V5Zm6-1h4v16h-4V4Zm6 3h4v13h-4V7Z"/>',
    status: '<path d="M4 13h3l2-6 4 11 2-5h5M4 4h16v16H4V4Z"/>',
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
    destination('Done', '/done', 'check', 'done'),
    destination('Projects', projectPath(), 'folder', 'projects'),
    destination('Ledgers', '/ledgers', 'book', 'ledgers'),
    destination('Pipelines', '/pipelines', 'flow', 'pipelines', 'nav-pipelines-button'),
    destination('Skill library', '/skills', 'library', 'skills', 'nav-skills-button'),
    destination('System status', '/status', 'status', 'status', 'nav-runtime-status-button'),
    destination('Settings', '/settings', 'settings', 'settings', 'nav-settings-button')
  );
}

function formatObservedAt(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Unknown time';
}

function formatOccurrenceTotal(occurrences, partial, noun = 'failure') {
  let qualifier = '';
  // WHAT: Prefix totals whose retained history is incomplete with an explicit lower-bound label.
  // WHY: Observation loss and legacy history prohibit presenting the visible count as exact.
  if (partial) qualifier = 'At least ';
  let suffix = 's';
  // WHAT: Remove the plural suffix for a single retained occurrence.
  // WHY: Summary and group totals must remain readable at every count.
  if (occurrences === 1) suffix = '';
  return `${qualifier}${occurrences} ${noun}${suffix} · 24h`;
}

function formatIncidentContext(context) {
  const entries = Object.entries(context ?? {});
  // WHAT: Name the absence of additional structured source context.
  // WHY: An empty rendered slot would make complete evidence look accidentally omitted.
  if (entries.length === 0) return 'No additional context';
  return entries.map(([key, value]) => {
    let renderedValue = String(value);
    // WHAT: Serialize nested context values instead of coercing them to an opaque object label.
    // WHY: Dated event evidence must preserve structured operation and source details.
    if (value !== null && typeof value === 'object') renderedValue = JSON.stringify(value);
    return `${key}=${renderedValue}`;
  }).join(' · ');
}

function renderRuntimeStatus(diagnostics) {
  const rows = projectRuntimeRows(state.projects, diagnostics);
  const projects = rows.filter((row) => row.kind === 'project');
  const pausedProjects = projects.filter((project) => project.status === 'paused').length;
  const unavailableProjects = projects.filter((project) => project.status === 'unavailable').length;
  elements['runtime-status-summary'].textContent = `${diagnostics?.status === 'ready' ? 'Ready' : 'Degraded'} · observed ${formatObservedAt(diagnostics?.observedAt)}`;
  elements['runtime-project-status-summary'].textContent = pausedProjects > 0 || unavailableProjects > 0
    ? `${pausedProjects} paused · ${unavailableProjects} unavailable`
    : `${projects.length} available`;
  elements['runtime-project-list'].replaceChildren(...rows.map((project) => {
    const row = document.createElement('details');
    row.className = 'runtime-project-row';
    row.dataset.status = project.status;
    row.dataset.projectId = project.id;
    row.style.setProperty('--project-color', project.color);
    const summary = document.createElement('summary');
    summary.className = 'runtime-project-summary';
    const mark = Object.assign(document.createElement('span'), { className: 'runtime-project-mark' });
    mark.setAttribute('aria-hidden', 'true');
    const copy = Object.assign(document.createElement('div'), { className: 'runtime-project-copy' });
    copy.append(
      Object.assign(document.createElement('strong'), { textContent: project.name }),
      Object.assign(document.createElement('small'), { textContent: project.detail }),
    );
    const summaryState = Object.assign(document.createElement('div'), { className: 'runtime-project-summary-state' });
    const total = Object.assign(document.createElement('span'), {
      className: 'runtime-project-occurrences',
      textContent: formatOccurrenceTotal(project.occurrences, project.occurrencesPartial),
    });
    total.dataset.partial = String(project.occurrencesPartial);
    const badge = Object.assign(document.createElement('span'), { className: 'runtime-status-badge runtime-project-availability', textContent: project.label });
    summaryState.append(total, badge);
    summary.append(mark, copy, summaryState);
    const incidentList = Object.assign(document.createElement('div'), { className: 'runtime-project-incidents' });
    incidentList.setAttribute('aria-label', `${project.name} failure history`);
    // WHAT: Explain why a project-level 24-hour total is a lower bound before listing its retained evidence.
    // WHY: Legacy and global truncation markers have different evidence-loss scopes that operators must be able to distinguish.
    if (project.occurrencesPartial) {
      let partialReason = 'the diagnostics observation time was unavailable';
      // WHAT: Identify owner-scoped legacy loss as the reason for a partial project total.
      // WHY: Legacy lifetime counts cannot be expanded into dated rolling-window events.
      if (project.legacyHistory) partialReason = 'earlier owner history is unavailable';
      // WHAT: Identify document-wide retention loss as the reason for a partial project total.
      // WHY: A global truncation watermark means discarded evidence can still intersect this 24-hour window.
      if (project.truncatedHistory) partialReason = 'retained system history was truncated';
      // WHAT: Disclose both incomplete-history boundaries when they apply to the same project row.
      // WHY: Reporting only one marker would hide a verified source of missing occurrences.
      if (project.legacyHistory && project.truncatedHistory) partialReason = 'earlier owner history is unavailable and retained system history was truncated';
      incidentList.append(Object.assign(document.createElement('p'), {
        className: 'runtime-history-lower-bound',
        textContent: `Lower bound: ${partialReason}.`,
      }));
    }
    incidentList.append(...project.incidents.map((incident) => {
      const card = document.createElement('article');
      card.className = 'runtime-incident-card';
      card.dataset.interrupting = String(incident.interrupting);
      card.dataset.severity = incident.severity;
      const heading = Object.assign(document.createElement('header'), { className: 'runtime-incident-heading' });
      const incidentCopy = document.createElement('div');
      incidentCopy.append(
        Object.assign(document.createElement('code'), { textContent: incident.code }),
        Object.assign(document.createElement('small'), {
          textContent: `${incident.components.join(', ') || 'runtime'} · ${formatOccurrenceTotal(incident.occurrences, incident.occurrencesPartial, 'occurrence')} · last ${formatObservedAt(incident.lastObservedAt)}`,
        }),
      );
      const labels = Object.assign(document.createElement('div'), { className: 'runtime-incident-labels' });
      const severity = Object.assign(document.createElement('span'), {
        className: 'runtime-status-badge',
        textContent: incident.severity,
      });
      severity.dataset.kind = 'severity';
      let activityLabel = 'Resolved';
      // WHAT: Label a group with retained active incidents as active even when its rolling count is zero.
      // WHY: Current incident authority remains independent of whether dated occurrences still intersect the window.
      if (incident.activeIncidentCount > 0) activityLabel = 'Active';
      // WHAT: Elevate a group whose active scope matches a pause registry to an interruption.
      // WHY: The registry match is the authoritative signal that work is currently blocked.
      if (incident.interrupting) activityLabel = 'Interruption';
      const activity = Object.assign(document.createElement('span'), {
        className: 'runtime-status-badge',
        textContent: activityLabel,
      });
      activity.dataset.kind = 'interruption';
      labels.append(severity, activity);
      heading.append(incidentCopy, labels);
      const events = Object.assign(document.createElement('div'), { className: 'runtime-incident-events' });
      events.setAttribute('aria-label', `${incident.code} dated occurrences`);
      // WHAT: Render each retained occurrence as its own dated evidence record inside the owner-and-code group.
      // WHY: Equal error codes can retain different messages, sources, statuses, and contexts that must not be collapsed.
      for (const event of incident.events) {
        const evidence = Object.assign(document.createElement('article'), { className: 'runtime-incident-event' });
        const eventHeading = Object.assign(document.createElement('header'), { className: 'runtime-incident-event-heading' });
        const time = Object.assign(document.createElement('time'), {
          dateTime: event.observedAt,
          textContent: formatObservedAt(event.observedAt),
        });
        const eventState = Object.assign(document.createElement('span'), {
          className: 'runtime-incident-event-state',
          textContent: `${event.status} · ${event.severity}`,
        });
        eventHeading.append(time, eventState);
        const source = Object.assign(document.createElement('dl'), { className: 'runtime-incident-source' });
        const sourceValues = [
          ['Component', event.component || 'runtime'],
          ['Scope', event.scope || 'Unscoped'],
          ['Context', formatIncidentContext(event.context)],
        ];
        // WHAT: Render component, scope, and structured context for the dated occurrence.
        // WHY: Each message needs its own source trail rather than only group-level aggregate metadata.
        for (const [label, value] of sourceValues) {
          source.append(
            Object.assign(document.createElement('dt'), { textContent: label }),
            Object.assign(document.createElement('dd'), { textContent: value }),
          );
        }
        evidence.append(
          eventHeading,
          Object.assign(document.createElement('p'), { className: 'runtime-incident-message', textContent: event.message }),
          source,
        );
        events.append(evidence);
      }
      // WHAT: State explicitly when an active group has no dated evidence inside the rolling window.
      // WHY: A blank group could otherwise look like a rendering failure instead of current authority with zero recent occurrences.
      if (incident.events.length === 0) {
        events.append(Object.assign(document.createElement('p'), {
          className: 'runtime-history-empty',
          textContent: 'No dated occurrences in the last 24 hours.',
        }));
      }
      card.append(heading, events);
      return card;
    }));
    // WHAT: Give an expanded project with no failure groups an explicit history state.
    // WHY: Every catalog project remains a disclosure even when its rolling total is exactly zero.
    if (project.incidents.length === 0) {
      incidentList.append(Object.assign(document.createElement('p'), {
        className: 'runtime-history-empty',
        textContent: 'No failures recorded in the last 24 hours.',
      }));
    }
    row.append(summary, incidentList);
    return row;
  }));
  // WHAT: Render an explicit empty state only when neither catalog projects nor unowned active incidents produced a row.
  // WHY: The conditional System row is meaningful status content even when the catalog is empty.
  if (rows.length === 0) {
    elements['runtime-project-list'].append(Object.assign(document.createElement('p'), { className: 'runtime-status-empty', textContent: 'No projects discovered.' }));
  }
}

async function renderRuntimeStatusRoute(owner) {
  state.resourceProjectId = '';
  state.projectName = 'Decision OS';
  elements['project-name'].textContent = 'Decision OS';
  setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
  renderLedgerLinks();
  setView('runtime-status-view');
  elements['runtime-status-summary'].textContent = 'Loading current runtime state…';
  const diagnostics = await loadRuntimeDiagnostics(fetch, { signal: owner.signal });
  requireRouteOwnership(owner);
  renderRuntimeStatus(diagnostics);
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
    const settings = await requestCodexSettings({ force: true });
    renderCodexProcessLimit(settings.maxConcurrentCodexProcesses);
    renderPipelineSetting(elements['codex-settings-voice-pipeline'], settings.pipelines, settings.voicePipelineId);
    renderPipelineSetting(elements['codex-settings-master-task-completion-pipeline'], settings.pipelines, settings.masterTaskCompletionPipelineId);
    elements['codex-settings-message'].textContent = '';
  } catch (error) {
    elements['codex-settings-message'].textContent = error instanceof Error ? error.message : 'Could not load settings.';
  }
}

function renderPipelineSetting(select, pipelines, selectedId) {
  select.replaceChildren(
    Object.assign(document.createElement('option'), { value: '', textContent: 'Not configured' }),
    ...(pipelines || []).map((pipeline) => Object.assign(document.createElement('option'), { value: pipeline.id, textContent: pipeline.name }))
  );
  select.value = selectedId || '';
}

async function requestCodexSettings({ force = false } = {}) {
  if (!force && state.codexSettingsLoaded) return {
    masterTaskCompletionPipelineId: state.masterTaskCompletionPipelineId,
  };
  if (!force && codexSettingsRequest) return codexSettingsRequest;
  const request = loadCodexProcessSettings(fetch).then((settings) => {
    state.masterTaskCompletionPipelineId = settings.masterTaskCompletionPipelineId || '';
    state.codexSettingsLoaded = true;
    return settings;
  });
  codexSettingsRequest = request;
  try {
    return await request;
  } finally {
    if (codexSettingsRequest === request) codexSettingsRequest = null;
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
    const result = await saveCodexProcessSettings(
      fetch,
      elements['codex-settings-limit'].value,
      elements['codex-settings-voice-pipeline'].value,
      elements['codex-settings-master-task-completion-pipeline'].value
    );
    state.masterTaskCompletionPipelineId = result.masterTaskCompletionPipelineId || '';
    state.codexSettingsLoaded = true;
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
    button.disabled = !project.available;
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
  elements['project-detail-status'].textContent = `${projectPresenceLabel(project)} · ${project.ledgers.length} ${project.ledgers.length === 1 ? 'ledger' : 'ledgers'}`;
  elements['project-detail-path'].textContent = `Replicas: ${projectOwnerLabel(project)} · ${project.id}`;
  // WHAT: Keep settings reachable when a remote-only project has a complete Sync source.
  // WHY: Source selection is valid without a locally editable project replica.
  document.querySelector('.project-settings-button').hidden = !projectLocalReplica(project) && !projectSyncRequestInput(project);
  setView('project-detail-view');
  document.title = `${project.name} · Projects`;
}

function openProjectSettings() {
  const project = state.projects.find((entry) => entry.id === state.viewedProjectId);
  // WHAT: Stop opening settings when the selected catalog project was replaced before the click settled.
  // WHY: The modal must not present controls for a project that is no longer in the active catalog.
  if (!project) return;
  const values = projectSettingsValues(project);
  const name = document.querySelector('#project-settings-name');
  const description = document.querySelector('#project-settings-description');
  name.value = values.name;
  description.value = values.description;
  const localReplica = projectLocalReplica(project);
  name.disabled = !localReplica;
  description.disabled = !localReplica;
  projectSettingsColorInput.value = values.color;
  document.querySelector('.project-settings-color-trigger').disabled = !localReplica;
  document.querySelector('.project-settings-save').hidden = !localReplica;
  document.querySelector('.project-settings-owner').textContent = `${projectPresenceLabel(project)} · ${project.id}`;
  const sync = document.querySelector('.project-settings-sync');
  const syncRequest = projectSyncRequestInput(project);
  // WHAT: Enable Sync only while the displayed project has a complete current source request.
  // WHY: The button must never expose an incomplete or outdated repository identity.
  sync.disabled = !syncRequest;
  renderProjectSettingsColorField(values.color);
  projectSettingsModal.querySelector('.project-settings-error').hidden = true;
  projectSettingsModal.showModal();
  (localReplica ? name : sync).focus();
}

async function startSelectedProjectSync() {
  const button = document.querySelector('.project-settings-sync');
  const error = projectSettingsModal.querySelector('.project-settings-error');
  const syncRequest = projectSyncRequestInput(state.projects.find((entry) => entry.id === state.viewedProjectId));
  // WHAT: Reject a click whose selected project no longer has an eligible source replica.
  // WHY: A catalog refresh can invalidate the modal's prior Sync identity before the user submits it.
  if (!syncRequest) {
    button.disabled = true;
    return;
  }
  button.disabled = true;
  error.hidden = true;
  try {
    const admission = await startProjectSyncRequest({ fetchImpl: fetch, ...syncRequest });
    projectSettingsModal.close();
    state.projectFilter = 'All';
    state.controlFilter = 'All';
    state.controlTab = 'exec';
    const navigationTask = admission.masterCardId
      ? { projectId: admission.projectId, ledgerId: admission.ledgerId, cardId: admission.masterCardId }
      : { projectId: admission.run.sourceProjectId, ledgerId: 'project-sync', cardId: `project-sync-${admission.run.syncId}` };
    const anchor = `task-${taskIdentity(navigationTask)}`;
    navigate(controlRoomPath('exec', anchor), true);
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Synchronization could not start.';
    error.hidden = false;
    button.disabled = false;
  }
}

async function submitProjectSettings() {
  const project = state.projects.find((entry) => entry.id === state.viewedProjectId);
  if (!project || !projectSettingsForm.reportValidity()) return;
  const save = document.querySelector('.project-settings-save');
  const error = projectSettingsModal.querySelector('.project-settings-error');
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
  const ledgerCount = state.projects.reduce((total, project) => total + project.ledgers.length, 0);
  // WHAT: Select the singular summary label only for one ledger.
  // WHY: The aggregate count must remain grammatically correct after grouping the rendered rows.
  elements['overview-summary'].textContent = `${ledgerCount} ${ledgerCount === 1 ? 'ledger' : 'ledgers'} across ${state.projects.length} projects`;
  const projectList = document.createElement('div');
  projectList.className = 'overview-project-list';
  state.projects.forEach((project) => {
    const projectRow = document.createElement('details');
    projectRow.className = 'overview-project';
    projectRow.dataset.projectId = project.id;
    projectRow.style.setProperty('--project-color', project.color);
    const summary = document.createElement('summary');
    summary.className = 'overview-project-summary';
    const projectName = document.createElement('span');
    projectName.className = 'overview-project-name';
    projectName.textContent = project.name;
    summary.append(projectName);
    const projectLedgers = document.createElement('div');
    projectLedgers.className = 'overview-project-ledgers';
    // WHAT: Render an explicit empty-project message instead of omitting a catalog project.
    // WHY: The global Ledgers catalog must represent registered projects that own no ledgers.
    if (project.ledgers.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'overview-project-empty';
      empty.textContent = 'No ledgers';
      projectLedgers.append(empty);
    }
    project.ledgers.forEach((ledger) => {
      const link = document.createElement('a');
      link.className = 'overview-ledger';
      link.href = ledgerPathForProject(project.id, ledger.id);
      const copy = document.createElement('span');
      const title = document.createElement('h2');
      title.textContent = ledger.title;
      const detail = document.createElement('p');
      detail.textContent = `${project.name} · ${ledger.id}`;
      copy.append(title, detail);
      const arrow = document.createElement('span');
      arrow.className = 'row-arrow';
      arrow.textContent = '›';
      link.append(copy, arrow);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigate(link.getAttribute('href'));
      });
      projectLedgers.append(link);
    });
    projectRow.append(summary, projectLedgers);
    projectList.append(projectRow);
  });
  elements['overview-ledgers'].replaceChildren(projectList);
  document.querySelector('.create-ledger-button').hidden = true;
  setView('overview-view');
  document.title = 'Ledgers · Decision OS';
}

function selectedControlProjectFilter() {
  return projectFilterGroups(state.projects).find((project) => project.id === state.projectFilter);
}

function filterControlTasksByProject(tasks) {
  if (state.projectFilter === 'All') return tasks;
  const selectedProject = selectedControlProjectFilter();
  return tasks.filter((task) => projectFilterIncludes(selectedProject, task.projectId));
}

function filteredControlTasks(tab = state.controlTab) {
  const tasks = state.controlRoom?.[tab] ?? [];
  const projectTasks = filterControlTasksByProject(tasks);
  return state.controlFilter === 'All' ? projectTasks : projectTasks.filter((task) => task.ledgerId === state.controlFilter);
}

function destroyQueueSortables() {
  queueSortables.forEach((sortable) => sortable.destroy());
  queueSortables = [];
}

function queueDragInProgress() {
  return queueDragActive || queueDragSettling;
}

function queueRefreshBlocked() {
  return queueDragInProgress();
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

async function settleQueueDrag({ rerender = false } = {}) {
  removeQueueDragArtifacts();
  if (rerender) renderControlRoom();
  removeQueueDragArtifacts();
  queueDragActive = false;
  queueDragSettling = false;
  queueDragInterrupted = false;
  initializeQueueSortable();
  await flushPendingControlRoomRefresh();
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
      if (placementChanged) {
        queueMicrotask(() => void persistControlTaskPlacement({ taskId, sourceTab, targetTab, newIndex: event.newIndex }));
        return;
      }
      queueMicrotask(() => void settleQueueDrag({ rerender: true }));
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
  const projectTasks = filterControlTasksByProject(tasks);
  return state.controlFilter === 'All' ? projectTasks.length : projectTasks.filter((task) => task.ledgerId === state.controlFilter).length;
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
  const execution = executionPresentation(task);
  if (executing) {
    const runtimeStatus = summary.querySelector('.task-next');
    if (task.projectSyncFailed) {
      runtimeStatus.textContent = 'Failed';
    } else if (task.projectSync) {
      runtimeStatus.textContent = task.projectSyncPreparationPhase === 'materializing'
        ? 'Preparing repository'
        : task.projectSyncPhase === 'requested'
          ? 'Starting'
          : task.projectSyncPhase.replaceAll('_', ' ');
    } else if (execution.phase) {
      runtimeStatus.className = 'task-stopwatch';
      runtimeStatus.dataset.executionSince = execution.since;
      runtimeStatus.dataset.executionPhase = execution.phase;
      runtimeStatus.textContent = execution.text;
    } else {
      runtimeStatus.textContent = 'Running';
    }
  }
  const completedTime = Date.parse(String(task.completedAt ?? ''));
  const completedLabel = Number.isFinite(completedTime)
    ? `Completed ${new Date(completedTime).toLocaleString()}`
    : 'Completion date unavailable';
  const age = task.status === 'task-backlog'
    ? 'backlog'
    : task.status === 'task-complete'
      ? completedLabel
    : task.transcribingBeforeLaunch
      ? waitingAge(task.waitingSince).replace(/ waiting$/, ' transcribing')
      : task.status === 'task-execution'
        ? `${execution.elapsed || '00:00'} ${execution.phase || 'executing'}`
        : waitingAge(task.waitingSince);
  const process = task.codexProcessing ? ` · Codex ${task.codexRunId}` : '';
  const taskOwner = executing
    ? task.executionNodeLabel || task.executionNodeId || task.assignedNodeLabel || task.assignedNodeId || 'This server'
    : task.assignedNodeLabel || task.assignedNodeId || 'Unassigned';
  if (summary.querySelector('.task-meta')) {
    const taskMeta = summary.querySelector('.task-meta');
    taskMeta.textContent = `${task.projectName} · ${taskOwner} · ${task.ledger} · ${age}${process}`;
    if (task.status === 'task-execution' && execution.since) {
      taskMeta.dataset.executionSince = execution.since;
      taskMeta.dataset.executionPhase = execution.phase;
      taskMeta.dataset.executionPrefix = `${task.projectName} · ${taskOwner} · ${task.ledger} · `;
      taskMeta.dataset.executionSuffix = process;
    }
  }
  if (task.remote || task.replica) {
    const replica = document.createElement('span');
    const taskState = task.state?.status || (task.ownerOnline === false ? 'offline' : 'synchronized');
    replica.className = `task-state-status is-${taskState}`;
    replica.textContent = taskState;
    replica.title = task.state?.message || '';
    if (taskState === 'synchronizing') replica.setAttribute('aria-live', 'polite');
    summary.querySelector('.task-copy').append(replica);
  }
  const labels = Array.isArray(task.labels) ? task.labels : [];
  if (labels.length > 0) {
    const labelList = document.createElement('span');
    labelList.className = 'task-labels';
    for (const value of labels) {
      const label = document.createElement('span');
      label.className = 'task-label';
      label.textContent = value;
      labelList.append(label);
    }
    summary.querySelector('.task-copy').append(labelList);
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
  if (task.projectSyncCanonical !== false) summary.addEventListener('click', () => navigate(pathForTask(task)));
  else {
    summary.setAttribute('aria-disabled', 'true');
    summary.style.cursor = 'default';
  }
  article.append(summary);
  if (task.projectSyncFailed) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'project-sync-retry';
    retry.textContent = 'Retry synchronization';
    retry.addEventListener('click', async () => {
      retry.disabled = true;
      try {
        const response = await fetch(`/api/project-sync/${encodeURIComponent(task.projectSyncId)}/retry`, { method: 'POST' });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.run) throw new Error(payload?.error || `Retry failed (${response.status}).`);
        await loadControlRoom({ force: true });
        renderControlRoom();
      } catch (cause) {
        retry.disabled = false;
        console.error('Project synchronization retry failed.', cause);
      }
    });
    article.append(retry);
  }
  return article;
}

function rememberControlRoomColumnScroll(list) {
  if (!elements['control-task-list'].contains(list)) return;
  const column = list?.dataset?.controlColumnList;
  if (!Object.hasOwn(controlRoomColumnScrollTop, column)) return;
  const scrollTop = Number(list.scrollTop);
  if (!Number.isFinite(scrollTop)) return;
  controlRoomColumnScrollTop[column] = Math.max(0, scrollTop);
  initializedControlRoomColumns.add(column);
}

function captureControlRoomColumnScroll() {
  if (elements['control-room-view'].hidden) return;
  if (controlRoomColumnScrollFrame) return;
  elements['control-task-list'].querySelectorAll('.control-task-column-list').forEach(rememberControlRoomColumnScroll);
}

function restoreControlRoomColumnScroll() {
  window.cancelAnimationFrame(controlRoomColumnScrollFrame);
  controlRoomColumnScrollFrame = window.requestAnimationFrame(() => {
    elements['control-task-list'].querySelectorAll('.control-task-column-list').forEach((list) => {
      const column = list.dataset.controlColumnList;
      if (!initializedControlRoomColumns.has(column)) return;
      const maximum = Math.max(0, Number(list.scrollHeight) - Number(list.clientHeight));
      list.scrollTop = Math.min(controlRoomColumnScrollTop[column], maximum);
    });
    controlRoomColumnScrollFrame = 0;
  });
}

function projectFilterButton(project, selected, onSelect) {
  const presentation = projectFilterChipPresentation(project);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `project-filter-chip${project.id === 'All' ? ' all-projects-filter' : ''}`;
  button.textContent = presentation.label;
  button.title = project.id === 'All'
    ? project.name
    : `${project.name} owned by ${project.projects.map(projectOwnerLabel).join(', ')}`;
  button.disabled = project.online === false;
  button.setAttribute('aria-pressed', String(project.id === selected));
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
  button.addEventListener('click', () => onSelect(project.id));
  return button;
}

function renderControlRoom() {
  captureControlRoomColumnScroll();
  destroyQueueSortables();
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  const projectFilters = [{ id: 'All', name: 'All projects', color: '#20242b', projects: state.projects }, ...projectFilterGroups(state.projects)];
  if (!projectFilters.some((project) => project.id === state.projectFilter)) state.projectFilter = 'All';
  const showProjectFilters = state.projectFilter === 'All';
  const projectButtons = projectFilters.map((project) => projectFilterButton(project, state.projectFilter, selectControlProject));
  elements['control-project-filters'].hidden = !showProjectFilters;
  elements['control-project-filters'].replaceChildren(...(showProjectFilters ? projectButtons : []));
  const scopedLedgers = projectFilters.find((project) => project.id === state.projectFilter)?.ledgers ?? [];
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
    list.addEventListener('scroll', () => rememberControlRoomColumnScroll(list), { passive: true });
    list.replaceChildren(...tasks.map((task, index) => taskRow(task, tab, index)));
    const empty = document.createElement('p');
    empty.className = 'control-column-empty';
    empty.hidden = tasks.length > 0;
    empty.textContent = controlRoomHydrating
      ? 'Synchronizing tasks…'
      : { queue: 'No waiting tasks', exec: 'No executing tasks', backlog: 'No backlog tasks' }[tab];
    if (controlRoomHydrating) {
      empty.setAttribute('role', 'status');
      empty.setAttribute('aria-live', 'polite');
    }
    list.append(empty);
    column.append(heading, list);
    return column;
  });
  elements['control-task-list'].replaceChildren(...columns);
  restoreControlRoomColumnScroll();
  elements['control-room-view'].setAttribute('aria-busy', String(controlRoomHydrating));
  initializeQueueSortable();
  elements['control-empty'].hidden = true;
  setView('control-room-view');
  document.title = 'Control room · Decision OS';
  const { anchor } = parseControlRoomRoute(location.href);
  if (anchor && initializedControlRoomColumns.size === 0) window.requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
}

function renderDone() {
  state.activeLedgerId = '';
  state.activeZoneId = '';
  renderLedgerLinks();
  const tasks = state.controlRoom?.done ?? [];
  const projectFilters = [{ id: 'All', name: 'All projects', color: '#20242b', projects: state.projects, projectIds: [] }, ...projectFilterGroups(state.projects)];
  if (!projectFilters.some((project) => project.id === state.doneProjectFilter)) state.doneProjectFilter = 'All';
  const showProjectFilters = state.doneProjectFilter === 'All';
  const selectedProject = projectFilters.find((project) => project.id === state.doneProjectFilter);
  const projectScopedTasks = filterCompletedTasks(tasks, { projectIds: selectedProject?.projectIds ?? [] });
  const labels = completedTaskLabels(projectScopedTasks);
  if (state.doneLabelFilter !== 'All' && !labels.includes(state.doneLabelFilter)) state.doneLabelFilter = 'All';
  const visibleTasks = filterCompletedTasks(tasks, {
    query: state.doneQuery,
    projectIds: selectedProject?.projectIds ?? [],
    label: state.doneLabelFilter,
    order: state.doneSort,
  });
  const projectButtons = projectFilters.map((project) => projectFilterButton(project, state.doneProjectFilter, (projectId) => {
    state.doneProjectFilter = projectId;
    state.doneLabelFilter = 'All';
    renderDone();
  }));
  const labelFilters = ['All', ...labels].map((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ledger-filter-chip';
    button.textContent = label === 'All' ? 'All labels' : label;
    button.setAttribute('aria-pressed', String(label === state.doneLabelFilter));
    button.addEventListener('click', () => {
      state.doneLabelFilter = label;
      renderDone();
    });
    return button;
  });
  if (!showProjectFilters) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'filter-clear-button';
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => {
      state.doneQuery = '';
      state.doneProjectFilter = 'All';
      state.doneLabelFilter = 'All';
      elements['done-search'].value = '';
      renderDone();
    });
    labelFilters.push(clear);
  }
  elements['done-project-filter-group'].hidden = !showProjectFilters;
  elements['done-project-filters'].replaceChildren(...(showProjectFilters ? projectButtons : []));
  elements['done-label-filter-group'].hidden = showProjectFilters;
  elements['done-label-filters'].replaceChildren(...(showProjectFilters ? [] : labelFilters));
  elements['done-task-list'].replaceChildren(...visibleTasks.map((task, index) => taskRow(task, 'done', index)));
  elements['done-summary'].textContent = `${visibleTasks.length} of ${tasks.length} completed ${tasks.length === 1 ? 'task' : 'tasks'}`;
  elements['done-empty'].hidden = visibleTasks.length > 0;
  elements['done-empty'].textContent = controlRoomHydrating
    ? 'Synchronizing completed tasks…'
    : tasks.length === 0 ? 'No completed tasks yet.' : 'No completed tasks match these filters.';
  elements['done-view'].setAttribute('aria-busy', String(controlRoomHydrating));
  setView('done-view');
  document.title = 'Done · Decision OS';
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

function applyTaskIntentLocally(task, intent) {
  if (!state.controlRoom || !task) return;
  const identity = taskIdentity(task);
  optimisticTaskIntents.set(identity, { ...intent, task: structuredClone(task), acknowledged: false });
  applyTaskIntentToProjection(state.controlRoom, identity, optimisticTaskIntents.get(identity));
  if (Array.isArray(state.controlRoom.queue)) state.controlRoom.queue.sort(compareControlRoomQueueTasks);
}

function acknowledgeTaskIntent(identity) {
  const intent = optimisticTaskIntents.get(identity);
  if (intent) intent.acknowledged = true;
}

function rejectTaskIntent(identity, error) {
  if (identity) optimisticTaskIntents.delete(identity);
  elements['mutation-error-message'].textContent = error instanceof Error ? error.message : 'The task change was rejected and confirmed state was restored.';
  elements['mutation-error'].hidden = false;
  void loadControlRoom({ force: true }).then(() => {
    if (location.pathname === '/done') renderDone();
    else if (location.pathname === '/') renderControlRoom();
  }).catch((cause) => console.error('Task mutation reconciliation failed.', cause ?? error));
}

document.querySelector('.mutation-error-retry').addEventListener('click', () => {
  elements['mutation-error'].hidden = true;
  void loadControlRoom({ force: true }).then(() => location.pathname === '/done' ? renderDone() : renderControlRoom()).catch((error) => {
    elements['mutation-error-message'].textContent = error instanceof Error ? error.message : 'Confirmed task state is still unavailable.';
    elements['mutation-error'].hidden = false;
  });
});

async function loadControlRoom({ force = false, deferDuringQueueDrag = false, owner = null } = {}) {
  const response = await fetch('/api/control-room', { cache: 'no-store', signal: owner?.signal, headers: !force && controlRoomEtag ? { 'if-none-match': controlRoomEtag } : {} });
  if (owner) requireRouteOwnership(owner);
  if (response.status === 304 && state.controlRoom) return false;
  if (!response.ok) throw new Error(`Could not load the Control Room (${response.status}).`);
  const nextControlRoom = await response.json();
  materializePendingExecutionIntents(pendingOptimisticExecutionDetails, optimisticExecutionIntents, nextControlRoom);
  for (const [identity, intent] of optimisticExecutionIntents) {
    const serverTask = (nextControlRoom.allTasks ?? []).find((task) => taskIdentity(task) === identity);
    // WHAT: Retire optimism only after the same request reaches a non-stale authoritative revision.
    // WHY: An unrelated execution receipt must not erase this request-owned preparing projection.
    if (optimisticExecutionConfirmed(intent, serverTask)) {
      optimisticExecutionIntents.delete(identity);
      continue;
    }
    // Keep the request-owned preparing projection until the exact request revision is visible.
    applyOptimisticExecutionIntent(nextControlRoom, { ...intent, task: { ...(serverTask ?? intent.task), ...intent.task } });
  }
  for (const [identity, intent] of optimisticTaskIntents) {
    const serverTask = (nextControlRoom.allTasks ?? []).find((task) => taskIdentity(task) === identity);
    if (taskIntentConfirmed(intent, serverTask)) {
      optimisticTaskIntents.delete(identity);
      continue;
    }
    applyTaskIntentToProjection(nextControlRoom, identity, { ...intent, task: serverTask ?? intent.task });
  }
  if (Array.isArray(nextControlRoom.queue)) nextControlRoom.queue.sort(compareControlRoomQueueTasks);
  if (owner) requireRouteOwnership(owner);
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
    if (await loadControlRoom({ deferDuringQueueDrag: true })) {
      if (location.pathname === '/done') renderDone();
      else renderControlRoom();
    }
  } catch (cause) {
    console.error('Control Room refresh failed.', cause);
  }
}

async function flushPendingControlRoomRefresh() {
  if (!pendingControlRoomRefresh || queueRefreshBlocked()) return;
  pendingControlRoomRefresh = false;
  await refreshControlRoomFromEvent();
}

async function refreshMasterSubtaskExecutionState(masterCardId) {
  masterSubtaskExecutionController?.abort();
  const controller = new AbortController();
  masterSubtaskExecutionController = controller;
  const route = currentRouteSnapshot();
  const projectId = state.resourceProjectId;
  const result = await requestTaskExecutionState({
    projectId,
    replicaNodeId: route.replicaNodeId,
    ledgerId: 'tasks',
    cardId: masterCardId,
    signal: controller.signal,
  });
  if (controller.signal.aborted
    || masterSubtaskExecutionController !== controller
    || projectId !== state.resourceProjectId
    || String(state.activeCardId) !== masterCardId
    || elements['card-view'].dataset.masterTask !== 'true'
    || !sameRouteSnapshot(route, currentRouteSnapshot())) return;
  masterSubtaskExecutionController = null;
  if (!result.ok) {
    console.error(`Master subtask execution state failed: ${result.error}`);
    return;
  }
  applyMasterSubtaskExecutionState(elements['card-body'], result.value);
}

function subscribeControlRoomEvents() {
  if (controlRoomEventSource || typeof EventSource === 'undefined') return;
  controlRoomEventSource = new EventSource('/api/control-room-events');
  const refresh = () => {
    clearTimeout(controlRoomRefreshTimer);
    controlRoomRefreshTimer = window.setTimeout(() => {
      if (location.pathname !== '/' && location.pathname !== '/done') return;
      void refreshControlRoomFromEvent();
    }, 80);
  };
  const refreshActiveCard = (event) => {
    let payload = {};
    try { payload = JSON.parse(event.data || '{}'); } catch {}
    const route = currentRouteSnapshot();
    if (!contentEventOwnsCard(payload, route)) return;
    clearTimeout(activeCardRefreshTimer);
    activeCardRefreshTimer = window.setTimeout(() => {
      if (!sameRouteSnapshot(route, currentRouteSnapshot())) return;
      void loadRoute({ retainView: true });
    }, 80);
  };
  controlRoomEventSource.addEventListener('ledger-content-change', refresh);
  controlRoomEventSource.addEventListener('card-content-change', (event) => {
    refresh();
    refreshActiveCard(event);
  });
  controlRoomEventSource.addEventListener('codex-execution-change', (event) => {
    let payload = {};
    try { payload = JSON.parse(event.data || '{}'); } catch {}
    const identity = `${String(payload.projectId || '')}\0${String(payload.executionId || '')}`;
    const revision = Number(payload.revision || 0);
    if (identity !== '\0' && Number.isSafeInteger(revision) && revision > 0) {
      const current = controlRoomExecutionRevisions.get(identity) || 0;
      if (revision <= current) return;
      controlRoomExecutionRevisions.set(identity, revision);
    }
    if (payload.phase === 'deleted') controlRoomExecutionRevisions.delete(identity);
    const route = currentRouteSnapshot();
    if (String(payload.projectId || '') === String(route.projectId || '')
      && String(payload.taskId || '') === String(state.activeCardId || '')
      && elements['card-view'].dataset.masterTask === 'true') {
      void refreshMasterSubtaskExecutionState(String(payload.taskId))
        .catch((error) => console.error('Master subtask execution refresh failed.', error));
    }
    refresh();
  });
  controlRoomEventSource.addEventListener('project-sync-change', refresh);
  controlRoomEventSource.addEventListener('federation-replica-change', (event) => {
    refresh();
    let payload = {};
    try { payload = JSON.parse(event.data || '{}'); } catch {}
    if (federationEventOwnsCard(payload, currentRouteSnapshot())) void loadRoute({ retainView: true });
  });
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
  if (targetTab === 'queue') target.sort(compareControlRoomQueueTasks);
  const canonical = state.controlRoom.allTasks.find((candidate) => taskIdentity(candidate) === taskId);
  if (canonical) canonical.status = task.status;
  const lifecycleStatus = targetTab === 'backlog' ? 'backlog' : 'todo';
  optimisticTaskIntents.set(taskId, { kind: 'lifecycle', lifecycleStatus, task: structuredClone(task), acknowledged: false });
  renderControlRoom();
  try {
    await ledgerMutation(task.ledgerId, {
      action: 'transition-card-lifecycle',
      cardId: task.cardId,
      lifecycleStatus
    }, task.projectId, task.ownerNodeId);
    acknowledgeTaskIntent(taskId);
    void loadControlRoom({ force: true }).then(renderControlRoom).catch((error) => console.error('Task placement confirmation failed.', error));
  } catch (error) {
    optimisticTaskIntents.delete(taskId);
    await loadControlRoom({ force: true });
    renderControlRoom();
    console.error('Task placement persistence failed.', error);
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
  return labels.includes('master-task');
}

async function createTaskIntake(projectId, assignedNodeId, replicaNodeId = assignedNodeId) {
  setResourceProject(projectId);
  if (state.resourceProjectId !== projectId) throw new Error('The project is no longer available.');
  const ledgerRef = state.ledgers.find((entry) => entry.id === 'tasks');
  if (!ledgerRef) throw new Error('The canonical Tasks ledger is unavailable for this project.');
  const ledger = state.activeLedgerId === 'tasks' && state.ledger
    ? structuredClone(state.ledger)
    : { cards: [], annotations: [], relationships: [], threadFiles: {}, notes: {}, viewport: { x: 0, y: 0, scale: 1 } };
  state.ledger = ledger;
  state.activeLedgerId = ledgerRef.id;
  const rect = nextZoneRect();
  const projectColor = state.projects.find((project) => project.id === projectId)?.color || defaultAccent;
  const zone = { id: objectId('zone'), ...rect, color: projectColor, label: 'New task intake', comments: [] };
  const cardId = objectId('card');
  const timestamp = new Date().toISOString();
  const markdown = '## A. Intake\n\nDescribe the task in this thread, attach the required files, then launch Codex. Categorize the task, keep this mandatory new zone, rename this master task and zone, and create actionable subtask cards in this zone.\n';
  const assignment = { nodeId: assignedNodeId, changedAt: timestamp, revision: 1 };
  const card = { id: cardId, title: 'New task intake', cardType: 'note', domainId: ledgerRef.id, status: 'todo', createdAt: timestamp, assignment, labels: ['master-task'], x: rect.x + 60, y: rect.y + 60, w: 360, h: 240, comment: { what: markdown }, facts: [], fields: [] };
  ledger.annotations = [...(ledger.annotations ?? []), zone];
  ledger.cards = [...(ledger.cards ?? []), { ...card, replicationState: 'local-only', persistenceState: 'creating' }];
  ledger.threadFiles = { ...(ledger.threadFiles ?? {}), [`thread-${cardId}`]: `.decision-os/threads/tasks/thread-${cardId}.md` };
  ledger.notes = { ...(ledger.notes ?? {}), [`thread-${cardId}`]: [] };
  const optimisticTask = {
    projectId,
    projectName: state.projectName,
    projectColor,
    ownerNodeId: replicaNodeId,
    assignedNodeId,
    assignedNodeLabel: state.projects.flatMap((project) => project.replicas ?? []).find((replica) => replica.nodeId === assignedNodeId)?.nodeLabel || assignedNodeId,
    assignedNodeOnline: state.projects.flatMap((project) => project.replicas ?? []).find((replica) => replica.nodeId === assignedNodeId)?.online !== false,
    assignment,
    ledgerId: ledgerRef.id,
    ledgerTitle: ledgerRef.title,
    cardId,
    zoneId: zone.id,
    title: card.title,
    cardStatus: 'todo',
    status: 'task-waiting',
    labels: [],
    masterTask: true,
    subtasks: [],
    complete: 0,
    valid: true,
  };
  if (state.controlRoom) applyTaskIntentLocally(optimisticTask, { kind: 'lifecycle', lifecycleStatus: 'todo' });
  const optimisticIdentity = taskIdentity(optimisticTask);
  state.activeZoneId = zone.id;
  state.activeZoneColor = zone.color;
  state.activeCardId = cardId;
  syncMobileThreadContext({
    projectId,
    replicaNodeId,
    ledgerId: ledgerRef.id,
    ledger,
    ledgers: state.ledgers,
    onCodexStarted: activateMasterTask,
    onQuickVoiceSubmitted: navigateVoiceSubmission,
    localProjection: true
  });
  navigate(replicaAddress(cardPathForProject(projectId, ledgerRef.id, zone.id, cardId), replicaNodeId));
  void ledgerMutation(ledgerRef.id, { action: 'create-task-intake', assignedNodeId, annotation: zone, card }, projectId, replicaNodeId).then(() => {
    acknowledgeTaskIntent(optimisticIdentity);
    void loadControlRoom({ force: true }).catch((error) => console.error('Task intake confirmation failed.', error));
  }).catch((cause) => {
    optimisticTaskIntents.delete(optimisticIdentity);
    const localCard = state.ledger?.cards?.find((entry) => String(entry.id) === cardId);
    if (!localCard) return;
    localCard.persistenceState = 'failed';
    localCard.persistenceError = cause instanceof Error ? cause.message : 'Task creation failed.';
    if (state.activeCardId === cardId) renderCard(localCard);
    void loadControlRoom({ force: true }).catch((error) => console.error('Task intake rollback refresh failed.', error));
  });
}

function openNewTaskProjectModal() {
  const tabList = document.querySelector('.new-task-node-tabs');
  const list = document.querySelector('.new-task-project-list');
  const error = document.querySelector('.new-task-project-error');
  const cancel = document.querySelector('.new-task-project-cancel');
  const nodes = [...state.projects.reduce((groups, project) => {
    for (const replica of project.replicas ?? []) {
      const nodeId = replica.nodeId;
      const existing = groups.get(nodeId);
      const routedProject = { ...project, selectedAssignedNodeId: nodeId, replicaNodeId: nodeId };
      if (existing) existing.projects.push(routedProject);
      else groups.set(nodeId, {
        nodeId,
        label: replica.nodeLabel || nodeId,
        online: replica.online !== false,
        local: replica.local === true,
        projects: [routedProject],
      });
    }
    return groups;
  }, new Map()).values()];
  const defaultNode = nodes.find((node) => node.local) ?? nodes[0];
  let activeNode = defaultNode;
  let tabButtons = [];

  delete newTaskProjectModal.dataset.busy;
  cancel.disabled = false;
  error.hidden = true;
  error.textContent = '';

  const chooseProject = async (project, button) => {
    newTaskProjectModal.dataset.busy = 'true';
    tabButtons.forEach((tab) => { tab.disabled = true; });
    [...list.querySelectorAll('button')].forEach((option) => { option.disabled = true; });
    cancel.disabled = true;
    button.setAttribute('aria-busy', 'true');
    error.hidden = true;
    try {
      await createTaskIntake(project.id, project.selectedAssignedNodeId, project.replicaNodeId);
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
  };

  const renderProjects = () => {
    const projects = activeNode?.projects ?? [];
    list.replaceChildren(...projects.map((project, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'new-task-project-option';
      button.style.setProperty('--project-color', project.color);
      const label = document.createElement('span');
      label.className = 'terminal-button__label';
      label.textContent = project.name;
      button.append(label);
      if (index < 9) {
        button.append(shortcutKey(String(index + 1)));
        button.title = `Create a task in ${project.name} (${index + 1})`;
      }
      button.disabled = activeNode.online === false || Boolean(newTaskProjectModal.dataset.busy);
      button.addEventListener('click', () => void chooseProject(project, button));
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
    tab.append(shortcutKey('C'), label, presence);
    tab.title = 'Show projects from this node; press C for the next node';
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
  newTaskProjectModal.onkeydown = (event) => {
    if (event.repeat || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'c' && nodes.length > 1) {
      event.preventDefault();
      const next = (nodes.indexOf(activeNode) + 1) % nodes.length;
      selectNode(nodes[next], true);
      return;
    }
    if (!/^[1-9]$/.test(key)) return;
    const project = activeNode?.projects[Number(key) - 1];
    const option = list.querySelectorAll('.new-task-project-option')[Number(key) - 1];
    if (!project || !option || option.disabled) return;
    event.preventDefault();
    option.click();
  };
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
  const taskIds = taskFamilyCardIds(state.ledger);
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
    const cardAccent = responsiveCardAccent(card, state.activeZoneColor || defaultAccent, taskIds);
    button.style.setProperty('--zone-color', cardAccent);
    button.style.setProperty('--accent', cardAccent);
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

function cardFacts(card) {
  return Array.isArray(card?.facts)
    ? card.facts.filter((fact) => typeof fact === 'string').map((fact) => fact.trim()).filter(Boolean)
    : [];
}

function renderResponsiveCardFacts(card) {
  const facts = cardFacts(card);
  // WHAT: Omit the responsive facts list when the replicated card has no facts.
  // WHY: The title must remain directly adjacent to the card body until facts exist.
  if (facts.length === 0) return null;
  return renderLedgerCardFacts(facts, 'responsive-card-facts');
}

function renderCard(card) {
  state.activeCardId = asText(card.id);
  const cardAccent = responsiveCardAccent(card);
  elements['card-title'].textContent = asText(card.title).trim() || `Card ${card.id}`;
  const imageSizes = card.imageSizes && typeof card.imageSizes === 'object' ? card.imageSizes : {};
  const markdown = ledgerCardBody(card);
  const parsedTask = projectMasterTask({
    card,
    ledgerTitle: state.ledgers.find((entry) => entry.id === state.activeLedgerId)?.title ?? state.activeLedgerId,
    cards: state.ledger?.cards ?? [],
    relationships: state.ledger?.relationships ?? []
  });
  // WHAT: Select a disclosure identity only for the rendered master-task card branch.
  // WHY: Non-master cards must reconcile to the empty collapsed sentinel without owning disclosure state.
  const renderedMasterSubtaskIdentity = parsedTask.masterTask ? String(parsedTask.cardId || card.id) : '';
  expandedMasterSubtaskIdentity = reconcileMasterSubtaskDisclosureIdentity(
    expandedMasterSubtaskIdentity,
    renderedMasterSubtaskIdentity,
  );
  const parentMaster = parentMasterTask({
    cardId: card.id,
    cards: state.ledger?.cards ?? [],
    relationships: state.ledger?.relationships ?? []
  });
  elements['card-view'].dataset.masterTask = String(parsedTask.masterTask);
  const backButton = document.querySelector('.back-to-zone-button');
  const backIcon = document.createElement('span');
  backIcon.className = 'back-button__icon';
  backIcon.setAttribute('aria-hidden', 'true');
  backIcon.textContent = '←';
  const backLabel = document.createElement('span');
  backLabel.textContent = 'Back';
  backButton.replaceChildren(backIcon, backLabel);
  backButton.dataset.destination = parsedTask.masterTask ? 'control-room' : parentMaster ? 'parent-master-task' : 'zone';
  backButton.dataset.parentCardId = parentMaster ? String(parentMaster.id) : '';
  if (parsedTask.masterTask || parentMaster) {
    const key = shortcutKey('Esc');
    key.setAttribute('aria-hidden', 'true');
    backButton.append(key);
    backButton.setAttribute('aria-keyshortcuts', 'Escape');
    backButton.title = 'Back (Esc)';
  } else {
    backButton.removeAttribute('aria-keyshortcuts');
    backButton.removeAttribute('title');
  }
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
  const persistCardQuestionnaires = async (questionnaires) => {
    const previousQuestionnaires = card.questionnaires;
    card.questionnaires = questionnaires;
    try {
      state.ledger = await ledgerMutation(state.activeLedgerId, {
        action: 'patch-card',
        cardPatch: { id: card.id, questionnaires }
      });
      return true;
    } catch (cause) {
      card.questionnaires = previousQuestionnaires;
      elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Questionnaire update failed.';
      return false;
    }
  };
  const persistGitReviewNotes = async (gitReviewNotes) => {
    const previousGitReviewNotes = card.gitReviewNotes;
    card.gitReviewNotes = gitReviewNotes;
    try {
      state.ledger = await ledgerMutation(state.activeLedgerId, {
        action: 'patch-card',
        cardPatch: { id: card.id, gitReviewNotes }
      });
      return true;
    } catch (cause) {
      card.gitReviewNotes = previousGitReviewNotes;
      elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Git review note update failed.';
      return false;
    }
  };
  const content = renderLedgerCardMarkdown(markdown, {
    cardId: parsedTask.masterTask ? String(card.id) : undefined,
    questionnaireCardId: String(card.id),
    imageSizes,
    questionnaires: card.questionnaires,
    gitReviewNotes: card.gitReviewNotes,
    mediaSurface: parsedTask.masterTask ? 'detail' : 'thread',
    carouselDriver: 'external',
    onImageResize: parsedTask.masterTask ? persistCardImageResize : undefined,
    onQuestionnairesChange: persistCardQuestionnaires,
    onGitReviewNotesChange: persistGitReviewNotes
  });
  const facts = renderResponsiveCardFacts(card);
  const persistenceFailure = card.persistenceState === 'failed' ? document.createElement('section') : null;
  if (persistenceFailure) {
    persistenceFailure.className = 'task-persistence-error';
    persistenceFailure.setAttribute('role', 'alert');
    const message = document.createElement('p');
    message.textContent = String(card.persistenceError || 'Task creation was not saved.');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry saving task';
    retry.addEventListener('click', async () => {
      const annotation = (state.ledger?.annotations ?? []).find((entry) => String(entry.id) === String(state.activeZoneId));
      if (!annotation) return;
      retry.disabled = true;
      retry.textContent = 'Retrying…';
      card.persistenceState = 'creating';
      const persistedCard = structuredClone(card);
      delete persistedCard.persistenceState;
      delete persistedCard.persistenceError;
      delete persistedCard.replicationState;
      try {
        await ledgerMutation(state.activeLedgerId, {
          action: 'create-task-intake',
          assignedNodeId: String(card.assignment?.nodeId || ''),
          annotation,
          card: persistedCard,
        });
        const confirmed = state.ledger?.cards?.find((entry) => String(entry.id) === String(card.id));
        if (confirmed) renderCard(confirmed);
        void loadControlRoom({ force: true }).catch((error) => console.error('Task retry confirmation failed.', error));
      } catch (cause) {
        card.persistenceState = 'failed';
        card.persistenceError = cause instanceof Error ? cause.message : 'Task creation failed.';
        renderCard(card);
      }
    });
    persistenceFailure.append(message, retry);
  }
  // WHAT: Render master-task subtasks through the disclosure while retaining the established detail composition.
  // WHY: The responsive controller is the sole owner of route-local disclosure identity and existing task behavior.
  if (parsedTask.masterTask) {
    const visibleSubtasks = visibleMasterTaskSubtasks(parsedTask.subtasks);
    const overview = document.createElement('section');
    overview.className = 'task-overview';
    const status = document.createElement('p');
    status.className = 'task-status-line';
    status.innerHTML = '<strong></strong><span></span>';
    status.querySelector('strong').textContent = parsedTask.status.replace('task-', '');
    status.querySelector('span').textContent = `${visibleSubtasks.filter((subtask) => subtask.status === 'complete').length} of ${visibleSubtasks.length} complete`;
    const disclosure = renderMasterSubtaskDisclosure({
      document,
      cardIdentity: renderedMasterSubtaskIdentity,
      visibleSubtasks,
      expanded: expandedMasterSubtaskIdentity === renderedMasterSubtaskIdentity,
      onToggle: () => {
        expandedMasterSubtaskIdentity = toggleMasterSubtaskDisclosureIdentity(
          expandedMasterSubtaskIdentity,
          renderedMasterSubtaskIdentity,
        );
      },
      onNavigate: (subtask) => {
        const zone = ledgerZones().find((entry) => entry.cards.some((entryCard) => String(entryCard.id) === subtask.cardId));
        navigate(cardPath(state.activeLedgerId, zone?.id ?? 'ungrouped', subtask.cardId));
      },
    });
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
      const scope = responsiveLedgerScope();
      const task = taskForCurrentRoute();
      const identity = task ? taskIdentity(task) : '';
      if (task) applyTaskIntentLocally(task, { kind: 'lifecycle', lifecycleStatus: nextStatus });
      const committed = runResponsiveLedgerTransaction({
        scope,
        mutation: { action: 'transition-card-lifecycle', cardId: card.id, lifecycleStatus: nextStatus },
        apply: (ledger) => {
          const current = (ledger.cards ?? []).find((entry) => String(entry.id) === String(card.id));
          if (current) current.status = nextStatus;
        },
        onRejected: (cause) => {
          rejectTaskIntent(identity, cause);
          elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Master task status update failed.';
        },
      });
      navigate(controlRoomPath(nextStatus === 'backlog' ? 'backlog' : 'queue'), true);
      if (await committed) {
        if (identity) acknowledgeTaskIntent(identity);
        void loadControlRoom({ force: true }).then(renderControlRoom).catch((error) => console.error('Task lifecycle confirmation failed.', error));
      }
    });
    const completionActions = document.createElement('div');
    completionActions.className = 'master-task-completion-actions';
    const manualCompleteButton = document.createElement('button');
    manualCompleteButton.type = 'button';
    manualCompleteButton.className = 'complete-master-task-button complete-master-task-manually-button';
    manualCompleteButton.textContent = card.status === 'done' ? 'Master task complete' : 'Complete manually';
    manualCompleteButton.disabled = card.status === 'done';
    manualCompleteButton.addEventListener('click', async () => {
      manualCompleteButton.disabled = true;
      manualCompleteButton.textContent = 'Master task complete';
      const scope = responsiveLedgerScope();
      const task = taskForCurrentRoute();
      const identity = task ? taskIdentity(task) : '';
      const childIds = new Set((state.ledger.relationships ?? [])
        .filter((relationship) => String(relationship.from) === String(card.id) && relationship.label === 'subtask')
        .map((relationship) => String(relationship.to)));
      if (task) applyTaskIntentLocally(task, { kind: 'lifecycle', lifecycleStatus: 'done' });
      const committed = runResponsiveLedgerTransaction({
        scope,
        mutation: { action: 'complete-master-task', masterTaskId: card.id },
        apply: (ledger) => {
          for (const candidate of ledger.cards ?? []) {
            if (String(candidate.id) === String(card.id) || childIds.has(String(candidate.id))) candidate.status = 'done';
          }
        },
        onRejected: (cause) => {
          rejectTaskIntent(identity, cause);
          elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Master task completion failed.';
        },
      });
      navigate(completionReturnPath(), true);
      if (await committed) {
        if (identity) acknowledgeTaskIntent(identity);
        void loadControlRoom({ force: true }).then(() => location.pathname === '/done' ? renderDone() : renderControlRoom()).catch((error) => console.error('Task completion confirmation failed.', error));
      }
    });
    const pipelineCompleteButton = document.createElement('button');
    pipelineCompleteButton.type = 'button';
    pipelineCompleteButton.className = 'complete-master-task-button complete-master-task-pipeline-button';
    pipelineCompleteButton.textContent = 'Complete with pipeline';
    const syncPipelineCompleteButton = () => {
      const configured = Boolean(state.masterTaskCompletionPipelineId);
      pipelineCompleteButton.disabled = card.status === 'done' || !configured;
      pipelineCompleteButton.title = configured ? '' : 'Configure a master-task completion pipeline in Settings.';
    };
    syncPipelineCompleteButton();
    pipelineCompleteButton.addEventListener('click', async () => {
      const pipelineId = state.masterTaskCompletionPipelineId;
      if (!pipelineId) return;
      const requestId = createExecutionRequestId('pipeline');
      const executionDetail = {
        requestId,
        projectId: state.resourceProjectId,
        ledgerId: state.activeLedgerId,
        cardId: String(card.id),
        acceptedAt: new Date().toISOString(),
        kind: 'pipeline',
      };
      beginOptimisticExecution(executionDetail);
      pipelineCompleteButton.disabled = true;
      pipelineCompleteButton.textContent = 'Queueing pipeline…';
      try {
        const result = await requestCodexPipelineRun({ ledgerId: state.activeLedgerId, sourceCardId: String(card.id), pipelineId, requestId });
        if (!result.ok) throw new Error(result.error || 'Master-task completion pipeline admission failed.');
        const receipt = result.receipts?.[0] ?? {};
        acknowledgeOptimisticExecution({ ...executionDetail, clientRequestId: executionDetail.requestId, ...receipt });
        pipelineCompleteButton.textContent = 'Pipeline queued';
        navigate(controlRoomPath('exec'), true);
      } catch (cause) {
        rejectOptimisticExecution({ ...executionDetail, error: cause instanceof Error ? cause.message : String(cause) });
        pipelineCompleteButton.textContent = 'Complete with pipeline';
        syncPipelineCompleteButton();
        elements['error-message'].textContent = cause instanceof Error ? cause.message : 'Master-task completion pipeline admission failed.';
        setView('error-view');
      }
    });
    completionActions.append(manualCompleteButton, pipelineCompleteButton);
    if (!state.codexSettingsLoaded) {
      void requestCodexSettings().then(() => {
        if (state.activeCardId === String(card.id) && pipelineCompleteButton.isConnected) syncPipelineCompleteButton();
      }).catch((cause) => {
        pipelineCompleteButton.title = cause instanceof Error ? cause.message : 'Could not load the master-task completion pipeline setting.';
      });
    }
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-master-task-button';
    deleteButton.textContent = 'Delete master task';
    deleteButton.addEventListener('click', () => {
      openTaskCardDeletion({
        cardId: String(card.id),
        kind: 'master-task',
      });
    });
    completion.append(delayButton, completionActions, deleteButton);
    overview.append(status, disclosure, completion);
    // The relationship-backed task summary is the navigation surface for a master task.
    // Keep it ahead of the narrative so linked cards remain visible on long mobile cards.
    elements['card-body'].replaceChildren(...(facts ? [facts] : []), overview, ...(persistenceFailure ? [persistenceFailure] : []), content);
  } else {
    const subtaskActions = parentMaster ? document.createElement('section') : null;
    if (subtaskActions) {
      subtaskActions.className = 'subtask-actions';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-subtask-button';
      deleteButton.textContent = 'Delete subtask';
      deleteButton.addEventListener('click', () => {
        openTaskCardDeletion({
          cardId: String(card.id),
          kind: 'subtask',
          parentCardId: String(parentMaster.id),
        });
      });
      subtaskActions.append(deleteButton);
    }
    elements['card-body'].replaceChildren(
      ...(facts ? [facts] : []),
      ...(persistenceFailure ? [persistenceFailure] : []),
      content,
      ...(subtaskActions ? [subtaskActions] : []),
    );
  }
  initializeMobileCarousels(elements['card-body']);
  elements['card-view'].style.setProperty('--zone-color', cardAccent);
  elements['card-view'].style.setProperty('--accent', cardAccent);
  openCardDetail(card, cardAccent);
  document.title = `${elements['card-title'].textContent} · ${state.projectName}`;
  if (parsedTask.masterTask) {
    subscribeControlRoomEvents();
    void refreshMasterSubtaskExecutionState(String(card.id))
      .catch((error) => console.error('Master subtask execution refresh failed.', error));
  }
}

function openTaskCardDeletion({ cardId, kind, parentCardId = '' }) {
  const subtask = kind === 'subtask';
  deleteMasterTaskModal.dataset.cardId = cardId;
  deleteMasterTaskModal.dataset.taskKind = subtask ? 'subtask' : 'master-task';
  deleteMasterTaskModal.dataset.parentCardId = subtask ? parentCardId : '';
  deleteTaskCardTitle.textContent = subtask ? 'Delete subtask?' : 'Delete master task?';
  deleteTaskCardMessage.textContent = subtask
    ? 'This permanently removes the subtask card and its link to the master task.'
    : 'This permanently removes the master task card. Its linked subtask cards are kept.';
  confirmDeleteTaskCardButton.textContent = subtask ? 'Delete subtask' : 'Delete master task';
  deleteMasterTaskModal.showModal();
}

document.querySelector('.cancel-delete-master-task-button').addEventListener('click', () => deleteMasterTaskModal.close());
document.querySelector('.confirm-delete-master-task-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const cardId = deleteMasterTaskModal.dataset.cardId;
  if (!cardId) return;
  const subtask = deleteMasterTaskModal.dataset.taskKind === 'subtask';
  const parentCardId = deleteMasterTaskModal.dataset.parentCardId;
  const idleLabel = subtask ? 'Delete subtask' : 'Delete master task';
  const deletionSourcePath = `${location.pathname}${location.search}${location.hash}`;
  button.disabled = true;
  button.textContent = subtask ? 'Deleting subtask…' : 'Deleting task…';
  const scope = responsiveLedgerScope();
  const task = taskForCurrentRoute();
  const identity = task ? taskIdentity(task) : '';
  if (task) applyTaskIntentLocally(task, { kind: 'delete' });
  const committed = runResponsiveLedgerTransaction({
    scope,
    mutation: { action: 'delete-card', cardId },
    apply: (ledger) => {
      ledger.cards = (ledger.cards ?? []).filter((entry) => String(entry.id) !== String(cardId));
      ledger.relationships = (ledger.relationships ?? []).filter((entry) => String(entry.from) !== String(cardId) && String(entry.to) !== String(cardId));
      if (ledger.notes && typeof ledger.notes === 'object') delete ledger.notes[`thread-${cardId}`];
      if (ledger.threadFiles && typeof ledger.threadFiles === 'object') delete ledger.threadFiles[`thread-${cardId}`];
    },
    onRejected: (cause) => {
      rejectTaskIntent(identity, cause);
      elements['error-message'].textContent = cause instanceof Error
        ? cause.message
        : subtask ? 'Subtask deletion failed.' : 'Master task deletion failed.';
      if (subtask && [cardId, parentCardId].includes(String(state.activeCardId))) {
        navigate(deletionSourcePath);
      }
    },
  });
  deleteMasterTaskModal.close();
  if (subtask && parentCardId) {
    document.querySelector('.back-to-zone-button').click();
  } else {
    navigate(controlRoomPath(state.controlTab), true);
  }
  try {
    if (await committed) {
      if (identity) acknowledgeTaskIntent(identity);
      void loadControlRoom({ force: true }).then(() => {
        if (!subtask) renderControlRoom();
      }).catch((error) => console.error('Task deletion confirmation failed.', error));
    }
  } finally {
    button.disabled = false;
    button.textContent = idleLabel;
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

async function loadLedger(ledgerId, owner) {
  const response = await projectFetch(`/api/ledgers/${encodeURIComponent(ledgerId)}/navigation`, { cache: 'no-store', signal: owner.signal }, owner.route.projectId, owner.route.replicaNodeId);
  requireRouteOwnership(owner);
  if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
  const ledger = await response.json();
  requireRouteOwnership(owner);
  if (!ledger || !Array.isArray(ledger.cards)) throw new Error('The ledger response does not contain a card list.');
  state.activeLedgerId = ledgerId;
  activeResponsiveTaskClock = taskClockFromResponse(response);
  const ledgerScope = responsiveLedgerScope({ projectId: owner.route.projectId, replicaNodeId: owner.route.replicaNodeId, ledgerId });
  state.ledger = responsiveLedgerTransactions.reconcile(responsiveLedgerScopeKey(ledgerScope), ledger);
  renderLedgerLinks();
  syncMobileThreadContext({
    projectId: state.resourceProjectId,
    replicaNodeId: owner.route.replicaNodeId,
    ledgerId,
    ledger: state.ledger,
    ledgers: state.ledgers,
    onCodexStarted: activateMasterTask,
    onQuickVoiceSubmitted: navigateVoiceSubmission,
    taskClock: activeResponsiveTaskClock
  });
}

async function loadRoute({ retainView = false } = {}) {
  const owner = beginRouteLoad();
  if (!retainView) setView('loading-view');
  window.clearTimeout(replicaRetryTimer);
  try {
    const catalogResponse = await fetch('/decision-os/projects', { cache: 'no-store', signal: owner.signal });
    requireRouteOwnership(owner);
    if (!catalogResponse.ok) throw new Error(`The project catalog returned HTTP ${catalogResponse.status}.`);
    const catalog = await catalogResponse.json();
    requireRouteOwnership(owner);
    state.projects = Array.isArray(catalog.projects) ? catalog.projects : [];
    document.documentElement.style.setProperty('--accent', defaultAccent);
    document.documentElement.style.setProperty('--accent-strong', defaultAccent);
    setMobileCodexContext({ projects: state.projects });
    const projectRoute = parseProjectRoute(owner.route.pathname);
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
    if (owner.route.pathname === '/done') {
      state.resourceProjectId = '';
      setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
      state.projectName = 'Decision OS';
      elements['project-name'].textContent = 'Decision OS';
      controlRoomHydrating = true;
      controlRoomHydrationGeneration = owner.generation;
      renderDone();
      try {
        await loadControlRoom({ owner });
      } finally {
        if (controlRoomHydrationGeneration === owner.generation) controlRoomHydrating = false;
      }
      requireRouteOwnership(owner);
      renderDone();
      subscribeControlRoomEvents();
      return;
    }
    if (!state.projects.length) {
      state.ledgers = [];
      renderLedgerLinks();
      setView('empty-view');
      return;
    }
    if (owner.route.pathname === '/') {
      state.resourceProjectId = '';
      setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
      state.projectName = 'Decision OS';
      elements['project-name'].textContent = 'Decision OS';
      const route = parseControlRoomRoute(location.href);
      state.controlTab = route.tab;
      const canonicalPath = controlRoomPath(route.tab, route.anchor);
      if (`${location.pathname}${location.search}${location.hash}` !== canonicalPath) history.replaceState({}, '', canonicalPath);
      controlRoomHydrating = true;
      controlRoomHydrationGeneration = owner.generation;
      renderControlRoom();
      try {
        await loadControlRoom({ owner });
      } finally {
        if (controlRoomHydrationGeneration === owner.generation) controlRoomHydrating = false;
      }
      requireRouteOwnership(owner);
      renderControlRoom();
      subscribeControlRoomEvents();
      return;
    }
    if (owner.route.pathname === '/ledgers') {
      renderGlobalLedgers();
      return;
    }
    if (owner.route.pathname === '/settings') {
      renderSettings();
      return;
    }
    if (owner.route.pathname === '/status') {
      await renderRuntimeStatusRoute(owner);
      return;
    }
    if (owner.route.pathname === '/pipelines' || owner.route.pathname === '/skills' || owner.route.pathname.startsWith('/skills/')) {
      state.resourceProjectId = '';
      setMobileCodexContext({ projectId: '', ledgerId: '', cardId: '' });
      renderLedgerLinks();
      setView('empty-view');
      const skillRoute = owner.route.pathname === '/skills' || owner.route.pathname.startsWith('/skills/');
      await openMobileCodexLibrary(skillRoute ? 'skills' : 'pipelines');
      const query = new URLSearchParams(owner.route.search);
      const skillName = query.get('name')?.trim();
      if (owner.route.pathname === '/skills' && query.get('editor') === 'skill' && skillName) {
        // WHAT: Keep deep-link editor loading inside the active route waterfall.
        // WHY: The route owner must render a terminal failure instead of detaching a rejected modal load.
        history.replaceState(history.state, '', `/skills/${encodeURIComponent(skillName)}/edit`);
        await openMobileSkillRoute(skillName, 'edit');
      } else if (skillRoute && owner.route.pathname !== '/skills') {
        const segments = owner.route.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const mode = segments.at(-1) === 'edit' ? 'edit' : segments[1] === 'new' ? 'new' : 'view';
        const routedSkillName = mode === 'new' ? '' : segments[1];
        await openMobileSkillRoute(routedSkillName, mode);
      }
      return;
    }
    const scope = parseProjectScope(owner.route.pathname);
    if (!scope || scope.segments[0] !== 'ledgers') throw new Error('Route not found.');
    const routeProject = state.projects.find((project) => project.id === scope.projectId);
    if (!routeProject) throw new Error('Project not found.');
    if (state.resourceProjectId !== routeProject.id) setResourceProject(routeProject.id);
    const response = await projectFetch('/decision-os/state', { cache: 'no-store', signal: owner.signal }, owner.route.projectId);
    requireRouteOwnership(owner);
    if (response.status === 202) {
      const pending = await response.json();
      requireRouteOwnership(owner);
      renderTaskReplicaShell(taskForCurrentRoute(), pending.replica);
      replicaRetryTimer = window.setTimeout(() => void loadRoute({ retainView: true }), 500);
      return;
    }
    if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
    const project = await response.json();
    requireRouteOwnership(owner);
    state.projectName = state.projects.find((entry) => entry.id === state.resourceProjectId)?.name || project.projectName || state.projectName;
    state.ledgers = Array.isArray(project.ledgers) ? project.ledgers.filter((ledger) => ledger?.id && ledger?.title) : [];
    elements['project-name'].textContent = state.projectName;
    if (!state.ledgers.length) {
      renderLedgerLinks();
      setView('empty-view');
      return;
    }

    const { section, ledgerId: requestedLedger, zoneId: requestedZone, cardId: requestedCard } = owner.route;
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
    if (state.activeLedgerId !== ledgerId || !state.ledger) await loadLedger(ledgerId, owner);
    requireRouteOwnership(owner);
    const zones = ledgerZones();
    const zone = requestedZone ? zones.find((entry) => String(entry.id) === requestedZone) : null;
    if (requestedCard) {
      const localCard = state.ledger.cards?.find((entry) => String(entry.id) === requestedCard);
      const locallyOwned = localCard?.persistenceState === 'creating' || localCard?.persistenceState === 'failed';
      let card = locallyOwned ? localCard : null;
      if (!card) {
        const detailResponse = await projectFetch(`/api/ledgers/${encodeURIComponent(ledgerId)}/cards/${encodeURIComponent(requestedCard)}`, { cache: 'no-store', signal: owner.signal }, owner.route.projectId);
        requireRouteOwnership(owner);
        if (detailResponse.status === 202) {
          const pending = await detailResponse.json();
          requireRouteOwnership(owner);
          renderTaskReplicaShell(taskForCurrentRoute(), pending.replica);
          replicaRetryTimer = window.setTimeout(() => void loadRoute({ retainView: true }), 500);
          return;
        }
        card = detailResponse.ok ? await detailResponse.json() : null;
        requireRouteOwnership(owner);
      }
      if (card) {
        state.ledger.cards = upsertResponsiveRouteCard(state.ledger.cards, card);
        const cardZone = zone ?? zones.find((entry) => entry.cards.some((candidate) => String(candidate.id) === requestedCard));
        state.activeZoneId = asText(cardZone?.id ?? 'ungrouped');
        state.activeZoneColor = asText(cardZone?.color ?? '#9ba3ad');
        syncMobileThreadContext({
          projectId: state.resourceProjectId,
          replicaNodeId: owner.route.replicaNodeId,
          ledgerId,
          ledger: state.ledger,
          ledgers: state.ledgers,
          onCodexStarted: activateMasterTask,
          onQuickVoiceSubmitted: navigateVoiceSubmission,
          taskClock: activeResponsiveTaskClock
        });
        renderCard(card);
        const query = new URLSearchParams(owner.route.search);
        if (query.get('thread') === 'open') openMobileThread(card, responsiveCardAccent(card));
        if (query.get('editor') === 'markdown') {
          // WHAT: Keep deep-link card editor loading inside the active route waterfall.
          // WHY: Route cancellation and load errors belong to the route owner.
          await openLedgerCardEditor({
            projectId: owner.route.projectId,
            ledgerId,
            cardId: requestedCard,
            card,
            returnFocusTo: elements['card-title'],
            onSaved: (saved) => {
              const index = state.ledger?.cards?.findIndex((entry) => String(entry.id) === requestedCard) ?? -1;
              if (index >= 0) state.ledger.cards[index] = saved;
              if (state.activeCardId === requestedCard) renderCard(saved);
            },
            onClosed: () => removeEditorQuery('markdown'),
          });
        }
      }
      else if (zone) navigate(zonePath(ledgerId, zone.id), true);
      else navigate(ledgerPath(ledgerId), true);
    } else if (zone) {
      renderZone(zone);
    } else {
      state.activeCardId = '';
      setMobileCodexContext({ projectId: state.resourceProjectId, ledgerId: state.activeLedgerId, cardId: '' });
      state.activeZoneId = '';
      renderLedger();
    }
  } catch (error) {
    if (error?.name === 'AbortError' || !ownsRouteLoad(owner)) return;
    if (retainView) {
      const task = taskForCurrentRoute();
      if (task) {
        renderTaskReplicaShell(task, { status: 'blocked', message: error instanceof Error ? error.message : 'Task synchronization failed.' });
        replicaRetryTimer = window.setTimeout(() => void loadRoute({ retainView: true }), 1500);
        return;
      }
          if ((location.pathname === '/' || location.pathname === '/done') && state.controlRoom) {
            console.error('Task projection refresh failed.', error);
        return;
      }
    }
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
document.querySelector('.runtime-status-refresh').addEventListener('click', () => void loadRoute({ retainView: true }));
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
  const parentMasterDestination = event.currentTarget.dataset.destination === 'parent-master-task';
  if (parentMasterDestination) {
    const parentCardId = event.currentTarget.dataset.parentCardId;
    const zone = ledgerZones().find((entry) => entry.cards.some((card) => String(card.id) === parentCardId));
    const parentPath = cardPath(state.activeLedgerId, zone?.id ?? 'ungrouped', parentCardId);
    const recordedReturnPath = asText(history.state?.returnPath);
    const recordedReturn = recordedReturnPath ? new URL(recordedReturnPath, location.origin) : null;
    const parentDestination = new URL(parentPath, location.origin);
    if (recordedReturn && `${recordedReturn.pathname}${recordedReturn.search}${recordedReturn.hash}` === `${parentDestination.pathname}${parentDestination.search}${parentDestination.hash}`) {
      history.back();
      return;
    }
    navigate(parentPath, true, controlRoomPath('queue'));
    return;
  }
  const destination = controlRoomDestination ? completionReturnPath() : zonePath(state.activeLedgerId, state.activeZoneId);
  if (controlRoomDestination) {
    void navigateTaskBack(destination);
    return;
  }
  navigate(destination);
});
document.querySelector('.create-ledger-button').addEventListener('click', () => openCreationModal('ledger'));
document.querySelector('.create-project-button').addEventListener('click', () => openCreationModal('project'));
document.querySelector('.creation-directory-browse').addEventListener('click', () => void loadProjectDirectory('.'));
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
elements['done-search'].addEventListener('input', (event) => {
  state.doneQuery = event.target.value;
  renderDone();
});
elements['done-sort'].addEventListener('change', (event) => {
  state.doneSort = event.target.value === 'asc' ? 'asc' : 'desc';
  renderDone();
});
window.addEventListener('popstate', () => {
  if (!requestActiveLedgerCardEditorClose('back')) return;
  if (!requestSkillLibraryEditorClose('back')) return;
  if (closeCardDetail({ fromHistory: true })) {
    closeCodexRouteScreens();
    const retained = commitRouteView();
    void loadRoute({ retainView: retained });
  }
});
window.addEventListener('decision-os:codex-run-preparing', (event) => { beginOptimisticExecution(event.detail); });
window.addEventListener('decision-os:codex-run-handoff', (event) => { void navigateAcceptedProcess(event.detail); });
window.addEventListener('decision-os:codex-run-enqueued', (event) => {
  acknowledgeOptimisticExecution(event.detail);
  void navigateAcceptedProcess(event.detail);
});
window.addEventListener('decision-os:codex-run-rejected', (event) => { rejectOptimisticExecution(event.detail); });
window.addEventListener('scroll', persistControlRoomScrollAnchor, { passive: true });
window.addEventListener('keydown', async (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const desktopThreadDraftEscape = event.key === 'Escape'
    && window.matchMedia('(min-width: 760px)').matches
    && target?.closest('.thread-draft');
  if (isCardEditingKeyboardTarget(target) && !desktopThreadDraftEscape) return;
  const desktopControlRoom = location.pathname === '/'
    && !elements['control-room-view'].hidden
    && !newTaskProjectModal.open
    && window.matchMedia('(min-width: 760px)').matches
    && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (desktopControlRoom && !event.repeat && !event.shiftKey) {
    const key = event.key.toLowerCase();
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
// WHAT: Connect content events before the first route request settles.
// WHY: A directly opened card must observe Markdown written after its initial detail response.
subscribeControlRoomEvents();
window.setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('.task-stopwatch[data-execution-since]').forEach((stopwatch) => {
    const execution = executionPresentation({
      executionStatus: stopwatch.dataset.executionPhase,
      executionSince: stopwatch.dataset.executionSince
    }, now);
    stopwatch.textContent = execution.text;
    const taskMeta = stopwatch.closest('.control-task')?.querySelector('.task-meta[data-execution-since]');
    if (taskMeta) {
      taskMeta.textContent = `${taskMeta.dataset.executionPrefix || ''}${execution.elapsed} ${execution.phase}${taskMeta.dataset.executionSuffix || ''}`;
    }
  });
}, 1000);
void loadRoute();
