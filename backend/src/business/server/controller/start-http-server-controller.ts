/**
 * WHAT: Implements the start-http-server-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { readDecisionOsState } from '@backend/business/ledger/helper/read-decision-os-state.js';
import { watchLedgerDirectory } from '@backend/business/refresh/helper/watch-ledger-directory.js';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { readDecisionOsSettings } from '@backend/business/server/helper/read-decision-os-settings.js';

type AnyRecord = Record<string, unknown>;

export async function startHttpServerController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const settings = readDecisionOsSettings({ action_payload: payload, runtime_state: runtime, data_model: data });
  const settingsPayload = { ...(settings.settings as AnyRecord), ...payload, decisionOsRoot: settings.decisionOsRoot };
  const state = readDecisionOsState({ action_payload: settingsPayload, runtime_state: runtime, data_model: data });
  const watch = watchLedgerDirectory({ action_payload: settingsPayload, runtime_state: runtime, data_model: data });
  const server = createHttpServer({ action_payload: settingsPayload, runtime_state: runtime, data_model: data });
  return { ok: settings.ok !== false && state.ok !== false && watch.ok !== false && server.ok !== false, settings, state, watch, server };
}
