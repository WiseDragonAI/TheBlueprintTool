import test from 'node:test';
import assert from 'node:assert/strict';
import { correlateEvidence } from '../../src/business/correlation/helper/correlate-evidence.js';
import type { RawTelemetryEvent } from '../../src/lib/types.js';

test('replaying finalized events produces byte-identical mechanical correlation', () => {
  const events = [{ eventId: 'b', sequence: 2, testId: 'test', cardId: null, executionId: null, sessionId: null, processId: 1 }, { eventId: 'a', sequence: 1, testId: 'test', cardId: null, executionId: null, sessionId: null, processId: 1 }] as RawTelemetryEvent[];
  assert.equal(JSON.stringify(correlateEvidence(events)), JSON.stringify(correlateEvidence(structuredClone(events))));
  assert.deepEqual(correlateEvidence(events).tests.test, ['a', 'b']);
});
