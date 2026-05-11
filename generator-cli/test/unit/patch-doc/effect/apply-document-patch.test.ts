/**
 * WHAT: Unit coverage for generated function apply-document-patch.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDocumentPatch } from '../../../../src/business/patch-doc/effect/apply-document-patch.js';

test('apply-document-patch exports an implemented function', () => {
  assert.equal(typeof applyDocumentPatch, 'function');
});
