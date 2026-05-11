/**
 * WHAT: Implements the publish-server-refresh-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { watchLedgerDirectory } from '@backend/business/refresh/helper/watch-ledger-directory.js';
import { debounceRefreshEvent } from '@backend/business/refresh/helper/debounce-refresh-event.js';
import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
import { validateLedgerDocument } from '@backend/business/ledger/helper/validate-ledger-document.js';
import { publishRefreshEvent } from '@backend/business/refresh/effect/publish-refresh-event.js';

type AnyRecord = Record<string, unknown>;

export async function publishServerRefreshController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const watch = watchLedgerDirectory({ action_payload: payload, runtime_state: runtime, data_model: data });
  const debounce = debounceRefreshEvent({ action_payload: payload, runtime_state: runtime, data_model: data });
  const ledger = readLedgerJsonFile({ action_payload: payload, runtime_state: runtime, data_model: data });
  const validation = validateLedgerDocument({ action_payload: { ...payload, document: ledger.document }, runtime_state: runtime, data_model: data });
  if (watch.ok !== false && debounce.ok !== false && validation.ok !== false) {
    publishRefreshEvent({ action_payload: { ...payload, watch, debounce, ledger }, runtime_state: runtime, data_model: data });
  }
  return { ok: watch.ok !== false && debounce.ok !== false && validation.ok !== false, watch, debounce, ledger, validation };
}

