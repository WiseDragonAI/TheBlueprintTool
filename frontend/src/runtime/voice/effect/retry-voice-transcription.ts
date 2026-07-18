/**
 * WHAT: Retries transcription for a preserved voice upload attached to a ledger note.
 * WHY: Failed provider work must be recoverable without discarding the recorded audio.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { transcribeUploadedVoiceAudio } from './transcribe-uploaded-voice-audio.js';
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { applyVoiceServerNote, watchVoiceTranscription } from './reconcile-voice-transcription.js';
import { patchOptimisticThreadNote } from '../../thread/effect/patch-optimistic-thread-note.js';
import { submitPendingVoiceUpload } from './submit-pending-voice-upload.js';
import { voiceProjectId, voiceReplicaNodeId } from '../helper/voice-project-id.js';

export async function retryVoiceTranscription(input: { noteId: string; voiceFileRef?: string; localVoiceUploadId?: string; threadId?: string }): Promise<void> {
  if (!input.noteId) return;
  if (input.localVoiceUploadId) {
    telemetry('retry-voice-upload', { threadId: input.threadId || state.threadId, noteId: input.noteId });
    await submitPendingVoiceUpload(input.localVoiceUploadId);
    return;
  }
  if (!input.voiceFileRef) return;
  const threadId = input.threadId || state.threadId;
  state.voice.transcriptionStatus = 'retrying transcription';
  renderVoiceStatus();
  patchOptimisticThreadNote({ threadId, noteId: input.noteId, voiceFileRef: input.voiceFileRef, status: 'queued', body: 'Voice uploaded.', error: '' });
  telemetry('retry-voice-transcription', { threadId, noteId: input.noteId });
  const ledgerId = currentLedgerStateId();
  const projectId = voiceProjectId();
  const replicaNodeId = voiceReplicaNodeId();
  const result = await transcribeUploadedVoiceAudio(input.voiceFileRef, threadId, input.noteId, ledgerId, projectId, replicaNodeId);
  const voiceFileRef = result.voiceFileRef || input.voiceFileRef;
  if (result.ok) applyVoiceServerNote({ ledgerId, threadId, noteId: input.noteId, note: {
    id: input.noteId,
    message: 'Voice uploaded.',
    voiceFileRef,
    status: result.lifecycleStatus || 'queued',
    revision: result.revision ?? 1,
    uploadReceivedAt: result.uploadReceivedAt ?? '',
    audioPersistedAt: result.audioPersistedAt ?? '',
    acceptedAt: result.acceptedAt ?? '',
    error: ''
  } });
  state.voice.voiceFileRef = voiceFileRef;
  state.voice.transcriptionStatus = 'idle';
  watchVoiceTranscription({ projectId, replicaNodeId, ledgerId, threadId, noteId: input.noteId });
  renderVoiceStatus();
}
