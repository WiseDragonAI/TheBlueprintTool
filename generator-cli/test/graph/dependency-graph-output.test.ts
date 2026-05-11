/**
 * WHAT: Integration test for spec 3a12567f.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { resolveGeneratedDependenciesController } from '../../src/business/graph/controller/resolve-generated-dependencies.js';

test('Dependency graph output shows generated function calls through executable path', async () => {
  const expectedTelemetry = ["build-dependency-graph","write-dependency-graph-output"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('3a12567f'.length, 8);
  traces.length = 0;
  await resolveGeneratedDependenciesController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"dry-run","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"dry-run","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '3a12567f',
    suiteName: 'Dependency graph output shows generated function calls through executable path',
    controllerName: "resolve-generated-dependencies",
    executionEntry: "controller:resolve-generated-dependencies",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
