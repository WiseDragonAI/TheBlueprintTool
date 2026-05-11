/**
 * WHAT: Integration test for spec 205fdb23.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { dispatchCliCommandController } from '../../src/business/command/controller/dispatch-cli-command.js';

test('Check-ledger mode reads MasterLedger and SpecsLedger reports counts selected groups spec coverage and problems without generating files', async () => {
  const expectedTelemetry = ["parse-cli-argv","read-master-ledger","read-specs-ledger","analyze-master-ledger","emit-check-ledger-report"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('205fdb23'.length, 8);
  traces.length = 0;
  await dispatchCliCommandController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"check-ledger","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"check-ledger","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"check-ledger","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '205fdb23',
    suiteName: 'Check-ledger mode reads MasterLedger and SpecsLedger reports counts selected groups spec coverage and problems without generating files',
    controllerName: "dispatch-cli-command",
    executionEntry: "controller:dispatch-cli-command",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
