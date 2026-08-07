/**
 * WHAT: Reads workspace state and rewrites it to the canonical ledgers schema when needed.
 * WHY: All backend routes must agree that ledgers, not tabs, are the persistent registry.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveDecisionOsRoot } from '@backend/business/server/helper/resolve-decision-os-root.js';
import { normalizeDecisionOsState, type DecisionOsLedgerEntry } from './normalize-decision-os-state.js';
import { writeCanonicalDecisionOsState } from '../effect/write-canonical-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

export function readCanonicalDecisionOsState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; writeBack?: boolean } | AnyRecord = {}): {
  file: string;
  ledgers: DecisionOsLedgerEntry[];
  migrated: boolean;
} {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; writeBack?: boolean };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolveDecisionOsRoot({ action_payload: payload, runtime_state: runtime });
  const file = payload.decisionOsFile ? resolve(String(payload.decisionOsFile)) : resolve(decisionOsRoot, 'state.json');
  if (!existsSync(file)) throw new Error(`decision_os_state_missing:${file}`);
  const rawState = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  const normalized = normalizeDecisionOsState(rawState);
  if ((payload.writeBack === true || envelope.writeBack === true) && normalized.migrated) {
    writeCanonicalDecisionOsState({ file, ledgers: normalized.state.ledgers });
  }
  return { file, ledgers: normalized.state.ledgers, migrated: normalized.migrated };
}
