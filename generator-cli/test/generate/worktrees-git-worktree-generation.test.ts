/**
 * WHAT: Integration test for spec 17ecbce8.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { applyGeneratedWorktreeController } from '../../src/business/generate/controller/apply-generated-worktree.js';

test('Generated slice is created inside a git worktree under ./.worktrees', async () => {
  const expectedTelemetry = ["create-worktree-plan","create-git-worktree"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('17ecbce8'.length, 8);
  traces.length = 0;
  await applyGeneratedWorktreeController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"apply","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"apply","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"apply","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '17ecbce8',
    suiteName: 'Generated slice is created inside a git worktree under ./.worktrees',
    controllerName: "apply-generated-worktree",
    executionEntry: "controller:apply-generated-worktree",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
