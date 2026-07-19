/**
 * WHAT: Integrates the shared thread runtime into the responsive application inspector.
 * WHY: Notes, voice, uploads, Codex logs, and session controls must work at every width.
 */
import { state as canvasState } from '/src/runtime/state.js';
import { selectThread } from '/src/runtime/thread/effect/select-thread.js';
import { renderThreadPanel } from '/src/runtime/thread/effect/render-thread-panel.js';
import { pinThreadSurfaceToBottom } from '/src/runtime/thread/effect/pin-thread-feed-to-last-message.js';
import { syncThreadJumpButtonVisibility } from '/src/runtime/thread/effect/render-thread-jump-button.js';
import { submitThreadDraft } from '/src/runtime/thread/effect/submit-thread-draft.js';
import { saveThreadDraft } from '/src/runtime/thread/effect/persist-thread-draft.js';
import { focusThreadDraft } from '/src/runtime/thread/effect/focus-thread-draft.js';
import { startVoiceRecording } from '/src/runtime/voice/controller/start-voice-recording.js';
import { stopVoiceRecording } from '/src/runtime/voice/controller/stop-voice-recording.js';
import { cancelVoiceRecording } from '/src/runtime/voice/controller/cancel-voice-recording.js';
import { retryVoiceTranscription } from '/src/runtime/voice/effect/retry-voice-transcription.js';
import { uploadThreadFileController } from '/src/runtime/thread/controller/upload-thread-file-controller.js';
import { pasteThreadImageController } from '/src/runtime/thread/controller/paste-thread-image-controller.js';
import { requestThreadCodexProcess } from '/src/runtime/codex/effect/request-thread-codex-process.js';
import { requestCardSkillRunContinue } from '/src/runtime/codex/effect/request-card-skill-run-continue.js';
import { bindThreadCodexRunLog, unbindThreadCodexRunLog } from '/src/runtime/codex/effect/bind-thread-codex-run-log.js';
import { cardCodexThreadRunId } from '/src/runtime/codex/helper/card-codex-thread-run-id.js';
import { syncThreadCodexRunControls } from '/src/runtime/thread/effect/sync-thread-codex-run-controls.js';
import { stopThreadCodexRunController } from '/src/runtime/codex/controller/stop-thread-codex-run-controller.js';
import { confirmThreadCodexSessionDeletionController } from '/src/runtime/codex/controller/confirm-thread-codex-session-deletion-controller.js';
import { deleteThreadCodexSessionController } from '/src/runtime/codex/controller/delete-thread-codex-session-controller.js';
import { collapseMobileThreadComposer, expandMobileThreadComposer } from './thread-composer.js';
import { createMobileThreadSessionDeletionHandler, resetMobileThreadConfirmationModal } from './thread-session-deletion.js';
import { projectReplicaRequestPath, projectScopedRequestPath, replicaRequestInit } from '/src/runtime/project/helper/project-request-scope.js';
import { reconcileResponsiveThreadLedger } from './thread-ledger-reconciliation.js';
import { voiceRetryInput } from './thread-voice-retry.js';
import { bindDesktopVoiceActionPreview } from '/src/runtime/voice/effect/update-desktop-voice-action-preview.js';
import { hydrateThreadViewportState, saveThreadPanelScrollPositions } from '/src/runtime/thread/effect/persist-thread-scroll.js';
import { readPersistedState } from '/src/runtime/persistence/helper/read-persisted-state.js';

let currentCard = null;
let currentProjectId = '';
let currentReplicaNodeId = '';
let currentLedgerId = '';
let onLedgerRefresh = async () => null;
let onCodexStarted = async () => null;
let onQuickVoiceSubmitted = async () => null;
let initialized = false;
let eventSource = null;
let eventSourceUrl = '';
let quickVoiceCapture = false;
let threadRefreshGeneration = 0;
let threadPresentationGeneration = Number(document.body.dataset.threadPresentationGeneration || 0);

function bumpThreadPresentationGeneration() {
  threadPresentationGeneration += 1;
  document.body.dataset.threadPresentationGeneration = String(threadPresentationGeneration);
  window.dispatchEvent(new CustomEvent('decision-os:thread-presentation-change', { detail: { generation: threadPresentationGeneration } }));
}

