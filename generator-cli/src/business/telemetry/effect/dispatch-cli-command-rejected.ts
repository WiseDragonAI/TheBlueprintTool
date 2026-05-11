/**
 * WHAT: Generated effect function dispatch-cli-command-rejected.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';


export function dispatchCliCommandRejected(input: unknown = {}, ...args: unknown[]): any {
  telemetry('effect:dispatch-cli-command-rejected -> return stubbed success value', { functionName: 'dispatch-cli-command-rejected', arguments: input, phase: 'event' });
  void args;
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return { ok: true, value: input, ...record, mode: record.mode ?? 'dry-run', ledger_command: record.ledger_command ?? 'mutate', ...{ functionName: 'dispatch-cli-command-rejected', input } };
}
