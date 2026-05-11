/**
 * WHAT: Implements the parse-card-markdown helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function parseCardMarkdown(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('parse-card-markdown', { role: 'helper', action: 'parse-card-markdown' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const source = String(payload.markdown ?? payload.content ?? '');
  const title = source.split('\n').find((line) => line.trim().length > 0)?.replace(/^#+\s*/, '') ?? '';
  const labels = Array.from(source.matchAll(/#([a-zA-Z0-9_-]+)/g)).map((match) => match[1]);
  return { ok: true, markdown: source, title, labels, text: source.replace(/[\#*_]/g, '').trim() };
}

