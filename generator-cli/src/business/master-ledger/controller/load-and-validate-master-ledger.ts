/**
 * WHAT: Generated controller function load-and-validate-master-ledger.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { parseFunctionBatch } from '../helper/parse-function-batch.js';
import { readMasterLedger } from '../helper/read-master-ledger.js';
import { validateFunctionMetadataHeader } from '../helper/validate-function-metadata-header.js';
import { validateMasterLedgerPseudocode } from '../helper/validate-master-ledger-pseudocode.js';


export async function loadAndValidateMasterLedgerController({
  action_payload,
}: {
  action_payload: {
    master_ledger_file: string
  }
}) {
  telemetry('controller:load-and-validate-master-ledger -> start', { functionName: 'load-and-validate-master-ledger', arguments: { action_payload }, phase: 'started' });
  telemetry('controller:load-and-validate-master-ledger -> read-master-ledger', { functionName: 'read-master-ledger', arguments: { action_payload }, phase: 'event' })

  // WHAT: load and validate the canonical MasterLedger.
  // WHY: generation must use syntactically correct pseudocode and metadata.
  // HOW: read, parse batch groups, validate headers, and validate pseudocode.
  const master_ledger = await readMasterLedger(action_payload.master_ledger_file)

  if (!master_ledger.ok) {
    telemetry('controller:load-and-validate-master-ledger -> load-and-validate-master-ledger-rejected', { functionName: 'load-and-validate-master-ledger-rejected', arguments: { action_payload }, phase: 'event' })
    return
  }

  const batch = parseFunctionBatch(master_ledger.value)
  telemetry('controller:load-and-validate-master-ledger -> parse-function-batch', { functionName: 'parse-function-batch', arguments: { action_payload }, phase: 'event' })

  const metadata = validateFunctionMetadataHeader(batch)
  telemetry('controller:load-and-validate-master-ledger -> validate-function-metadata-header', { functionName: 'validate-function-metadata-header', arguments: { action_payload }, phase: 'event' })

  const pseudocode = validateMasterLedgerPseudocode(batch)
  telemetry('controller:load-and-validate-master-ledger -> validate-master-ledger-pseudocode', { functionName: 'validate-master-ledger-pseudocode', arguments: { action_payload }, phase: 'event' })

  if (!metadata.ok || !pseudocode.ok) {
    telemetry('controller:load-and-validate-master-ledger -> load-and-validate-master-ledger-rejected', { functionName: 'load-and-validate-master-ledger-rejected', arguments: { action_payload }, phase: 'event' })
    return
  }

  telemetry('controller:load-and-validate-master-ledger -> load-and-validate-master-ledger-completed', { functionName: 'load-and-validate-master-ledger-completed', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:load-and-validate-master-ledger -> complete', { functionName: 'load-and-validate-master-ledger', arguments: { action_payload }, phase: 'completed' });
}
