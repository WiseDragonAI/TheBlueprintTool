/**
 * WHAT: Spec 521476a5 test for report function usage inference.
 * WHY: reports connect specs to functions through telemetry, not source references.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeneratedReport } from '../../src/index.js';
import { sampleFunctions, sampleGraph, sampleTelemetry } from '../fixture/scenario.js';

test('Test run infers function usage from telemetry and writes it to the report', () => {
  const report = buildGeneratedReport({
    testRun: { command: 'node --test', exitCode: 0, stdout: 'ok', stderr: '', traces: [] },
    telemetry: sampleTelemetry(),
    graph: sampleGraph(),
    functions: sampleFunctions(),
  });
  assert.deepEqual(report.usedFunctions, ['first-helper']);
  assert.deepEqual(report.unusedFunctions, ['second-helper']);
});
