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
import { voiceProjectId, voiceReplicaNodeId } from '../helper/voice-project-id.js';
import {
  acknowledgePendingTaskMutationReceipt,
  replacePendingTaskMutationReceipt,
} from '../../refresh/helper/pending-task-mutation-receipts.js';
import { acceptTaskClockForInstall } from '../../refresh/helper/task-causal-clock.js';

export async function submitPendingVoiceUpload(noteId: string): Promise<boolean> {
  const pending = await readPendingVoiceUpload(noteId);
  if (!pending) return false;
  patchOptimisticThreadNote({ threadId: pending.threadId, noteId, body: 'Voice note captured. Uploading audio...', status: 'uploading', error: '', localVoiceUploadId: noteId });
  state.voice.transcriptionStatus = 'uploading voice';
  renderVoiceStatus();
  const upload = await uploadVoiceAudio(pending.audio, {
    projectId: voiceProjectId(pending.projectId),
    replicaNodeId: voiceReplicaNodeId(pending.replicaNodeId),
    ledgerId: pending.ledgerId,
    threadId: pending.threadId,
    cardId: pending.cardId,
    noteId,
    mutationId: pending.mutationId,
    voiceAttemptId: pending.voiceAttemptId,
    reviewContext: pending.reviewContext,
    launchMode: pending.launchMode
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
  if (pending.ledgerId === 'tasks') {
    const receiptId = String(upload.receipt?.mutationId ?? '');
    if (receiptId !== pending.mutationId || !upload.taskClock) {
      patchOptimisticThreadNote({
        threadId: pending.threadId,
        noteId,
        body: 'Voice uploaded; exact task acceptance was not confirmed. Audio is saved locally.',
        voiceFileRef: upload.voiceFileRef,
        status: 'upload failed',
        error: 'voice_task_receipt_missing',
        localVoiceUploadId: noteId,
      });
      telemetry('voice-upload-retained', { noteId, threadId: pending.threadId, status: upload.status ?? 0, reason: 'receipt-missing' });
      return false;
    }
    replacePendingTaskMutationReceipt(pending.mutationId, {
      action: 'append-note',
      mutationId: pending.mutationId,
      note: {
        id: noteId,
        threadId: pending.threadId,
        body: 'Voice uploaded.',
        voiceFileRef: upload.voiceFileRef,
        voiceAttemptId: upload.voiceAttemptId || pending.voiceAttemptId,
        status: upload.lifecycleStatus || 'queued',
        uploadReceivedAt: upload.uploadReceivedAt ?? '',
        audioPersistedAt: upload.audioPersistedAt ?? '',
        acceptedAt: upload.acceptedAt ?? '',
        revision: upload.revision ?? 1,
        source: 'voice',
      },
    });
    acknowledgePendingTaskMutationReceipt(pending.mutationId, upload.taskClock);
    if (!acceptTaskClockForInstall(upload.taskClock, 'voice-upload-response')) {
      patchOptimisticThreadNote({
        threadId: pending.threadId,
        noteId,
        status: 'upload failed',
        error: 'voice_task_clock_not_admitted',
        localVoiceUploadId: noteId,
      });
      return false;
    }
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
      voiceAttemptId: upload.voiceAttemptId || pending.voiceAttemptId,
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
  watchVoiceTranscription({ projectId: voiceProjectId(pending.projectId), replicaNodeId: voiceReplicaNodeId(pending.replicaNodeId), ledgerId: pending.ledgerId || currentLedgerStateId(), threadId: pending.threadId, noteId });
  telemetry('voice-upload-accepted', { noteId, threadId: pending.threadId });
  renderVoiceStatus();
  return true;
}
