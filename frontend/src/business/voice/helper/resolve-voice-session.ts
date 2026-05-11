/**
 * WHAT: Implements the resolve-voice-session helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveVoiceSession(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-voice-session', { role: 'helper', action: 'resolve-voice-session' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const sessionId = String(payload.voiceSessionId ?? runtime.voiceSessionId ?? 'voice-session-default');
  const status = String(payload.voiceStatus ?? runtime.voiceStatus ?? 'recording');
  return { ok: payload.voiceEnabled !== false, sessionId, status, threadId: payload.threadId ?? runtime.threadId ?? 'thread-default' };
}

