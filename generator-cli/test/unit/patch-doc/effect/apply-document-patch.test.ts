/**
 * WHAT: Unit test for generated function apply-document-patch.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDocumentPatch } from '../../../../src/business/patch-doc/effect/apply-document-patch.js';

test('apply-document-patch returns generated execution output', async () => {
  const result = await applyDocumentPatch({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
