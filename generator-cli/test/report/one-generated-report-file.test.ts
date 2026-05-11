/**
 * WHAT: Spec 69109a76 test for one generated report file.
 * WHY: each report run must persist exactly one GeneratedReport file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeGeneratedReportFile } from '../../src/index.js';
import { sampleGraph, tempDir, readText } from '../fixture/scenario.js';

test('CLI writes one generated report file for a run', async () => {
  const file = join(await tempDir(), 'report.json');
  await writeGeneratedReportFile(file, {
    testRun: { command: 'x', exitCode: 0, stdout: '', stderr: '' },
    telemetry: [],
    stackTrace: { status: 'success', frames: ['ok'] },
    graph: sampleGraph(),
    usedFunctions: [],
    unusedFunctions: [],
  });
  assert.equal(JSON.parse(await readText(file)).stackTrace.status, 'success');
});
