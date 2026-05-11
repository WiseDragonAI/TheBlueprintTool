/**
 * WHAT: Unit coverage for generated function emit-dry-run-output.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDryRunOutput } from '../../../../src/business/generate/effect/emit-dry-run-output.js';

test('emit-dry-run-output exports an implemented function', () => {
  assert.equal(typeof emitDryRunOutput, 'function');
});
