/**
 * WHAT: Spec b0f3a2d1 test for explicit helper/effect return contracts.
 * WHY: generated stubs must never fall back to any.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMasterLedger, parseFunctionBatch, readMasterLedger } from '../../src/index.js';
import { masterLedgerPath, specsLedgerPath, readText } from '../fixture/scenario.js';

test('check-ledger flags missing and any helper/effect return types', async () => {
  const document = await readMasterLedger(masterLedgerPath);
  assert.ok(document.ok);
  const specsLedger = JSON.parse(await readText(specsLedgerPath));
  const baseBatch = parseFunctionBatch(document.value);
  const targetIndex = baseBatch.functions.findIndex((generatedFunction) => generatedFunction.kind === 'helper' || generatedFunction.kind === 'effect');
  assert.notEqual(targetIndex, -1);
  const missingBatch = {
    ...baseBatch,
    functions: baseBatch.functions.map((generatedFunction, index) => (index === targetIndex ? { ...generatedFunction, returnType: undefined } : generatedFunction)),
  };
  const anyBatch = {
    ...baseBatch,
    functions: baseBatch.functions.map((generatedFunction, index) => (index === targetIndex ? { ...generatedFunction, returnType: 'any' } : generatedFunction)),
  };

  const missingReport = analyzeMasterLedger(document.value, missingBatch, specsLedger);
  const anyReport = analyzeMasterLedger(document.value, anyBatch, specsLedger);

  assert.equal(missingReport.problems.some((problem) => problem.code === 'missing-function-return-type'), true);
  assert.equal(anyReport.problems.some((problem) => problem.code === 'illegal-any-return-type'), true);
});
