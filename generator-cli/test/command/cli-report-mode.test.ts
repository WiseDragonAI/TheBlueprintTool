/**
 * WHAT: Spec 7ec16380 test for report mode.
 * WHY: report mode must run tests, gather telemetry, and write the generated report file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runReportModeController } from '../../src/index.js';
import { fakeProcess, sampleFunctions, sampleGraph, tempDir, readText } from '../fixture/scenario.js';

test('Report mode runs tests gathers telemetry and writes generated report file', async () => {
  const reportFile = join(await tempDir(), 'report.json');
  await runReportModeController({
    testCommand: 'node --test',
    reportFile,
    functions: sampleFunctions(),
    graph: sampleGraph(),
  }, { process: fakeProcess(0) });
  assert.equal(JSON.parse(await readText(reportFile)).testRun.exitCode, 0);
});
