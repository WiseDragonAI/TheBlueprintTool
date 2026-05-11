/**
 * WHAT: Implements the write-blueprinttool-state effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function writeBlueprinttoolState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('write-blueprinttool-state', { role: 'effect', action: 'write-blueprinttool-state' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const state = payload.state ?? { tabs: payload.tabs ?? [] };
  runtime.blueprinttoolState = state;
  if (payload.mode !== 'dry-run' && payload.blueprinttoolFile) {
    const file = resolve(String(payload.blueprinttoolFile));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2));
  }
}

