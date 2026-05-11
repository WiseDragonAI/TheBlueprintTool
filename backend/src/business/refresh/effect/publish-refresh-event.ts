/**
 * WHAT: Implements the publish-refresh-event effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function publishRefreshEvent(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('publish-refresh-event', { role: 'effect', action: 'publish-refresh-event' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const events = Array.isArray(runtime.refreshEvents) ? runtime.refreshEvents : [];
  events.push({ payload, publishedAt: new Date(0).toISOString() });
  runtime.refreshEvents = events;
}

