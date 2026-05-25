/**
 * WHAT: Implements the call-openai-transcription effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export async function callOpenaiTranscription(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<Record<string, unknown>> {
  telemetry('call-openai-transcription', { role: 'effect', action: 'call-openai-transcription' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  if (payload.transcriptionText || payload.text || payload.mode === 'dry-run') {
    runtime.transcriptionText = String(payload.transcriptionText ?? payload.text ?? '');
    return { ok: true, text: runtime.transcriptionText };
  }
  const config = payload.config as Record<string, unknown> | undefined;
  const apiKey = String(config?.apiKey ?? '');
  const audioBuffer = payload.audioBuffer as Buffer | undefined;
  if (!apiKey) return { ok: false, error: 'OpenAI transcription is not configured' };
  if (!audioBuffer?.byteLength) return { ok: false, error: 'No audio was uploaded' };
  const form = new FormData();
  const mimeType = String(payload.mimeType ?? 'audio/webm');
  form.append('model', String(config?.model ?? 'gpt-4o-mini-transcribe'));
  form.append('response_format', 'json');
  const audioBytes = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer;
  form.append('file', new Blob([audioBytes], { type: mimeType }), mimeType.includes('wav') ? 'voice.wav' : 'voice.webm');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: String(body.error?.message ?? `OpenAI transcription failed with ${response.status}`) };
  runtime.transcriptionText = String(body.text ?? '');
  return { ok: true, text: runtime.transcriptionText };
}
