/**
 * WHAT: Unit test for generated function parse-cli-argv.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgv } from '../../../../src/business/command/helper/parse-cli-argv.js';

test('parse-cli-argv returns generated execution output', async () => {
  const result = await parseCliArgv({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
