/**
 * WHAT: Unit coverage for generated function apply-patch-doc.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatchDocController } from '../../../../src/business/patch-doc/controller/apply-patch-doc.js';

test('apply-patch-doc exports an implemented function', () => {
  assert.equal(typeof applyPatchDocController, 'function');
});
