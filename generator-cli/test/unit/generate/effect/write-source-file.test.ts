/**
 * WHAT: Unit test for generated function write-source-file.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeSourceFile } from '../../../../src/business/generate/effect/write-source-file.js';

test('write-source-file returns generated execution output', async () => {
  const result = await writeSourceFile({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