const handleMobileThreadSessionDeletion = createMobileThreadSessionDeletionHandler({
  modal: () => document.querySelector('.confirm-modal'),
  ledgerId: () => currentLedgerId,
  cardId: () => String(currentCard?.id || ''),
  threadId: () => String(canvasState.threadId || ''),
  confirm: confirmThreadCodexSessionDeletionController,
  remove: (input) => deleteThreadCodexSessionController(input, {
    refresh: refreshThreadLedger,
    render: renderThreadPanel,
  }),
  successFocus: () => document.querySelector('.mobile-thread-inspector [data-action="process-thread-codex"]'),
});

function updateLaunchReadiness() {
  const button = document.querySelector('.mobile-thread-inspector [data-action="process-thread-codex"]');
  if (!button) return;
  const notes = canvasState.activeLedger?.notes?.[canvasState.threadId] ?? [];
  const hasSavedInput = notes.some((note) => note?.role !== 'assistant' && (String(note?.message ?? '').trim() || note?.voiceFileRef));
  button.disabled = !hasSavedInput;
  button.title = hasSavedInput ? 'Launch Codex for this intake' : 'Add and save an intake message first';
}

function hydrateThreadRun(runId, startedAt, status, queuePosition) {
  const threadId = String(canvasState.threadId || '');
  if (!threadId || !runId) return;
  canvasState.threadRunIdByThreadId ||= {};
  canvasState.threadRunSummaryByThreadId ||= {};
  const previous = canvasState.threadRunSummaryByThreadId[threadId] || {};
  canvasState.threadRunIdByThreadId[threadId] = runId;
  canvasState.threadRunSummaryByThreadId[threadId] = {
    ...previous,
    ok: true,
    active: status === 'running',
    runId,
    status,
    queuePosition: Number.isInteger(queuePosition) ? queuePosition : null,
    startedAt: String(startedAt || previous.startedAt || new Date().toISOString()),
    error: ''
  };
  syncThreadCodexRunControls({ threadId, status, queuePosition });
}

export function syncMobileThreadContext(input) {
  const contextChanged = currentProjectId !== String(input.projectId ?? '')
    || currentReplicaNodeId !== String(input.replicaNodeId ?? '')
    || currentLedgerId !== String(input.ledgerId ?? '');
  if (contextChanged) unsubscribeEvents();
  currentProjectId = String(input.projectId ?? '');
  currentReplicaNodeId = String(input.replicaNodeId ?? '');
  currentLedgerId = String(input.ledgerId ?? '');
  onLedgerRefresh = input.onLedgerRefresh ?? onLedgerRefresh;
  onCodexStarted = input.onCodexStarted ?? onCodexStarted;
  onQuickVoiceSubmitted = input.onQuickVoiceSubmitted ?? onQuickVoiceSubmitted;
  canvasState.canvasMode = 'ledger';
  canvasState.projectId = currentProjectId;
  canvasState.replicaNodeId = currentReplicaNodeId;
  canvasState.activeTab = currentLedgerId;
  canvasState.activeLedgerId = currentLedgerId;
  canvasState.activeLedger = input.ledger;
  canvasState.ledgers = input.ledgers;
  canvasState.ledgerTabs = input.ledgers;
  if (canvasState.ledgerReconciliation?.routeLedgerStateId !== currentLedgerId) {
    canvasState.ledgerReconciliation.routeLedgerStateId = currentLedgerId;
    canvasState.ledgerReconciliation.routeEpoch += 1;
    canvasState.ledgerReconciliation.lastAppliedServerRevision = -1;
    canvasState.ledgerReconciliation.lastAppliedSequence = 0;
  }
  if (canvasState.threadPanelOpen) subscribeEvents();
}

export function openMobileThread(card, zoneColor) {
  currentCard = card;
  const threadId = `thread-${card.id}`;
  const cardView = document.querySelector('#card-view');
  cardView.dataset.threadId = threadId;
  cardView.dataset.cardId = String(card.id);
  cardView.style.setProperty('--card-zone-color', zoneColor || 'var(--accent)');
  selectThread(threadId);
  canvasState.threadPanelOpen = true;
  document.body.classList.add('card-thread-open');
  bumpThreadPresentationGeneration();
  if (window.matchMedia?.('(max-width: 760px)').matches === true && history.state?.responsiveThreadLayer?.threadId !== threadId) {
    history.pushState({
      ...history.state,
      responsiveThreadLayer: {
        projectId: currentProjectId,
        replicaNodeId: currentReplicaNodeId,
        ledgerId: currentLedgerId,
        cardId: String(card.id),
        threadId
      }
    }, '', location.href);
  }
  subscribeEvents();
  renderThreadPanel();
  updateLaunchReadiness();
  void refreshThreadLedger();
}

