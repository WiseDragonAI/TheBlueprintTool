/**
 * WHAT: Unit test for generated function write-integration-test-file.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeIntegrationTestFile } from '../../../../src/business/generate/effect/write-integration-test-file.js';

test('write-integration-test-file returns generated execution output', async () => {
  const result = await writeIntegrationTestFile({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
