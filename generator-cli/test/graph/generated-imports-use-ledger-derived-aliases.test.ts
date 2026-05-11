/**
 * WHAT: Spec c6b4a8e2 test for generated import aliases.
 * WHY: generated code uses ledger-derived @ aliases instead of brittle relative paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('generated source and integration imports use @generator-cli aliases', async () => {
  const batch = await loadBatch();
  const functions = enumerateGeneratedFunctions(batch);
  const plan = createWorktreePlan({ output: '.worktrees/x', functions, suites: batch.suites });
  const files = [...plan.sourceFiles, ...plan.integrationTestFiles];
  const imports = files.flatMap((file) => [...file.content.matchAll(/from '([^']+)'/g)].map((match) => match[1]));

  assert.equal(imports.some((importPath) => importPath.startsWith('@generator-cli/')), true);
  assert.equal(imports.some((importPath) => importPath.startsWith('#generator-cli/')), false);
  assert.equal(imports.some((importPath) => importPath.startsWith('../')), false);
});