export function closeMobileThread({ fromHistory = false, discardHistory = false } = {}) {
  if (canvasState.voice.recording) return false;
  saveThreadDraft();
  saveThreadPanelScrollPositions();
  const runId = currentCard ? cardCodexThreadRunId(currentCard) : '';
  if (currentLedgerId && currentCard && canvasState.threadId && runId) {
    unbindThreadCodexRunLog({
      projectId: currentProjectId,
      ledgerId: currentLedgerId,
      cardId: String(currentCard.id),
      threadId: canvasState.threadId,
      runId,
    });
  }
  canvasState.threadPanelOpen = false;
  threadRefreshGeneration += 1;
  unsubscribeEvents();
  document.body.classList.remove('card-thread-open');
  document.querySelector('.thread-panel').hidden = true;
  document.querySelector('.mobile-thread-inspector').hidden = true;
  bumpThreadPresentationGeneration();
  if (!fromHistory && window.matchMedia?.('(max-width: 760px)').matches === true && history.state?.responsiveThreadLayer) {
    if (discardHistory) {
      const nextState = { ...history.state };
      delete nextState.responsiveThreadLayer;
      history.replaceState(nextState, '', location.href);
    } else history.back();
  }
  return true;
}

export async function handleResponsiveThreadShortcut(event) {
  if (document.querySelector('#card-view')?.hidden !== false) return false;
  const key = event.key.toLowerCase();
  const desktop = window.matchMedia('(min-width: 760px)').matches;
  if (key === 'a') {
    event.preventDefault();
    if (canvasState.threadPanelOpen) focusThreadDraft();
    else if (currentCard) openMobileThread(currentCard, getComputedStyle(document.querySelector('#card-view')).getPropertyValue('--zone-color').trim());
    return true;
  }
  if (key === 'x') {
    event.preventDefault();
    if (!canvasState.threadPanelOpen && currentCard) openMobileThread(currentCard, getComputedStyle(document.querySelector('#card-view')).getPropertyValue('--zone-color').trim());
    if (canvasState.voice.recording) {
      const launchMode = event.ctrlKey ? 'pipeline' : event.shiftKey ? 'run' : 'send';
      if (launchMode === 'send') await stopVoiceRecording({ launchMode });
      else void stopVoiceRecording({
        launchMode,
        onPersisted: () => void finishQueuedVoiceSubmission(true),
      });
    }
    else void startVoiceRecording();
    return true;
  }
  if (key === 'escape' && canvasState.voice.recording) {
    event.preventDefault();
    cancelQuickVoiceComment();
    return true;
  }
  if (key === 'escape' && desktop && event.target instanceof HTMLElement && event.target.closest('.thread-draft')) {
    event.preventDefault();
    event.target.blur();
    return true;
  }
  if (key === 'escape' && desktop && currentCard?.labels?.includes('master-task')) {
    event.preventDefault();
    document.querySelector('.back-to-zone-button')?.click();
    return true;
  }
  if (key === 'escape' && canvasState.threadPanelOpen) {
    event.preventDefault();
    closeMobileThread();
    return true;
  }
  return false;
}

async function finishQueuedVoiceSubmission(submitted) {
  if (!submitted) return;
  await onQuickVoiceSubmitted();
}

async function startQuickVoiceComment() {
  if (!currentCard || canvasState.voice.recording) return;
  const button = document.querySelector('.quick-voice-comment-button');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  quickVoiceCapture = true;
  openMobileThread(currentCard, getComputedStyle(document.querySelector('#card-view')).getPropertyValue('--zone-color').trim());
  await startVoiceRecording();
  if (canvasState.voice.recording) return;
  quickVoiceCapture = false;
  button.disabled = false;
  button.removeAttribute('aria-busy');
}

function cancelQuickVoiceComment() {
  quickVoiceCapture = false;
  const button = document.querySelector('.quick-voice-comment-button');
  button.disabled = false;
  button.removeAttribute('aria-busy');
  cancelVoiceRecording();
}

function voiceLaunchMode(event) {
  return event.ctrlKey ? 'pipeline' : event.shiftKey ? 'run' : 'send';
}

async function stopQuickVoiceComment(launchMode = 'send') {
  const wasQuickVoiceCapture = quickVoiceCapture;
  const selectedLaunchMode = wasQuickVoiceCapture ? 'run' : launchMode;
  const submitted = await stopVoiceRecording({ launchMode: selectedLaunchMode });
  if (!wasQuickVoiceCapture && selectedLaunchMode === 'send') return;
  quickVoiceCapture = false;
  const button = document.querySelector('.quick-voice-comment-button');
  button.disabled = false;
  button.removeAttribute('aria-busy');
  await finishQueuedVoiceSubmission(submitted);
}

