/**
 * WHAT: Integrates the shared thread runtime into the responsive application inspector.
 * WHY: Notes, voice, uploads, Codex logs, and session controls must work at every width.
 */
import { state as canvasState } from '/src/runtime/state.js';
import { selectThread } from '/src/runtime/thread/effect/select-thread.js';
import { renderThreadPanel } from '/src/runtime/thread/effect/render-thread-panel.js';
import { pinThreadFeedToLastMessage } from '/src/runtime/thread/effect/pin-thread-feed-to-last-message.js';
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
import { bindThreadCodexRunLog, unbindThreadCodexRunLog } from '/src/runtime/codex/effect/bind-thread-codex-run-log.js';
import { cardCodexThreadRunId } from '/src/runtime/codex/helper/card-codex-thread-run-id.js';
import { syncThreadCodexRunControls } from '/src/runtime/thread/effect/sync-thread-codex-run-controls.js';
import { stopThreadCodexRunController } from '/src/runtime/codex/controller/stop-thread-codex-run-controller.js';
import { confirmThreadCodexSessionDeletionController } from '/src/runtime/codex/controller/confirm-thread-codex-session-deletion-controller.js';
import { deleteThreadCodexSessionController } from '/src/runtime/codex/controller/delete-thread-codex-session-controller.js';
import { collapseMobileThreadComposer, expandMobileThreadComposer } from './thread-composer.js';
import { createMobileThreadSessionDeletionHandler, resetMobileThreadConfirmationModal } from './thread-session-deletion.js';
import { projectScopedRequestPath } from '/src/runtime/project/helper/project-request-scope.js';

let currentCard = null;
let currentProjectId = '';
let currentLedgerId = '';
let onLedgerRefresh = async () => null;
let onCodexStarted = async () => null;
let onQuickVoiceSubmitted = async () => null;
let initialized = false;
let eventSource = null;
let eventSourceUrl = '';
let quickVoiceCapture = false;

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
  currentProjectId = String(input.projectId ?? '');
  currentLedgerId = String(input.ledgerId ?? '');
  onLedgerRefresh = input.onLedgerRefresh ?? onLedgerRefresh;
  onCodexStarted = input.onCodexStarted ?? onCodexStarted;
  onQuickVoiceSubmitted = input.onQuickVoiceSubmitted ?? onQuickVoiceSubmitted;
  canvasState.canvasMode = 'ledger';
  canvasState.activeTab = currentLedgerId;
  canvasState.activeLedgerId = currentLedgerId;
  canvasState.activeLedger = input.ledger;
  canvasState.ledgers = input.ledgers;
  canvasState.ledgerTabs = input.ledgers;
  subscribeEvents();
  if (canvasState.ledgerReconciliation?.routeLedgerStateId !== currentLedgerId) {
    canvasState.ledgerReconciliation.routeLedgerStateId = currentLedgerId;
    canvasState.ledgerReconciliation.routeEpoch += 1;
    canvasState.ledgerReconciliation.lastAppliedServerRevision = -1;
    canvasState.ledgerReconciliation.lastAppliedSequence = 0;
  }
  if (canvasState.threadPanelOpen) renderThreadPanel();
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
  canvasState.threadPinOnRender = true;
  renderThreadPanel();
  updateLaunchReadiness();
  void refreshThreadLedger();
}

export function closeMobileThread() {
  if (canvasState.voice.recording) return;
  saveThreadDraft();
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
  document.body.classList.remove('card-thread-open');
  document.querySelector('.thread-panel').hidden = true;
  document.querySelector('.mobile-thread-inspector').hidden = true;
}

