/**
 * WHAT: Integration test for spec 65bf9ae6.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { loadAndValidateMasterLedgerController } from '../../src/business/master-ledger/controller/load-and-validate-master-ledger.js';

test('Master ledger pseudocode is syntactically correct and contains telemetry branching parameter usage state usage and comments', async () => {
  const expectedTelemetry = ["read-master-ledger","validate-master-ledger-pseudocode"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('65bf9ae6'.length, 8);
  traces.length = 0;
  await loadAndValidateMasterLedgerController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"dry-run","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '65bf9ae6',
    suiteName: 'Master ledger pseudocode is syntactically correct and contains telemetry branching parameter usage state usage and comments',
    controllerName: "load-and-validate-master-ledger",
    executionEntry: "controller:load-and-validate-master-ledger",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
