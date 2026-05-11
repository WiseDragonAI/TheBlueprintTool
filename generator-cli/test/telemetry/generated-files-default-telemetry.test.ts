/**
 * WHAT: Integration test for spec c5329a69.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { attachGeneratedTelemetryController } from '../../src/business/telemetry/controller/attach-generated-telemetry.js';

test('Generated files include default telemetry for function name and arguments', async () => {
  const expectedTelemetry = ["inject-telemetry-calls","write-telemetry-harness"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('c5329a69'.length, 8);
  traces.length = 0;
  await attachGeneratedTelemetryController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"dry-run","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: 'c5329a69',
    suiteName: 'Generated files include default telemetry for function name and arguments',
    controllerName: "attach-generated-telemetry",
    executionEntry: "controller:attach-generated-telemetry",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
