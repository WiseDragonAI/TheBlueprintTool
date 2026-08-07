/**
 * WHAT: Drives the voice transcription lifecycle from captured audio to an optimistic ledger note.
 * WHY: Stop-recording needs one controller-side path for upload, transcription, failure, and retry state.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { appendOptimisticThreadNote } from '../../thread/effect/append-optimistic-thread-note.js';
import { patchOptimisticThreadNote } from '../../thread/effect/patch-optimistic-thread-note.js';
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { persistPendingVoiceUpload } from './persist-pending-voice-upload.js';
import { submitPendingVoiceUpload } from './submit-pending-voice-upload.js';
import { voiceProjectId, voiceReplicaNodeId } from '../helper/voice-project-id.js';
import type { VoiceLaunchMode } from '../helper/voice-launch-mode.js';
import { beginPendingTaskMutationReceipt } from '../../refresh/helper/pending-task-mutation-receipts.js';

export type VoiceExecutionHandoff = {
  requestId: string;
  projectId: string;
  ledgerId: string;
  cardId: string;
  acceptedAt: string;
  kind: 'voice';
};

export type VoiceTranscriptionRequest = {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId?: string;
  threadId?: string;
  cardId?: string;
  launchMode?: VoiceLaunchMode;
  reviewContext?: Record<string, string>;
  onPersisted?: (detail: VoiceExecutionHandoff) => void;
};

function requestOptions(input: VoiceTranscriptionRequest | string | undefined): VoiceTranscriptionRequest {
  return typeof input === 'string' ? { threadId: input } : input ?? {};
}

export async function requestTranscription(audio: Blob | null, input: VoiceTranscriptionRequest | string = {}): Promise<boolean> {
  const options = requestOptions(input);
  const launchMode = options.launchMode ?? 'send';
  const threadId = options.threadId || state.threadId || 'conversation-ledger';
  if (!state.threadId) state.threadId = threadId;
  if (!audio || audio.size <= 0) {
    state.voice.transcriptionStatus = 'no audio captured';
    appendOptimisticThreadNote({ threadId, body: 'Voice recording produced no audio.', status: 'capture failed', error: 'No audio captured' });
    telemetry('request-transcription', { configured: false, reason: 'empty-audio', threadId });
    renderVoiceStatus();
    return false;
  }
  const noteId = `note-${Date.now()}-${crypto.randomUUID()}`;
  const mutationId = crypto.randomUUID();
  const voiceAttemptId = `voice-attempt-${crypto.randomUUID()}`;
  const projectId = voiceProjectId(options.projectId);
  const ledgerId = options.ledgerId || currentLedgerStateId();
  const cardId = options.cardId ?? '';
  const acceptedAt = new Date().toISOString();
  try {
    await persistPendingVoiceUpload({
      noteId,
      mutationId,
      voiceAttemptId,
      projectId,
      replicaNodeId: voiceReplicaNodeId(options.replicaNodeId),
      threadId,
      ledgerId,
      cardId,
      launchMode,
      reviewContext: options.reviewContext,
      audio,
      createdAt: acceptedAt
    });
    if (ledgerId === 'tasks') {
      beginPendingTaskMutationReceipt({
        mutationId,
        entityId: `${threadId}/${noteId}`,
        projectId,
        ledgerId,
        domain: 'voice',
        mutation: {
          action: 'append-note',
          mutationId,
          note: {
            id: noteId,
            threadId,
            body: 'Voice note captured. Upload pending.',
            source: 'voice',
            status: 'uploading',
            voiceAttemptId,
            revision: 0,
          },
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.voice.transcriptionStatus = `voice save failed: ${message}`;
    telemetry('voice-upload-storage-failed', { noteId, threadId, error: message });
    renderVoiceStatus();
    return false;
  }
  // WHAT: Expose the optimistic voice row only after audio and task intent are durable.
  // WHY: Reload at any later point must reconstruct both the note and its captured bytes.
  appendOptimisticThreadNote({
    noteId,
    createdAt: acceptedAt,
    threadId,
    body: 'Voice note captured. Uploading audio...',
    status: 'uploading',
    source: 'voice',
  });
  state.voice.transcriptionStatus = 'uploading voice';
  telemetry('request-transcription', { configured: true, model: 'gpt-4o-mini-transcribe', threadId, launchMode });
  renderVoiceStatus();
  patchOptimisticThreadNote({ threadId, noteId, localVoiceUploadId: noteId });
  const optimistic = state.activeLedger?.notes?.[threadId]?.find((candidate: Record<string, unknown>) => String(candidate.id ?? '') === noteId);
  if (optimistic) optimistic.mutationReceiptId = mutationId;
  telemetry('voice-upload-persisted', { noteId, threadId, size: audio.size, type: audio.type });
  options.onPersisted?.({
    requestId: `voice:${noteId}`,
    projectId,
    ledgerId,
    cardId,
    acceptedAt,
    kind: 'voice',
  });
  return submitPendingVoiceUpload(noteId);
}
