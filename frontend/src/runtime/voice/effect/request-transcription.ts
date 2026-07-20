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
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';

export type VoiceTranscriptionRequest = {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId?: string;
  threadId?: string;
  cardId?: string;
  launchMode?: VoiceLaunchMode;
  reviewContext?: Record<string, string>;
  onPersisted?: () => void;
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
  state.voice.transcriptionStatus = 'uploading voice';
  telemetry('request-transcription', { configured: true, model: 'gpt-4o-mini-transcribe', threadId, launchMode });
  renderVoiceStatus();
  const noteId = appendOptimisticThreadNote({ threadId, body: 'Voice note captured. Uploading audio...', status: 'uploading', source: 'voice' });
  try {
    await persistPendingVoiceUpload({
      noteId,
      projectId: voiceProjectId(options.projectId),
      replicaNodeId: voiceReplicaNodeId(options.replicaNodeId),
      threadId,
      ledgerId: options.ledgerId || currentLedgerStateId(),
      cardId: options.cardId ?? '',
      launchMode,
      reviewContext: options.reviewContext,
      audio,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    patchOptimisticThreadNote({ threadId, noteId, body: 'Voice recording could not be saved locally. Upload was not attempted.', status: 'capture failed', error: message });
    state.voice.transcriptionStatus = `voice save failed: ${message}`;
    telemetry('voice-upload-storage-failed', { noteId, threadId, error: message });
    renderVoiceStatus();
    return false;
  }
  patchOptimisticThreadNote({ threadId, noteId, localVoiceUploadId: noteId });
  if (launchMode !== 'send' && options.cardId) {
    void sendActiveLedgerMutation({
      action: 'create-execution-intent',
      cardId: options.cardId,
      executionIntent: { id: noteId, state: 'waiting', launchMode },
    });
  }
  telemetry('voice-upload-persisted', { noteId, threadId, size: audio.size, type: audio.type });
  options.onPersisted?.();
  return submitPendingVoiceUpload(noteId);
}
