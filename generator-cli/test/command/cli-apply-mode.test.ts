/**
 * WHAT: Integration test for spec 6d853968.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { dispatchCliCommandController } from '../../src/business/command/controller/dispatch-cli-command.js';

test('Apply mode writes generated worktree imports tests telemetry harness and report configuration', async () => {
  const expectedTelemetry = ["parse-cli-argv","create-git-worktree","write-source-file","write-unit-test-file","write-telemetry-harness"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('6d853968'.length, 8);
  traces.length = 0;
  await dispatchCliCommandController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"apply","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"apply","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"apply","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '6d853968',
    suiteName: 'Apply mode writes generated worktree imports tests telemetry harness and report configuration',
    controllerName: "dispatch-cli-command",
    executionEntry: "controller:dispatch-cli-command",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
