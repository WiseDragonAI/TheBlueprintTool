/**
 * WHAT: Unit coverage for generated function build-dependency-graph.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDependencyGraph } from '../../../../src/business/graph/helper/build-dependency-graph.js';

test('build-dependency-graph exports an implemented function', () => {
  assert.equal(typeof buildDependencyGraph, 'function');
});
