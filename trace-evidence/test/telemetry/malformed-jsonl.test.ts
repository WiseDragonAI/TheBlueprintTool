import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTelemetryJsonl } from '../../src/business/evidence/helper/parse-telemetry-jsonl.js';

test('retains malformed telemetry location without normalizing its bytes', () => {
  const valid = JSON.stringify({ schemaVersion: 1, eventId: 'event-1', scopeId: 'scope-1', rawStack: 'Error' });
  const text = `not-json\n${valid}\n`;
  const parsed = parseTelemetryJsonl({ artifact: '/trace/telemetry.jsonl', text });
  assert.equal(parsed.events.length, 1);
  assert.deepEqual(parsed.failures.map(({ message: _message, ...failure }) => failure), [{ artifact: '/trace/telemetry.jsonl', line: 1, byteOffset: 0, code: 'malformed_jsonl' }]);
  assert.equal(text, `not-json\n${valid}\n`);
});
