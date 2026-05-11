/**
 * WHAT: Unit coverage for generated function emit-dispatch-cli-command-started.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDispatchCliCommandStarted } from '../../../../src/business/telemetry/effect/emit-dispatch-cli-command-started.js';

test('emit-dispatch-cli-command-started exports an implemented function', () => {
  assert.equal(typeof emitDispatchCliCommandStarted, 'function');
});
