/**
 * WHAT: Spec 3a12567f test for dependency graph output.
 * WHY: generated reports need an executable function dependency graph.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDependencyGraph } from '../../src/index.js';
import { sampleFunctions } from '../fixture/scenario.js';

test('Dependency graph output shows generated function calls through executable path', () => {
  const functions = sampleFunctions();
  const graph = buildDependencyGraph(functions, [{ from: 'first-helper', to: 'second-helper', importPath: './second-helper.js' }]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges[0].to, 'second-helper');
});
