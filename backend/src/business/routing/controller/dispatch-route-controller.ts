/**
 * WHAT: Implements the dispatch-route-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { parseHttpRequest } from '@backend/business/routing/helper/parse-http-request.js';
import { resolveLedgerRoute } from '@backend/business/routing/helper/resolve-ledger-route.js';
import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';

type AnyRecord = Record<string, unknown>;

export async function dispatchRouteController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
  const route = resolveLedgerRoute({ action_payload: { ...payload, ...request }, runtime_state: runtime, data_model: data });
  const ledger = route.ok === false ? { ok: false, document: null } : readLedgerJsonFile({ action_payload: { ...payload, ...route }, runtime_state: runtime, data_model: data });
  sendJsonResponse({ action_payload: { ...payload, status: route.ok === false ? 404 : 200, body: ledger }, runtime_state: runtime, data_model: data });
  return { ok: route.ok !== false, request, route, ledger };
}

