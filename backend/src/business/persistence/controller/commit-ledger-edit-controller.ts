/**
 * WHAT: Implements the commit-ledger-edit-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { validateLedgerEditPayload } from '@backend/business/persistence/helper/validate-ledger-edit-payload.js';
import { writeLedgerJsonFile } from '@backend/business/persistence/effect/write-ledger-json-file.js';
import { writeBlueprinttoolState } from '@backend/business/ledger/effect/write-blueprinttool-state.js';
import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';
import { parseHttpRequest } from '@backend/business/routing/helper/parse-http-request.js';

type AnyRecord = Record<string, unknown>;

export async function commitLedgerEditController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
  const validation = validateLedgerEditPayload({ action_payload: { ...payload, request }, runtime_state: runtime, data_model: data });
  if (validation.ok !== false) {
    writeLedgerJsonFile({ action_payload: { ...payload, document: validation.document }, runtime_state: runtime, data_model: data });
    writeBlueprinttoolState({ action_payload: { ...payload, state: { lastEdit: validation.document } }, runtime_state: runtime, data_model: data });
  }
  sendJsonResponse({ action_payload: { ...payload, status: validation.ok === false ? 400 : 200, body: validation }, runtime_state: runtime, data_model: data });
  return { ok: validation.ok !== false, request, validation };
}
