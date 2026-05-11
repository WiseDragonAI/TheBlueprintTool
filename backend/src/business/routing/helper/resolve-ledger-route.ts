/**
 * WHAT: Implements the resolve-ledger-route helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveLedgerRoute(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-ledger-route', { role: 'helper', action: 'resolve-ledger-route' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const url = String(payload.url ?? payload.path ?? '/ledgers/default');
  const isLedgerRoute = url.startsWith('/ledgers') || url.includes('ledger');
  return { ok: isLedgerRoute, route: isLedgerRoute ? 'ledger-read' : 'not-found', ledgerFile: payload.ledgerFile ?? payload.master_ledger_file ?? 'generated-master-ledger.json' };
}

