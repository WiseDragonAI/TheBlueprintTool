/**
 * WHAT: Spec e6c2a41f test for TypeScript implementation files.
 * WHY: the root block contract requires TypeScript source and project config.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypescriptProjectController } from '../../src/index.js';

test('generator-cli implementation files are TypeScript', async () => {
  const result = await verifyTypescriptProjectController('.');
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.value.every((file) => file.endsWith('.ts')));
});
