/**
 * WHAT: Uploads one browser-preserved recording and reconciles its stable optimistic note.
 * WHY: Initial upload and retry must share acceptance, retention, cleanup, and transcription behavior.
 */
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { activeThreadContentScope, loadActiveThreadSlice } from '../../thread/effect/load-active-thread-slice.js';
import { patchOptimisticThreadNote } from '../../thread/effect/patch-optimistic-thread-note.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { deletePendingVoiceUpload, readPendingVoiceUpload } from './persist-pending-voice-upload.js';
import { applyVoiceServerNote, watchVoiceTranscription } from './reconcile-voice-transcription.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { uploadVoiceAudio } from './upload-voice-audio.js';

export async function submitPendingVoiceUpload(noteId: string): Promise<boolean> {
  const pending = await readPendingVoiceUpload(noteId);
  if (!pending) return false;
  patchOptimisticThreadNote({ threadId: pending.threadId, noteId, body: 'Voice note captured. Uploading audio...', status: 'uploading', error: '', localVoiceUploadId: noteId });
  state.voice.transcriptionStatus = 'uploading voice';
  renderVoiceStatus();
  const upload = await uploadVoiceAudio(pending.audio, {
    ledgerId: pending.ledgerId,
    threadId: pending.threadId,
    cardId: pending.cardId,
    noteId,
    launchMode: pending.launchMode ?? (pending.queueCodex ? 'run' : 'send')
  });
  if (!upload.ok || !upload.voiceFileRef) {
    patchOptimisticThreadNote({
      threadId: pending.threadId,
      noteId,
      body: upload.voiceFileRef ? 'Voice uploaded; server acceptance failed. Audio is saved locally.' : 'Voice upload failed before transcription. Audio is saved locally.',
      voiceFileRef: upload.voiceFileRef,
      status: 'upload failed',
      error: upload.error ?? '',
      localVoiceUploadId: noteId
    });
    state.voice.transcriptionStatus = `voice upload failed${upload.error ? `: ${upload.error}` : ''}`;
    telemetry('voice-upload-retained', { noteId, threadId: pending.threadId, status: upload.status ?? 0 });
    renderVoiceStatus();
    return false;
  }

  let localCopyDeleted = true;
  await deletePendingVoiceUpload(noteId).catch((error) => {
    localCopyDeleted = false;
    telemetry('voice-upload-cleanup-failed', { noteId, threadId: pending.threadId, error: error instanceof Error ? error.message : String(error) });
  });
  patchOptimisticThreadNote({ threadId: pending.threadId, noteId, localVoiceUploadId: localCopyDeleted ? '' : noteId });
  state.voice.voiceFileRef = upload.voiceFileRef;
  applyVoiceServerNote({
    ledgerId: pending.ledgerId || currentLedgerStateId(),
    threadId: pending.threadId,
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
  state.voice.transcriptionStatus = 'idle';
  const scope = activeThreadContentScope();
  if (scope && scope.threadId === pending.threadId) await loadActiveThreadSlice(scope);
  watchVoiceTranscription({ ledgerId: pending.ledgerId || currentLedgerStateId(), threadId: pending.threadId, noteId });
  telemetry('voice-upload-accepted', { noteId, threadId: pending.threadId });
  renderVoiceStatus();
  return true;
}
