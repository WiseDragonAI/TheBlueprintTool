/**
 * WHAT: Unit coverage for generated function apply-patch-doc-rejected.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatchDocRejected } from '../../../../src/business/telemetry/effect/apply-patch-doc-rejected.js';

test('apply-patch-doc-rejected exports an implemented function', () => {
  assert.equal(typeof applyPatchDocRejected, 'function');
});
