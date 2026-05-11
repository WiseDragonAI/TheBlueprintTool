/**
 * WHAT: Generated controller function check-master-ledger.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { analyzeMasterLedger } from '../helper/analyze-master-ledger.js';
import { emitCheckLedgerReport } from '../effect/emit-check-ledger-report.js';
import { parseFunctionBatch } from '../../master-ledger/helper/parse-function-batch.js';
import { readMasterLedger } from '../../master-ledger/helper/read-master-ledger.js';
import { readSpecsLedger } from '../helper/read-specs-ledger.js';
import { resolveLedgerGroups } from '../helper/resolve-ledger-groups.js';


export async function checkMasterLedgerController({
  action_payload,
}: {
  action_payload: {
    check_ledger_command: true
    master_ledger_file: string
    specs_ledger_file: string
    ledger_group_name: string[]
  }
}) {
  telemetry('controller:check-master-ledger -> start', { functionName: 'check-master-ledger', arguments: { action_payload }, phase: 'started' });
  // WHAT: check MasterLedger structure against selected SpecsLedger cards.
  // WHY: agents must verify counts, selected groups, Spec coverage, and problems before generation.
  // HOW: read both ledgers, parse functions and tests, resolve groups, analyze coverage, then emit report.
  const master_ledger = await readMasterLedger(action_payload.master_ledger_file)
  telemetry('controller:check-master-ledger -> read-master-ledger', { functionName: 'read-master-ledger', arguments: { action_payload }, phase: 'event' })

  const specs_ledger = await readSpecsLedger(action_payload.specs_ledger_file)
  telemetry('controller:check-master-ledger -> read-specs-ledger', { functionName: 'read-specs-ledger', arguments: { action_payload }, phase: 'event' })

  const batch = parseFunctionBatch(master_ledger)
  telemetry('controller:check-master-ledger -> parse-function-batch', { functionName: 'parse-function-batch', arguments: { action_payload }, phase: 'event' })

  const selected_groups = resolveLedgerGroups(specs_ledger, action_payload.ledger_group_name)
  telemetry('controller:check-master-ledger -> resolve-ledger-groups', { functionName: 'resolve-ledger-groups', arguments: { action_payload }, phase: 'event' })

  const report = analyzeMasterLedger({ master_ledger, specs_ledger, batch, selected_groups })
  telemetry('controller:check-master-ledger -> analyze-master-ledger', { functionName: 'analyze-master-ledger', arguments: { action_payload }, phase: 'event' })

  emitCheckLedgerReport(report)
  telemetry('controller:check-master-ledger -> emit-check-ledger-report', { functionName: 'emit-check-ledger-report', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:check-master-ledger -> complete', { functionName: 'check-master-ledger', arguments: { action_payload }, phase: 'completed' });
}
