/**
 * WHAT: Unit coverage for generated function verify-typescript-project-rejected.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypescriptProjectRejected } from '../../../../src/business/telemetry/effect/verify-typescript-project-rejected.js';

test('verify-typescript-project-rejected exports an implemented function', () => {
  assert.equal(typeof verifyTypescriptProjectRejected, 'function');
});
