import { state as canvasState } from '/canvas-src/runtime/state.js';
import { selectThread } from '/canvas-src/runtime/thread/effect/select-thread.js';
import { renderThreadPanel } from '/canvas-src/runtime/thread/effect/render-thread-panel.js';
import { pinThreadFeedToLastMessage } from '/canvas-src/runtime/thread/effect/pin-thread-feed-to-last-message.js';
import { submitThreadDraft } from '/canvas-src/runtime/thread/effect/submit-thread-draft.js';
import { saveThreadDraft } from '/canvas-src/runtime/thread/effect/persist-thread-draft.js';
import { startVoiceRecording } from '/canvas-src/runtime/voice/controller/start-voice-recording.js';
import { stopVoiceRecording } from '/canvas-src/runtime/voice/controller/stop-voice-recording.js';
import { cancelVoiceRecording } from '/canvas-src/runtime/voice/controller/cancel-voice-recording.js';
import { retryVoiceTranscription } from '/canvas-src/runtime/voice/effect/retry-voice-transcription.js';
import { uploadThreadFileController } from '/canvas-src/runtime/thread/controller/upload-thread-file-controller.js';
import { pasteThreadImageController } from '/canvas-src/runtime/thread/controller/paste-thread-image-controller.js';
import { requestThreadCodexProcess } from '/canvas-src/runtime/codex/effect/request-thread-codex-process.js';
import { requestCardSkillRunContinue } from '/canvas-src/runtime/codex/effect/request-card-skill-run-continue.js';
import { requestCardSkillRunStatus } from '/canvas-src/runtime/codex/effect/request-card-skill-run-status.js';
import { bindThreadCodexRunLog } from '/canvas-src/runtime/codex/effect/bind-thread-codex-run-log.js';
import { cardCodexThreadRunId } from '/canvas-src/runtime/codex/helper/card-codex-thread-run-id.js';
import { syncThreadCodexRunControls } from '/canvas-src/runtime/thread/effect/sync-thread-codex-run-controls.js';
import { resumeExternallyStartedCardSkillRun } from '/canvas-src/runtime/codex/effect/poll-card-skill-run.js';

let currentCard = null;
let currentLedgerId = '';
let onLedgerRefresh = async () => null;
let onCodexStarted = async () => null;
let initialized = false;
let eventSource = null;

function updateLaunchReadiness() {
  const button = document.querySelector('.mobile-thread-inspector [data-action="process-thread-codex"]');
  if (!button) return;
  const notes = canvasState.activeLedger?.notes?.[canvasState.threadId] ?? [];
  const hasSavedInput = notes.some((note) => note?.role !== 'assistant' && (String(note?.message ?? '').trim() || note?.voiceFileRef));
  button.disabled = !hasSavedInput;
  button.title = hasSavedInput ? 'Launch Codex for this intake' : 'Add and save an intake message first';
}

function hydrateRunningThreadRun(runId, startedAt) {
  const threadId = String(canvasState.threadId || '');
  if (!threadId || !runId) return;
  canvasState.threadRunIdByThreadId ||= {};
  canvasState.threadRunSummaryByThreadId ||= {};
  const previous = canvasState.threadRunSummaryByThreadId[threadId] || {};
  canvasState.threadRunIdByThreadId[threadId] = runId;
  canvasState.threadRunSummaryByThreadId[threadId] = {
    ...previous,
    ok: true,
    runId,
    status: 'running',
    startedAt: String(startedAt || previous.startedAt || new Date().toISOString()),
    error: ''
  };
  syncThreadCodexRunControls({ threadId, running: true });
}

export function syncMobileThreadContext(input) {
  currentLedgerId = String(input.ledgerId ?? '');
  onLedgerRefresh = input.onLedgerRefresh ?? onLedgerRefresh;
  onCodexStarted = input.onCodexStarted ?? onCodexStarted;
  canvasState.canvasMode = 'ledger';
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
  canvasState.threadPinOnRender = true;
  renderThreadPanel();
  updateLaunchReadiness();
}

