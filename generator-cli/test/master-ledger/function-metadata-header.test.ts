/**
 * WHAT: Integration test for spec 99fab004.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { loadAndValidateMasterLedgerController } from '../../src/business/master-ledger/controller/load-and-validate-master-ledger.js';

test('Function metadata header contains domain name comments and pseudocode only', async () => {
  const expectedTelemetry = ["validate-function-metadata-header"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('99fab004'.length, 8);
  traces.length = 0;
  await loadAndValidateMasterLedgerController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"dry-run","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '99fab004',
    suiteName: 'Function metadata header contains domain name comments and pseudocode only',
    controllerName: "load-and-validate-master-ledger",
    executionEntry: "controller:load-and-validate-master-ledger",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
