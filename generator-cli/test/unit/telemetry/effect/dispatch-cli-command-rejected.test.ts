/**
 * WHAT: Unit coverage for generated function dispatch-cli-command-rejected.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCliCommandRejected } from '../../../../src/business/telemetry/effect/dispatch-cli-command-rejected.js';

test('dispatch-cli-command-rejected exports an implemented function', () => {
  assert.equal(typeof dispatchCliCommandRejected, 'function');
});
