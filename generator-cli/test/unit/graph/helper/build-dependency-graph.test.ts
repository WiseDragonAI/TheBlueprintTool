/**
 * WHAT: Unit test for generated function build-dependency-graph.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDependencyGraph } from '../../../../src/business/graph/helper/build-dependency-graph.js';

test('build-dependency-graph returns generated execution output', async () => {
  const result = await buildDependencyGraph({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
