/**
 * WHAT: Spec a8b01160 test for unused function detection.
 * WHY: unused functions are absent from integration-test telemetry stacks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectUnusedFunctions, inferFunctionUsage } from '../../src/index.js';
import { sampleFunctions, sampleTelemetry } from '../fixture/scenario.js';

test('Unused function detection uses integration-test telemetry stack only', () => {
  const used = inferFunctionUsage(sampleTelemetry());
  assert.deepEqual(detectUnusedFunctions(sampleFunctions(), used), ['second-helper']);
});
