/**
 * WHAT: Generated effect function apply-patch-doc-rejected.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';


export function applyPatchDocRejected(input: unknown = {}, ...args: unknown[]): any {
  telemetry('effect:apply-patch-doc-rejected -> return stubbed success value', { functionName: 'apply-patch-doc-rejected', arguments: input, phase: 'event' });
  void args;
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return { ok: true, value: input, ...record, mode: record.mode ?? 'dry-run', ledger_command: record.ledger_command ?? 'mutate', ...{ functionName: 'apply-patch-doc-rejected', input } };
}
