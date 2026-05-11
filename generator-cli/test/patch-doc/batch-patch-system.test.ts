/**
 * WHAT: Integration test for spec 67e83237.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { applyPatchDocController } from '../../src/business/patch-doc/controller/apply-patch-doc.js';

test('Batch patch system applies canonical document patch batches in one pass', async () => {
  const expectedTelemetry = ["parse-patch-batch","apply-document-patch"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('67e83237'.length, 8);
  traces.length = 0;
  await applyPatchDocController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"patch-doc","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"patch-doc","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"patch-doc","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '67e83237',
    suiteName: 'Batch patch system applies canonical document patch batches in one pass',
    controllerName: "apply-patch-doc",
    executionEntry: "controller:apply-patch-doc",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