async function refreshThreadLedger(optimisticRunId = '') {
  const owner = Object.freeze({
    generation: ++threadRefreshGeneration,
    projectId: currentProjectId,
    replicaNodeId: currentReplicaNodeId,
    ledgerId: currentLedgerId,
    cardId: String(currentCard?.id || ''),
    threadId: String(canvasState.threadId || ''),
    panelOpen: canvasState.threadPanelOpen,
  });
  const ownsRefresh = () => owner.generation === threadRefreshGeneration
    && owner.projectId === currentProjectId
    && owner.replicaNodeId === currentReplicaNodeId
    && owner.ledgerId === currentLedgerId
    && owner.cardId === String(currentCard?.id || '')
    && owner.threadId === String(canvasState.threadId || '')
    && owner.panelOpen === canvasState.threadPanelOpen;
  if (!owner.ledgerId || !owner.threadId || !owner.panelOpen) return;
  const response = await fetch(
    projectScopedRequestPath(`/api/ledgers/${encodeURIComponent(owner.ledgerId)}/threads/${encodeURIComponent(owner.threadId)}`, owner.projectId),
    replicaRequestInit({ cache: 'no-store' }, owner.replicaNodeId)
  );
  if (!ownsRefresh()) return;
  if (!response.ok) return;
  const slice = await response.json();
  if (!ownsRefresh()) return;
  const refreshed = await onLedgerRefresh(owner.ledgerId, owner.replicaNodeId);
  if (!ownsRefresh()) return;
  const reconciled = reconcileResponsiveThreadLedger({
    activeLedger: canvasState.activeLedger,
    refreshedLedger: refreshed,
    slice,
    currentCard,
    optimisticRunId,
  });
  if (!reconciled.ledger) return;
  canvasState.activeLedger = reconciled.ledger;
  currentCard = reconciled.card;
  renderThreadPanel();
  updateLaunchReadiness();
}

async function appendTextNote() {
  await submitThreadDraft();
  renderThreadPanel();
  updateLaunchReadiness();
}

