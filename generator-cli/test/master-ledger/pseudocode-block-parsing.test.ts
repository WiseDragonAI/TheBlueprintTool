/**
 * WHAT: Spec a83e8c85 test for parsing MasterLedger pseudoCode blocks.
 * WHY: controller GeneratedFunction bodies must come from ledger-authored pseudocode.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRawBatch } from '../fixture/scenario.js';

test('MasterLedger pseudoCode blocks are parsed into matching controller GeneratedFunction bodies', async () => {
  const batch = await parseRawBatch();
  const controller = batch.functions.find((generatedFunction) => generatedFunction.kind === 'controller' && generatedFunction.name === 'check-master-ledger');
  assert.ok(controller);
  assert.ok(controller.body.includes('async function checkMasterLedgerController'));
  assert.ok(controller.body.includes("telemetry('parse-function-batch')"));
  assert.ok(controller.body.includes('WHY: agents must verify counts'));
});
