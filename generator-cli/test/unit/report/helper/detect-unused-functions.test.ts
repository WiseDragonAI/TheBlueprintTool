/**
 * WHAT: Unit coverage for generated function detect-unused-functions.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectUnusedFunctions } from '../../../../src/business/report/helper/detect-unused-functions.js';

test('detect-unused-functions exports an implemented function', () => {
  assert.equal(typeof detectUnusedFunctions, 'function');
});
