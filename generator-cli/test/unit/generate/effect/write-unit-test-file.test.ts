/**
 * WHAT: Unit coverage for generated function write-unit-test-file.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeUnitTestFile } from '../../../../src/business/generate/effect/write-unit-test-file.js';

test('write-unit-test-file exports an implemented function', () => {
  assert.equal(typeof writeUnitTestFile, 'function');
});
