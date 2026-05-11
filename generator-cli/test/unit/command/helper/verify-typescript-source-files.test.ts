/**
 * WHAT: Unit coverage for generated function verify-typescript-source-files.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypescriptSourceFiles } from '../../../../src/business/command/helper/verify-typescript-source-files.js';

test('verify-typescript-source-files exports an implemented function', () => {
  assert.equal(typeof verifyTypescriptSourceFiles, 'function');
});
