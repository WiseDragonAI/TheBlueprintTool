/**
 * WHAT: Spec 0954dc5c test for pure function unit tests and usage exclusion.
 * WHY: unit tests prove pure behavior but do not count as runtime usage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGeneratedFunctions, inferFunctionUsage } from '../../src/index.js';
import { sampleFunctions, sampleTelemetry } from '../fixture/scenario.js';

test('Pure generated functions have unit tests that do not count as runtime usage', () => {
  assert.ok(classifyGeneratedFunctions(sampleFunctions()).every((fn) => fn.pure));
  assert.deepEqual(inferFunctionUsage(sampleTelemetry()), ['first-helper']);
});
