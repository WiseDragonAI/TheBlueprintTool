/**
 * WHAT: MasterLedger checker command tests.
 * WHY: agents need counts and blocking problems before trusting generation output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMasterLedgerController, readMasterLedger, parseFunctionBatch, validateFunctionMetadataHeader } from '../../src/index.js';
import { masterLedgerPath, specsLedgerPath } from '../fixture/scenario.js';

test('check-ledger reports root blocks domains functions tests specs and problems', async () => {
  const checked = await checkMasterLedgerController({ masterLedgerFile: masterLedgerPath, specsLedgerFile: specsLedgerPath });
  assert.equal(checked.ok, true);
  assert.equal(checked.ok && checked.value.ok, true);
  assert.equal(checked.ok && checked.value.counts.rootBlocks, 1);
  assert.equal(checked.ok && checked.value.counts.controllers, 12);
  assert.equal(checked.ok && checked.value.counts.helpers, 30);
  assert.equal(checked.ok && checked.value.counts.effects, 20);
  assert.equal(checked.ok && checked.value.counts.generatedFunctions, 62);
  assert.equal(checked.ok && checked.value.counts.sourceFiles, 62);
  assert.equal(checked.ok && checked.value.counts.unitTestFiles, 62);
  assert.equal(checked.ok && checked.value.counts.integrationTestFiles, 31);
  assert.equal(checked.ok && checked.value.counts.testSuites, 31);
  assert.equal(checked.ok && checked.value.counts.uniqueSpecIds, 31);
  assert.equal(checked.ok && checked.value.counts.specsLedgerCards > 31, true);
  assert.deepEqual(checked.ok && checked.value.problems, []);
});

test('check-ledger supports multiple targeted SpecsLedger groups', async () => {
  const checked = await checkMasterLedgerController({
    masterLedgerFile: masterLedgerPath,
    specsLedgerFile: specsLedgerPath,
    groups: ['CLI Tool', 'CLI'],
  });
  assert.equal(checked.ok, true);
  assert.equal(checked.ok && checked.value.selectedGroups.includes('CLI Tool'), true);
  assert.equal(checked.ok && checked.value.selectedGroups.includes('CLI'), true);
  assert.equal(checked.ok && checked.value.ok, false);
  assert.equal(checked.ok && checked.value.problems.some((problem) => problem.code === 'test-suite-outside-selected-groups'), true);
  assert.equal(checked.ok && checked.value.counts.selectedSpecCards >= checked.value.counts.matchedSpecCards, true);
});

test('duplicate generated function names are forbidden', async () => {
  const document = await readMasterLedger(masterLedgerPath);
  assert.ok(document.ok);

  const duplicateDocument = {
    ...document.value,
    text: document.value.text.replace("name: 'emit-dispatch-cli-command-started'", "name: 'dispatch-cli-command'"),
  };
  const batch = parseFunctionBatch(duplicateDocument);
  const validated = validateFunctionMetadataHeader(batch);
  assert.equal(validated.ok, false);
  assert.equal(validated.ok ? '' : validated.error, 'Duplicate generated function name: dispatch-cli-command');
});
