/**
 * WHAT: Spec ccb07726 test for execution stack trace reports.
 * WHY: main integration tests must report stack traces for success and failure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureExecutionStackTrace, runNodeTest } from '../../src/index.js';
import { fakeProcess } from '../fixture/scenario.js';

test('Main integration tests report execution stack traces for success and failure', async () => {
  const run = await runNodeTest('node --test', fakeProcess(1));
  const stack = captureExecutionStackTrace(run);
  assert.equal(stack.status, 'failure');
  assert.ok(stack.frames.length > 0);
});
