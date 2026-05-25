/**
 * WHAT: Stores uploaded voice audio in a transient local cache and returns its file ref.
 * WHY: Optimistic voice upload must succeed before provider transcription is configured.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function persistUploadedVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('persist-uploaded-voice-audio', { role: 'effect', action: 'persist-uploaded-voice-audio' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const audioBuffer = payload.audioBuffer as Buffer | undefined;
  if (!audioBuffer?.byteLength) return { ok: false, error: 'No audio was uploaded' };
  const blueprintRoot = existsSync(resolve(process.cwd(), '.blueprinttool')) ? resolve(process.cwd(), '.blueprinttool') : resolve(process.cwd(), '..', '.blueprinttool');
  const uploadRoot = resolve(String(payload.voiceUploadRoot ?? process.env.COREV2_VOICE_UPLOAD_ROOT ?? resolve(blueprintRoot, 'voice-uploads')));
  mkdirSync(uploadRoot, { recursive: true });
  const mimeType = String(payload.mimeType ?? 'audio/webm');
  const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const voiceFileRef = resolve(uploadRoot, `voice-${Date.now()}-${randomUUID()}.${extension}`);
  writeFileSync(voiceFileRef, audioBuffer);
  runtime.voiceFileRef = voiceFileRef;
  runtime.voiceUploadStatus = 'uploaded';
  runtime.voiceUpload = { voiceFileRef, size: audioBuffer.byteLength, mimeType };
  return { ok: true, voiceFileRef, size: audioBuffer.byteLength, mimeType };
}
