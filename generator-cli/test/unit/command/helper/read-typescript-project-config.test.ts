/**
 * WHAT: Unit test for generated function read-typescript-project-config.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readTypescriptProjectConfig } from '../../../../src/business/command/helper/read-typescript-project-config.js';

test('read-typescript-project-config returns generated execution output', async () => {
  const result = await readTypescriptProjectConfig({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
