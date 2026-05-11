/**
 * WHAT: Generated effect function manage-ledger-json-rejected.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';


export function manageLedgerJsonRejected(input: unknown = {}, ...args: unknown[]): any {
  telemetry('effect:manage-ledger-json-rejected -> return stubbed success value', { functionName: 'manage-ledger-json-rejected', arguments: input, phase: 'event' });
  void args;
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return { ok: true, value: input, ...record, mode: record.mode ?? 'dry-run', ledger_command: record.ledger_command ?? 'mutate', ...{ functionName: 'manage-ledger-json-rejected', input } };
}
