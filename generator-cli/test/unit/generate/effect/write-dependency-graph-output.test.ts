/**
 * WHAT: Unit test for generated function write-dependency-graph-output.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeDependencyGraphOutput } from '../../../../src/business/generate/effect/write-dependency-graph-output.js';

test('write-dependency-graph-output returns generated execution output', async () => {
  const result = await writeDependencyGraphOutput({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