async function deleteNote(button) {
  const threadId = button.dataset.threadId || canvasState.threadId;
  const noteId = button.dataset.noteId || '';
  if (!threadId || !noteId) return;
  const response = await fetch(`/decision-os/${encodeURIComponent(currentLedgerId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'delete-note', note: { threadId, id: noteId } })
  });
  if (response.ok) await refreshThreadLedger();
}

async function startCodex(button) {
  if (!currentCard || !currentLedgerId) return;
  updateLaunchReadiness();
  if (button.disabled) return;
  button.disabled = true;
  const existingRunId = String(button.dataset.codexRunId || cardCodexThreadRunId(currentCard)).trim();
  const result = existingRunId
    ? await requestCardSkillRunContinue({
      ledgerId: currentLedgerId,
      cardId: String(currentCard.id),
      runId: existingRunId,
      codexModel: button.dataset.codexModel,
      codexEffort: button.dataset.codexEffort
    })
    : await requestThreadCodexProcess({
      ledgerId: currentLedgerId,
      threadId: canvasState.threadId,
      cardId: String(currentCard.id),
      codexModel: button.dataset.codexModel,
      codexEffort: button.dataset.codexEffort
    });
  if (!result.ok) {
    button.disabled = false;
    return;
  }
  const runId = String(result.run?.id ?? existingRunId);
  const startedAt = String(result.run?.startedAt || new Date().toISOString());
  if (runId) {
    canvasState.threadSelectedRunIdByThreadId ||= {};
    canvasState.threadSelectedRunIdByThreadId[canvasState.threadId] = runId;
  }
  if (runId) bindThreadCodexRunLog({ projectId: currentProjectId, ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId });
  const status = String(result.run?.status || 'running');
  hydrateThreadRun(runId, startedAt, status, result.queuePosition);
  await onCodexStarted({
    ledgerId: currentLedgerId,
    cardId: String(currentCard.id),
    startedAt
  });
  await refreshThreadLedger(runId);
  if (runId) bindThreadCodexRunLog({ projectId: currentProjectId, ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId });
}

function subscribeEvents() {
  if (typeof EventSource === 'undefined') return;
  const url = projectReplicaRequestPath('/api/ledger-content-events', currentProjectId, currentReplicaNodeId);
  if (eventSource && eventSourceUrl === url) return;
  eventSource?.close();
  eventSourceUrl = url;
  eventSource = new EventSource(url);
  const refresh = (event) => {
    let payload = {};
    try { payload = JSON.parse(event.data || '{}'); } catch {}
    if (!canvasState.threadPanelOpen) return;
    if (String(payload.projectId ?? currentProjectId) !== currentProjectId) return;
    if (String(payload.ledgerId ?? '') !== currentLedgerId) return;
    if (!payload.threadId || String(payload.threadId) !== String(canvasState.threadId)) return;
    void refreshThreadLedger();
  };
  eventSource.addEventListener('ledger-content-change', refresh);
}

function unsubscribeEvents() {
  eventSource?.close();
  eventSource = null;
  eventSourceUrl = '';
}

export function initializeMobileThread() {
  if (initialized) return;
  initialized = true;
  bindDesktopVoiceActionPreview();
  hydrateThreadViewportState(readPersistedState());
  document.querySelector('.thread-open-button').addEventListener('click', () => {
    if (currentCard) openMobileThread(currentCard, getComputedStyle(document.querySelector('#card-view')).getPropertyValue('--zone-color').trim());
  });
  document.querySelector('.quick-voice-comment-button').addEventListener('click', () => void startQuickVoiceComment());
  document.querySelector('.thread-close-button').addEventListener('click', closeMobileThread);
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !button.closest('.mobile-thread-inspector, .mobile-confirm-modal')) return;
    const action = button.dataset.action;
    if (await handleMobileThreadSessionDeletion({ action, button })) return;
    if (action === 'voice-toggle') {
      if (canvasState.voice.recording) await stopQuickVoiceComment(voiceLaunchMode(event));
      else await startVoiceRecording();
    } else if (action === 'voice-cancel') cancelQuickVoiceComment();
    else if (action === 'voice-stop') await stopQuickVoiceComment(button.dataset.launchMode || 'send');
    else if (action === 'voice-retry') await retryVoiceTranscription(voiceRetryInput(button));
    else if (action === 'thread-file-picker') button.closest('.terminal-composer')?.querySelector('.thread-file-input')?.click();
    else if (action === 'toggle-thread-text') expandMobileThreadComposer(button);
    else if (action === 'close-thread-text') {
      if (collapseMobileThreadComposer(button)) syncThreadJumpButtonVisibility();
    }
    else if (action === 'submit-thread-draft') await appendTextNote();
    else if (action === 'jump-thread-bottom') {
      const surface = canvasState.threadActiveTabByThreadId?.[String(canvasState.threadId || '')] === 'codex-log' ? 'codex-log' : 'thread';
      pinThreadSurfaceToBottom(surface, { follow: true });
    }
    else if (action === 'process-thread-codex') await startCodex(button);
    else if (action === 'stop-thread-codex') await stopThreadCodexRunController({
      button,
      ledgerId: currentLedgerId,
      cardId: button.dataset.codexCardId || String(currentCard?.id || ''),
      runId: button.dataset.codexRunId || '',
    });
    else if (action === 'confirm-delete-note') {
      const modal = document.querySelector('.confirm-modal');
      resetMobileThreadConfirmationModal(modal);
      modal.dataset.threadId = button.dataset.threadId;
      modal.dataset.noteId = button.dataset.noteId;
      modal.showModal();
    } else if (action === 'delete-note') {
      await deleteNote(document.querySelector('.confirm-modal'));
      document.querySelector('.confirm-modal').close();
    } else if (action === 'cancel-delete') document.querySelector('.confirm-modal').close();
  });
  document.addEventListener('keydown', async (event) => {
    if (document.querySelector('.thread-panel')?.hidden !== false) return;
    if (event.key === 'Enter' && event.ctrlKey && event.target.closest('.thread-draft')) {
      event.preventDefault();
      await appendTextNote();
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.closest('.thread-draft')) saveThreadDraft();
  });
  document.addEventListener('change', async (event) => {
    if (event.target.matches('.thread-file-input')) {
      await uploadThreadFileController(event.target);
      renderThreadPanel();
      updateLaunchReadiness();
    }
  });
  document.addEventListener('paste', (event) => void pasteThreadImageController(event));
}

export function setMobileThreadCard(card) {
  currentCard = card;
  const labels = Array.isArray(card?.labels) ? card.labels.map(String) : [];
  document.querySelector('.quick-voice-comment-button').hidden = !labels.some((label) => label === 'master-task' || label === 'subtask');
}
