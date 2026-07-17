/**
 * WHAT: Requests provider transcription for an already preserved voice upload.
 * WHY: Upload and transcription are separate UI states and retry must reuse the same backend path.
 */
import { state } from '../../state.js';
import type { VoiceTranscriptionResult } from './upload-voice-audio.js';
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';

export async function transcribeUploadedVoiceAudio(voiceFileRef: string, threadId = state.threadId || '', noteId = '', ledgerId = currentLedgerStateId()): Promise<VoiceTranscriptionResult> {
  const response = await fetch(projectScopedRequestPath('/api/transcribe/retry'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-thread-id': threadId
    },
    body: JSON.stringify({ voiceFileRef, threadId, noteId, ledgerId })
  }).catch((error) => ({ ok: false, status: 0, json: async () => ({ body: { ok: false, uploaded: true, voiceFileRef, error: error instanceof Error ? error.message : String(error) } }) }));
  const payload = await response.json().catch(() => ({}));
  const body = payload.body && typeof payload.body === 'object' ? payload.body : payload;
  const result: VoiceTranscriptionResult = {
    ok: Boolean(response.ok && body.ok !== false),
    uploaded: Boolean(body.uploaded),
    configured: body.configured !== false,
    voiceFileRef: String(body.voiceFileRef ?? voiceFileRef),
    text: String(body.text ?? ''),
    error: body.error ? String(body.error) : undefined,
    status: response.status
  };
  if (body.noteId) result.noteId = String(body.noteId);
  if (Number.isFinite(Number(body.revision)) && Number(body.revision) > 0) result.revision = Number(body.revision);
  if (body.status) result.lifecycleStatus = String(body.status);
  if (body.uploadReceivedAt) result.uploadReceivedAt = String(body.uploadReceivedAt);
  if (body.audioPersistedAt) result.audioPersistedAt = String(body.audioPersistedAt);
  if (body.acceptedAt) result.acceptedAt = String(body.acceptedAt);
  return result;
}
