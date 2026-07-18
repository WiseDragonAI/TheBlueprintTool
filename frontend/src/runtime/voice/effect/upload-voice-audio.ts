/**
 * WHAT: Uploads a voice audio blob to the backend local upload cache.
 * WHY: Audio must be preserved before provider transcription can succeed or fail.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { state } from '../../state.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
import { projectScopedRequestPath, replicaRequestInit } from '../../project/helper/project-request-scope.js';
import { voiceProjectId, voiceReplicaNodeId } from '../helper/voice-project-id.js';

export type VoiceTranscriptionResult = {
  ok: boolean;
  uploaded: boolean;
  configured: boolean;
  noteId?: string;
  voiceFileRef: string;
  text: string;
  error?: string;
  status?: number;
  queueCodex?: boolean;
  launchMode?: 'send' | 'run' | 'pipeline';
  revision?: number;
  lifecycleStatus?: string;
  uploadReceivedAt?: string;
  audioPersistedAt?: string;
  acceptedAt?: string;
  providerStartedAt?: string;
};

export type VoiceUploadOptions = {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId?: string;
  threadId?: string;
  cardId?: string;
  noteId?: string;
  queueCodex?: boolean;
  launchMode?: 'send' | 'run' | 'pipeline';
};

function uploadOptions(input: VoiceUploadOptions | string | undefined): VoiceUploadOptions {
  return typeof input === 'string' ? { threadId: input } : input ?? {};
}

function currentPathname(): string {
  const windowPath = (globalThis as { window?: { location?: { pathname?: string } } }).window?.location?.pathname;
  const locationPath = (globalThis as { location?: { pathname?: string } }).location?.pathname;
  return typeof windowPath === 'string' ? windowPath : typeof locationPath === 'string' ? locationPath : '/';
}

function activeLedgerId(fallback?: string): string {
  const explicit = String(fallback ?? '').trim();
  if (explicit) return explicit;
  const pathname = currentPathname();
  if (pathname && pathname !== '/') return String(routeTab(pathname) || '').trim();
  return String(state.activeTab || routeTab(pathname) || '').trim();
}

function cardIdFromThread(threadId: string, fallback?: string): string {
  const explicit = String(fallback ?? '').trim();
  if (explicit) return explicit;
  return threadId.startsWith('thread-') ? threadId.replace(/^thread-/, '').trim() : '';
}

export async function uploadVoiceAudio(audio: Blob, input: VoiceUploadOptions | string = {}): Promise<VoiceTranscriptionResult> {
  const options = uploadOptions(input);
  const projectId = voiceProjectId(options.projectId);
  const replicaNodeId = voiceReplicaNodeId(options.replicaNodeId);
  const threadId = options.threadId || state.threadId || '';
  const form = new FormData();
  form.append('audio', audio, audio.type.includes('wav') ? 'voice.wav' : 'voice.webm');
  form.append('ledgerId', activeLedgerId(options.ledgerId));
  form.append('threadId', threadId);
  form.append('cardId', cardIdFromThread(threadId, options.cardId));
  form.append('noteId', options.noteId ?? '');
  const launchMode = options.launchMode ?? (options.queueCodex ? 'run' : 'send');
  form.append('launchMode', launchMode);
  form.append('queueCodex', launchMode === 'run' ? 'true' : 'false');
  telemetry('upload-voice-audio', { optimistic: true, preserved: true, size: audio.size, type: audio.type, threadId, launchMode });
  const response = await fetch(projectScopedRequestPath('/api/voice-upload', projectId), replicaRequestInit({
    method: 'POST',
    body: form
  }, replicaNodeId)).catch((error) => ({ ok: false, status: 0, json: async () => ({ body: { ok: false, error: error instanceof Error ? error.message : String(error) } }) }));
  const payload = await response.json().catch(() => ({}));
  const body = payload.body && typeof payload.body === 'object' ? payload.body : payload;
  const result: VoiceTranscriptionResult = {
    ok: Boolean(response.ok && body.ok !== false),
    uploaded: Boolean(body.uploaded),
    configured: body.configured !== false,
    voiceFileRef: String(body.voiceFileRef ?? ''),
    text: String(body.text ?? ''),
    error: body.error ? String(body.error) : undefined,
    status: response.status
  };
  if (body.noteId) result.noteId = String(body.noteId);
  if (body.queueCodex === true) result.queueCodex = true;
  if (body.launchMode === 'send' || body.launchMode === 'run' || body.launchMode === 'pipeline') result.launchMode = body.launchMode;
  if (Number.isFinite(Number(body.revision)) && Number(body.revision) > 0) result.revision = Number(body.revision);
  if (body.status) result.lifecycleStatus = String(body.status);
  if (body.uploadReceivedAt) result.uploadReceivedAt = String(body.uploadReceivedAt);
  if (body.audioPersistedAt) result.audioPersistedAt = String(body.audioPersistedAt);
  if (body.acceptedAt) result.acceptedAt = String(body.acceptedAt);
  if (body.providerStartedAt) result.providerStartedAt = String(body.providerStartedAt);
  return result;
}
