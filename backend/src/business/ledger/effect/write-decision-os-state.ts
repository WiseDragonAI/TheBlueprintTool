/**
 * WHAT: Implements the write-decision-os-state effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { normalizeDecisionOsState } from '../helper/normalize-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

export function writeDecisionOsState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('write-decision-os-state', { role: 'effect', action: 'write-decision-os-state' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const state = normalizeDecisionOsState(payload.state ?? { ledgers: payload.ledgers ?? payload.tabs ?? [] }).state;
  runtime.decisionOsState = state;
  if (payload.mode !== 'dry-run' && payload.decisionOsFile) {
    const file = resolve(String(payload.decisionOsFile));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2));
  }
}
