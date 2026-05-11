/**
 * WHAT: Spec c41d5c52 test for master function batch parsing.
 * WHY: the batch must contain input, controller, helper, effect, test, or component function groups.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRawBatch } from '../fixture/scenario.js';

test('Master function batch file contains function groups', async () => {
  const batch = await parseRawBatch();
  assert.ok(batch.functions.some((fn) => fn.kind === 'controller'));
  assert.ok(batch.functions.some((fn) => fn.kind === 'helper'));
  assert.ok(batch.functions.some((fn) => fn.kind === 'effect'));
});
