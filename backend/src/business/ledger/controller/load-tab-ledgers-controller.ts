/**
 * WHAT: Implements the load-tab-ledgers-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { readBlueprinttoolState } from '@backend/business/ledger/helper/read-blueprinttool-state.js';
import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
import { validateLedgerDocument } from '@backend/business/ledger/helper/validate-ledger-document.js';
import { writeBlueprinttoolState } from '@backend/business/ledger/effect/write-blueprinttool-state.js';

type AnyRecord = Record<string, unknown>;

export async function loadTabLedgersController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const state = readBlueprinttoolState({ action_payload: payload, runtime_state: runtime, data_model: data });
  const ledger = readLedgerJsonFile({ action_payload: { ...payload, ...state }, runtime_state: runtime, data_model: data });
  const validation = validateLedgerDocument({ action_payload: { ...payload, document: ledger.document }, runtime_state: runtime, data_model: data });
  writeBlueprinttoolState({ action_payload: { ...payload, state, ledger, validation }, runtime_state: runtime, data_model: data });
  return { ok: state.ok !== false && ledger.ok !== false && validation.ok !== false, state, ledger, validation };
}

