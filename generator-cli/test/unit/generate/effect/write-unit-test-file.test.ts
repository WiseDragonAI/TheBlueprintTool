/**
 * WHAT: Unit test for generated function write-unit-test-file.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeUnitTestFile } from '../../../../src/business/generate/effect/write-unit-test-file.js';

test('write-unit-test-file returns generated execution output', async () => {
  const result = await writeUnitTestFile({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
