/**
 * WHAT: Emits completed ledger JSON command telemetry.
 * WHY: ledger mode success must be observable.
 */
import { telemetry } from '../../../lib/telemetry/telemetry.js';

export function manageLedgerJsonCompleted(input: unknown = {}): void {
  telemetry('effect:manage-ledger-json-completed -> ledger json command completed', { functionName: 'manage-ledger-json-completed', phase: 'completed', arguments: input });
}
