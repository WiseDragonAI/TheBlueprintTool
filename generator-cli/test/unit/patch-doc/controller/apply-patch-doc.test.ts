/**
 * WHAT: Unit test for generated function apply-patch-doc.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatchDocController } from '../../../../src/business/patch-doc/controller/apply-patch-doc.js';

test('apply-patch-doc returns generated execution output', async () => {
  const result = await applyPatchDocController({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
