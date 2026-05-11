/**
 * WHAT: Generated controller function manage-ledger-json.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { readLedgerJson } from '../helper/read-ledger-json.js';
import { writeLedgerJson } from '../effect/write-ledger-json.js';


export async function manageLedgerJsonController({
  action_payload,
}: {
  action_payload: {
    ledger_command: 'inspect' | 'mutate'
    ledger_json_file: string
  }
}) {
  telemetry('controller:manage-ledger-json -> start', { functionName: 'manage-ledger-json', arguments: { action_payload }, phase: 'started' });
  telemetry('controller:manage-ledger-json -> read-ledger-json', { functionName: 'read-ledger-json', arguments: { action_payload }, phase: 'event' })

  // WHAT: operate on committed ledger JSON.
  // WHY: architecture edits must not use shadow state.
  // HOW: read the JSON, validate it, then write only for controlled mutations.
  const ledger = await readLedgerJson(action_payload.ledger_json_file)

  if (!ledger.ok) {
    telemetry('controller:manage-ledger-json -> manage-ledger-json-rejected', { functionName: 'manage-ledger-json-rejected', arguments: { action_payload }, phase: 'event' })
    return
  }

  if (action_payload.ledger_command === 'mutate') {
    await writeLedgerJson(ledger.value)
    telemetry('controller:manage-ledger-json -> write-ledger-json', { functionName: 'write-ledger-json', arguments: { action_payload }, phase: 'event' })
  }

  telemetry('controller:manage-ledger-json -> manage-ledger-json-completed', { functionName: 'manage-ledger-json-completed', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:manage-ledger-json -> complete', { functionName: 'manage-ledger-json', arguments: { action_payload }, phase: 'completed' });
}
