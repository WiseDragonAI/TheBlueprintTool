/**
 * WHAT: Drives the voice transcription lifecycle from captured audio to an optimistic ledger note.
 * WHY: Stop-recording needs one controller-side path for upload, transcription, failure, and retry state.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { uploadVoiceAudio } from './upload-voice-audio.js';
import { appendOptimisticThreadNote } from '../../thread/effect/append-optimistic-thread-note.js';
import { patchOptimisticThreadNote } from '../../thread/effect/patch-optimistic-thread-note.js';
import { activeThreadContentScope, loadActiveThreadSlice } from '../../thread/effect/load-active-thread-slice.js';
import { ledgerEndpointForTab } from '../../ledger/helper/ledger-endpoint-for-tab.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { applyVoiceServerNote, watchVoiceTranscription } from './reconcile-voice-transcription.js';

async function reconcileAcceptedVoiceNote(threadId: string, noteId: string): Promise<void> {
  const scope = activeThreadContentScope();
  if (scope && scope.threadId === threadId) {
    await loadActiveThreadSlice(scope);
    return;
  }
  const endpoint = ledgerEndpointForTab(String(state.activeTab ?? ''));
  if (!endpoint || !state.activeLedger) return;
  const response = await fetch(endpoint, { cache: 'no-store' }).catch(() => undefined);
  const ledger = response?.ok ? await response.json().catch(() => null) : null;
  const serverNote = ledger && normalizeLedgerNotes(ledger)[threadId]?.find((note) => String(note.id ?? '') === noteId);
  const localNote = normalizeLedgerNotes(state.activeLedger)[threadId]?.find((note) => String(note.id ?? '') === noteId);
  if (!serverNote || !localNote) return;
  Object.assign(localNote, serverNote, { optimistic: false });
  void import('../../thread/effect/render-thread-panel.js').then(({ renderThreadPanel }) => renderThreadPanel()).catch(() => undefined);
}

export type VoiceTranscriptionRequest = {
  ledgerId?: string;
  threadId?: string;
  cardId?: string;
  queueCodex?: boolean;
};

function requestOptions(input: VoiceTranscriptionRequest | string | undefined): VoiceTranscriptionRequest {
  return typeof input === 'string' ? { threadId: input } : input ?? {};
}

export async function requestTranscription(audio: Blob | null, input: VoiceTranscriptionRequest | string = {}): Promise<void> {
  const options = requestOptions(input);
  const threadId = options.threadId || state.threadId || 'conversation-ledger';
  if (!state.threadId) state.threadId = threadId;
  if (!audio || audio.size <= 0) {
    state.voice.transcriptionStatus = 'no audio captured';
    appendOptimisticThreadNote({ threadId, body: 'Voice recording produced no audio.', status: 'capture failed', error: 'No audio captured' });
    telemetry('request-transcription', { configured: false, reason: 'empty-audio', threadId });
    renderVoiceStatus();
    return;
  }
  state.voice.transcriptionStatus = 'uploading voice';
  telemetry('request-transcription', { configured: true, model: 'gpt-4o-mini-transcribe', threadId, queueCodex: Boolean(options.queueCodex) });
  renderVoiceStatus();
  const noteId = appendOptimisticThreadNote({ threadId, body: 'Voice note captured. Uploading audio...', status: 'uploading', source: 'voice' });
  const upload = await uploadVoiceAudio(audio, {
    ledgerId: options.ledgerId,
    threadId,
    cardId: options.cardId ?? '',
    noteId,
    queueCodex: options.queueCodex
  });
  if (!upload.ok) {
    patchOptimisticThreadNote({
      threadId,
      noteId,
      body: upload.voiceFileRef ? 'Voice uploaded; transcription unavailable.' : 'Voice upload failed before transcription.',
      voiceFileRef: upload.voiceFileRef,
      status: 'upload failed',
      error: upload.error ?? ''
    });
    state.voice.transcriptionStatus = `voice upload failed${upload.error ? `: ${upload.error}` : ''}`;
    if (upload.voiceFileRef) state.voice.voiceFileRef = upload.voiceFileRef;
    renderVoiceStatus();
    return;
  }
  if (!upload.voiceFileRef) {
    patchOptimisticThreadNote({ threadId, noteId, body: 'Voice upload failed before transcription.', status: 'upload failed', error: upload.error ?? '' });
    state.voice.transcriptionStatus = `voice upload failed${upload.error ? `: ${upload.error}` : ''}`;
    renderVoiceStatus();
    return;
  }
  state.voice.voiceFileRef = upload.voiceFileRef;
  state.voice.transcriptionStatus = 'transcribing';
  applyVoiceServerNote({
    ledgerId: options.ledgerId || currentLedgerStateId(),
    threadId,
    noteId,
    note: {
      id: noteId,
      message: 'Voice uploaded.',
      voiceFileRef: upload.voiceFileRef,
      status: upload.lifecycleStatus || 'queued',
      error: '',
      uploadReceivedAt: upload.uploadReceivedAt ?? '',
      audioPersistedAt: upload.audioPersistedAt ?? '',
      acceptedAt: upload.acceptedAt ?? '',
      providerStartedAt: upload.providerStartedAt ?? '',
      transcriptionStartedAt: upload.providerStartedAt ?? '',
      revision: upload.revision ?? 1
    }
  });
  // The server owns transcription after accepting the upload. Clear the recorder-level
  // busy state so another note can start while this note reports its own progress.
  state.voice.transcriptionStatus = 'idle';
  await reconcileAcceptedVoiceNote(threadId, noteId);
  watchVoiceTranscription({ ledgerId: options.ledgerId || currentLedgerStateId(), threadId, noteId });
  telemetry('render-voice-status', { status: state.voice.transcriptionStatus, durationMs: state.voice.durationMs });
  renderVoiceStatus();
}
