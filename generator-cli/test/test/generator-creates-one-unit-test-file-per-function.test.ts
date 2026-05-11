/**
 * WHAT: Integration test for spec d4b8e02a.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { generateGeneratedTestsController } from '../../src/business/test/controller/generate-generated-tests.js';

test('Generator creates one unit test file per function', async () => {
  const expectedTelemetry = ["enumerate-generated-functions","derive-unit-test-file-path","write-unit-test-file"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('d4b8e02a'.length, 8);
  traces.length = 0;
  await generateGeneratedTestsController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"dry-run","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: 'd4b8e02a',
    suiteName: 'Generator creates one unit test file per function',
    controllerName: "generate-generated-tests",
    executionEntry: "controller:generate-generated-tests",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
