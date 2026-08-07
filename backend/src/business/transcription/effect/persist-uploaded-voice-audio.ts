/**
 * WHAT: Stores uploaded voice audio in the local workspace cache and returns its file ref.
 * WHY: Optimistic voice notes must keep recorded audio available for transcription retry.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from '@backend/business/server/helper/resolve-decision-os-root.js';

type AnyRecord = Record<string, unknown>;

export function persistUploadedVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('persist-uploaded-voice-audio', { role: 'effect', action: 'persist-uploaded-voice-audio' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const audioBuffer = payload.audioBuffer as Buffer | undefined;
  if (!audioBuffer?.byteLength) return { ok: false, error: 'No audio was uploaded' };
  const blueprintRoot = resolveDecisionOsRoot({ action_payload: payload, runtime_state: runtime });
  const uploadRoot = resolve(String(payload.voiceUploadRoot ?? process.env.DECISION_OS_VOICE_UPLOAD_ROOT ?? resolve(blueprintRoot, 'voice-uploads')));
  mkdirSync(uploadRoot, { recursive: true });
  const mimeType = String(payload.mimeType ?? 'audio/webm');
  const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const stableIdentity = [payload.noteId, payload.voiceAttemptId]
    .map((value) => String(value ?? '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('-');
  const voiceFileRef = resolve(uploadRoot, `voice-${stableIdentity || `${Date.now()}-${randomUUID()}`}.${extension}`);
  if (existsSync(voiceFileRef)) {
    if (!readFileSync(voiceFileRef).equals(audioBuffer)) return { ok: false, error: 'voice_upload_identity_conflict' };
  } else {
    const temporary = `${voiceFileRef}.upload-${process.pid}-${randomUUID()}`;
    try {
      writeFileSync(temporary, audioBuffer, { flag: 'wx' });
      renameSync(temporary, voiceFileRef);
    } catch (error) {
      rmSync(temporary, { force: true });
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  runtime.voiceFileRef = voiceFileRef;
  runtime.voiceUploadStatus = 'uploaded';
  runtime.voiceUpload = { voiceFileRef, size: audioBuffer.byteLength, mimeType };
  return { ok: true, voiceFileRef, size: audioBuffer.byteLength, mimeType };
}
