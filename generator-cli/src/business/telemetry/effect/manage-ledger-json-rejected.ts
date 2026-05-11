/**
 * WHAT: Emits rejected ledger JSON command telemetry.
 * WHY: ledger mode failure must be observable.
 */
import { telemetry } from '../../../lib/telemetry/telemetry.js';

export function manageLedgerJsonRejected(input: unknown = {}): void {
  telemetry('effect:manage-ledger-json-rejected -> ledger json command rejected', { functionName: 'manage-ledger-json-rejected', phase: 'failed', arguments: input });
}
