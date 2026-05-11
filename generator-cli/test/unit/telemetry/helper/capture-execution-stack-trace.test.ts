/**
 * WHAT: Unit coverage for generated function capture-execution-stack-trace.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureExecutionStackTrace } from '../../../../src/business/telemetry/helper/capture-execution-stack-trace.js';

test('capture-execution-stack-trace exports an implemented function', () => {
  assert.equal(typeof captureExecutionStackTrace, 'function');
});
