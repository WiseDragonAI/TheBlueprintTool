/**
 * WHAT: Spec ee77191d test for node:test execution.
 * WHY: unit and browser-runtime helper tests must run through node:test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runNodeTest } from '../../src/index.js';
import { fakeProcess } from '../fixture/scenario.js';

test('Node test runner executes generator-cli TypeScript unit tests', async () => {
  const run = await runNodeTest('node --test', fakeProcess(0));
  assert.equal(run.exitCode, 0);
  assert.equal(run.command, 'node --test');
});
