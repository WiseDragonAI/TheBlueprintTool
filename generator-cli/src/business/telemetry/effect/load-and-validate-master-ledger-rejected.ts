/**
 * WHAT: Emits rejected MasterLedger load telemetry.
 * WHY: failed ledger validation must be observable.
 */
import { telemetry } from '../../../lib/telemetry/telemetry.js';

export function loadAndValidateMasterLedgerRejected(input: unknown = {}): void {
  telemetry('effect:load-and-validate-master-ledger-rejected -> master ledger validation rejected', { functionName: 'load-and-validate-master-ledger-rejected', phase: 'failed', arguments: input });
}
