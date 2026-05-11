/**
 * WHAT: Unit coverage for generated function write-source-file.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeSourceFile } from '../../../../src/business/generate/effect/write-source-file.js';

test('write-source-file exports an implemented function', () => {
  assert.equal(typeof writeSourceFile, 'function');
});
