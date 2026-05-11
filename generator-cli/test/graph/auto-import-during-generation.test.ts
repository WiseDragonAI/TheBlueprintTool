/**
 * WHAT: Spec 3aec8ea9 test for auto-import path derivation.
 * WHY: the agent must not manually specify dependency import paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverDependencyReferences, resolveImportPaths } from '../../src/index.js';
import { sampleFunctions } from '../fixture/scenario.js';

test('Auto-import during generation resolves imports without agent-specified paths', () => {
  const functions = sampleFunctions();
  const imports = resolveImportPaths(discoverDependencyReferences(functions), functions);
  assert.equal(imports[0].importPath, './second-helper.js');
});
