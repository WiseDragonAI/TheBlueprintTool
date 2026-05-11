/**
 * WHAT: Emits a check-ledger report to the configured output stream.
 * WHY: operators and agents need readable report output before generation.
 */
import type { MasterLedgerCheckReport } from '../../../lib/types.js';
import { stringifyJson } from '../../../lib/json/json.js';

export function emitCheckLedgerReport(report: MasterLedgerCheckReport, emit: (message: string) => void = console.log): void {
  emit(stringifyJson(report));
}