export async function handleResponsiveThreadShortcut(event) {
  if (document.querySelector('#card-view')?.hidden !== false) return false;
  const key = event.key.toLowerCase();
  if (key === 'a') {
    event.preventDefault();
    if (canvasState.threadPanelOpen) focusThreadDraft();
    else if (currentCard) openMobileThread(currentCard, getComputedStyle(document.querySelector('#card-view')).getPropertyValue('--zone-color').trim());
    return true;
  }
  if (key === 'x') {
    event.preventDefault();
    if (!canvasState.threadPanelOpen && currentCard) openMobileThread(currentCard, getComputedStyle(document.querySelector('#card-view')).getPropertyValue('--zone-color').trim());
    if (canvasState.voice.recording) await stopVoiceRecording({ queueCodex: event.shiftKey });
    else void startVoiceRecording();
    return true;
  }
  if (key === 'escape' && canvasState.threadPanelOpen) {
    event.preventDefault();
    if (canvasState.voice.recording) cancelQuickVoiceComment();
    else closeMobileThread();
    return true;
  }
  return false;
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

async function stopQuickVoiceComment(event) {
  const submitted = await stopVoiceRecording({ queueCodex: quickVoiceCapture || event.shiftKey });
  if (!quickVoiceCapture) return;
  quickVoiceCapture = false;
  const button = document.querySelector('.quick-voice-comment-button');
  button.disabled = false;
  button.removeAttribute('aria-busy');
  if (!submitted) return;
  closeMobileThread();
  await onQuickVoiceSubmitted();
}

async function refreshThreadLedger() {
  const threadId = String(canvasState.threadId || '');
  if (!currentLedgerId || !threadId) return;
  const response = await fetch(projectScopedRequestPath(`/api/ledgers/${encodeURIComponent(currentLedgerId)}/threads/${encodeURIComponent(threadId)}`, currentProjectId), { cache: 'no-store' });
  if (!response.ok) return;
  const slice = await response.json();
  const ledger = canvasState.activeLedger;
  if (!ledger) return;
  ledger.threadFiles = { ...(ledger.threadFiles || {}), ...(slice.threadFiles || {}) };
  ledger.notes = { ...(ledger.notes || {}), ...(slice.notes || {}) };
  ledger.deletedNoteIds = { ...(ledger.deletedNoteIds || {}), ...(slice.deletedNoteIds || {}) };
  const refreshed = await onLedgerRefresh(currentLedgerId);
  if (refreshed?.cards && currentCard) currentCard = refreshed.cards.find((card) => String(card.id) === String(currentCard.id)) ?? currentCard;
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
  const result = await requestThreadCodexProcess({
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
  const runId = String(result.run?.id ?? '');
  const startedAt = String(result.run?.startedAt || new Date().toISOString());
  if (runId) bindThreadCodexRunLog({ projectId: currentProjectId, ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId });
  const status = String(result.run?.status || 'running');
  hydrateThreadRun(runId, startedAt, status, result.queuePosition);
  await onCodexStarted({
    ledgerId: currentLedgerId,
    cardId: String(currentCard.id),
    startedAt
  });
  await refreshThreadLedger();
  if (runId) bindThreadCodexRunLog({ projectId: currentProjectId, ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId });
}

function subscribeEvents() {
  if (typeof EventSource === 'undefined') return;
  const url = projectScopedRequestPath('/api/ledger-content-events', currentProjectId);
  if (eventSource && eventSourceUrl === url) return;
  eventSource?.close();
  eventSourceUrl = url;
  eventSource = new EventSource(url);
  const refresh = (event) => {
    let payload = {};
    try { payload = JSON.parse(event.data || '{}'); } catch {}
    if (String(payload.ledgerId ?? '') !== currentLedgerId) return;
    if (payload.threadId && String(payload.threadId) !== String(canvasState.threadId)) return;
    void refreshThreadLedger();
  };
  eventSource.addEventListener('ledger-content-change', refresh);
  eventSource.addEventListener('card-content-change', refresh);
}

export function initializeMobileThread() {
  if (initialized) return;
  initialized = true;
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
      if (canvasState.voice.recording) await stopQuickVoiceComment(event);
      else await startVoiceRecording();
    } else if (action === 'voice-cancel') cancelQuickVoiceComment();
    else if (action === 'voice-retry') await retryVoiceTranscription({ threadId: button.dataset.threadId, noteId: button.dataset.noteId, voiceFileRef: button.dataset.voiceFileRef });
    else if (action === 'thread-file-picker') button.closest('.terminal-composer')?.querySelector('.thread-file-input')?.click();
    else if (action === 'toggle-thread-text') expandMobileThreadComposer(button);
    else if (action === 'close-thread-text') {
      if (collapseMobileThreadComposer(button)) syncThreadJumpButtonVisibility();
    }
    else if (action === 'submit-thread-draft') await appendTextNote();
    else if (action === 'jump-thread-bottom') pinThreadFeedToLastMessage({ follow: true });
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
