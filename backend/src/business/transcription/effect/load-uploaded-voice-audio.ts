/**
 * WHAT: Loads a previously accepted voice upload from the local upload cache.
 * WHY: Retry transcription must use the preserved audio file without accepting arbitrary file paths.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveBlueprinttoolRoot } from '@backend/business/server/helper/resolve-blueprinttool-root.js';

type AnyRecord = Record<string, unknown>;

export function loadUploadedVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('load-uploaded-voice-audio', { role: 'effect', action: 'load-uploaded-voice-audio' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const voiceFileRef = String(payload.voiceFileRef ?? runtime.voiceFileRef ?? '');
  if (!voiceFileRef) return { ok: false, error: 'No voice upload was provided' };
  const blueprintRoot = resolveBlueprinttoolRoot({ action_payload: payload, runtime_state: runtime });
  const uploadRoot = resolve(String(payload.voiceUploadRoot ?? process.env.COREV2_VOICE_UPLOAD_ROOT ?? resolve(blueprintRoot, 'voice-uploads')));
  const resolvedFileRef = resolve(voiceFileRef);
  if (resolvedFileRef !== uploadRoot && !resolvedFileRef.startsWith(`${uploadRoot}${sep}`)) return { ok: false, error: 'Voice upload is outside the workspace cache' };
  if (!existsSync(resolvedFileRef)) return { ok: false, error: 'Voice upload is missing' };
  const audioBuffer = readFileSync(resolvedFileRef);
  const extension = resolvedFileRef.split('.').pop()?.toLowerCase() ?? 'webm';
  const mimeType = extension === 'wav' ? 'audio/wav' : extension === 'mp3' ? 'audio/mpeg' : extension === 'ogg' ? 'audio/ogg' : 'audio/webm';
  runtime.voiceFileRef = resolvedFileRef;
  runtime.voiceUploadStatus = 'loaded';
  runtime.voiceUpload = { voiceFileRef: resolvedFileRef, size: audioBuffer.byteLength, mimeType };
  return { ok: true, voiceFileRef: resolvedFileRef, size: audioBuffer.byteLength, mimeType, audioBuffer };
}
