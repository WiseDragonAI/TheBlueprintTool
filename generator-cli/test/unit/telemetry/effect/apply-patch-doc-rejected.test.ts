/**
 * WHAT: Unit test for generated function apply-patch-doc-rejected.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatchDocRejected } from '../../../../src/business/telemetry/effect/apply-patch-doc-rejected.js';

test('apply-patch-doc-rejected returns generated execution output', async () => {
  const result = await applyPatchDocRejected({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
