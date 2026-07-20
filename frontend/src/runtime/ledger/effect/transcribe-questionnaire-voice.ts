/**
 * WHAT: Persists and transcribes question-owned audio without creating a thread note.
 * WHY: Operator answers belong to questionnaire state and must not leak into the card thread.
 */
import { state } from '../../state.js';
import { projectScopedRequestPath, replicaRequestInit } from '../../project/helper/project-request-scope.js';
import { voiceProjectId, voiceReplicaNodeId } from '../../voice/helper/voice-project-id.js';

export type QuestionnaireVoiceTranscription = {
  ok: boolean;
  voiceFileRef: string;
  transcript: string;
  error?: string;
};

export async function transcribeQuestionnaireVoice(audio: Blob | null): Promise<QuestionnaireVoiceTranscription> {
  if (!audio?.size) return { ok: false, voiceFileRef: '', transcript: '', error: 'No audio was captured.' };
  const response = await fetch(projectScopedRequestPath('/api/transcribe', voiceProjectId()), replicaRequestInit({
    method: 'POST',
    headers: { 'content-type': audio.type || 'audio/webm' },
    body: audio,
  }, voiceReplicaNodeId())).catch((error) => ({
    ok: false,
    status: 0,
    json: async () => ({ body: { ok: false, error: error instanceof Error ? error.message : String(error) } }),
  }));
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const body = payload.body && typeof payload.body === 'object' && !Array.isArray(payload.body) ? payload.body as Record<string, unknown> : payload;
  const transcript = String(body.text ?? '').trim();
  const voiceFileRef = String(body.voiceFileRef ?? '').trim();
  const ok = Boolean(response.ok && body.ok !== false && transcript && voiceFileRef);
  state.voice.voiceFileRef = voiceFileRef;
  state.voice.transcriptionStatus = ok ? 'idle' : 'transcription failed';
  return {
    ok,
    voiceFileRef,
    transcript,
    ...(ok ? {} : { error: String(body.error ?? 'Voice transcription failed.') }),
  };
}