export function closeMobileThread() {
  if (canvasState.voice.recording) return;
  saveThreadDraft();
  canvasState.threadPanelOpen = false;
  document.querySelector('.thread-panel').hidden = true;
  document.querySelector('.mobile-thread-inspector').hidden = true;
}

async function refreshThreadLedger() {
  const ledger = await onLedgerRefresh(currentLedgerId);
  if (!ledger) return;
  canvasState.activeLedger = ledger;
  if (currentCard) currentCard = ledger.cards?.find((card) => String(card.id) === String(currentCard.id)) ?? currentCard;
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
  const existingRunId = cardCodexThreadRunId(currentCard);
  if (existingRunId) {
    bindThreadCodexRunLog({ ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId: existingRunId });
    const summary = await requestCardSkillRunStatus({ ledgerId: currentLedgerId, cardId: String(currentCard.id), runId: existingRunId });
    if (summary.active) return;
    if (!summary.ok) {
      button.disabled = false;
      return;
    }
    const continued = await requestCardSkillRunContinue({
      ledgerId: currentLedgerId,
      cardId: String(currentCard.id),
      runId: existingRunId,
      codexModel: button.dataset.codexModel,
      codexEffort: button.dataset.codexEffort
    });
    if (!continued.ok) {
      button.disabled = false;
      return;
    }
    const continuedAt = String(continued.run?.startedAt || new Date().toISOString());
    resumeExternallyStartedCardSkillRun({ ledgerId: currentLedgerId, cardId: String(currentCard.id), runId: existingRunId });
    hydrateRunningThreadRun(existingRunId, continuedAt);
    await onCodexStarted({
      ledgerId: currentLedgerId,
      cardId: String(currentCard.id),
      startedAt: continuedAt
    });
    await refreshThreadLedger();
    bindThreadCodexRunLog({ ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId: existingRunId });
    return;
  }
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
  if (runId) bindThreadCodexRunLog({ ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId });
  hydrateRunningThreadRun(runId, startedAt);
  await onCodexStarted({
    ledgerId: currentLedgerId,
    cardId: String(currentCard.id),
    startedAt
  });
  await refreshThreadLedger();
  if (runId) bindThreadCodexRunLog({ ledgerId: currentLedgerId, cardId: String(currentCard.id), threadId: canvasState.threadId, runId });
}

function subscribeEvents() {
  if (eventSource || typeof EventSource === 'undefined') return;
  eventSource = new EventSource('/api/ledger-content-events');
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
  subscribeEvents();
  document.querySelector('.thread-open-button').addEventListener('click', () => {
    if (currentCard) openMobileThread(currentCard, getComputedStyle(document.querySelector('#card-view')).getPropertyValue('--zone-color').trim());
  });
  document.querySelector('.thread-close-button').addEventListener('click', closeMobileThread);
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !button.closest('.mobile-thread-inspector, .mobile-confirm-modal')) return;
    const action = button.dataset.action;
    if (action === 'voice-toggle') {
      if (canvasState.voice.recording) await stopVoiceRecording({ queueCodex: event.shiftKey });
      else await startVoiceRecording();
    } else if (action === 'voice-cancel') cancelVoiceRecording();
    else if (action === 'voice-retry') await retryVoiceTranscription({ threadId: button.dataset.threadId, noteId: button.dataset.noteId, voiceFileRef: button.dataset.voiceFileRef });
    else if (action === 'thread-file-picker') button.closest('.terminal-composer')?.querySelector('.thread-file-input')?.click();
    else if (action === 'jump-thread-bottom') pinThreadFeedToLastMessage({ follow: true });
    else if (action === 'process-thread-codex') await startCodex(button);
    else if (action === 'confirm-delete-note') {
      const modal = document.querySelector('.confirm-modal');
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
    if (event.key === 'Escape') {
      if (canvasState.voice.recording) cancelVoiceRecording();
      else closeMobileThread();
    }
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
}
