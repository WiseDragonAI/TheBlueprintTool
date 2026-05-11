/**
 * WHAT: Spec 0dc5be37 test for automatic dependency discovery.
 * WHY: referenced functions, types, and constants must become imports automatically.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverDependencyReferences } from '../../src/index.js';
import { sampleFunctions } from '../fixture/scenario.js';

test('Automatic dependency discovery resolves referenced functions types and constants', () => {
  const references = discoverDependencyReferences(sampleFunctions());
  assert.deepEqual(references.map((reference) => reference.to), ['second-helper']);
});
