import assert from 'node:assert/strict';
import test from 'node:test';
import { telemetry, traces } from '@backend/telemetry/harness.js';

test('telemetry retention is bounded and console failures do not escape', () => {
  const originalLog = console.log;
  const originalStdoutSetting = process.env.DECISION_OS_TELEMETRY_STDOUT;
  process.env.DECISION_OS_TELEMETRY_STDOUT = '1';
  console.log = () => { throw new Error('transport unavailable'); };
  try {
    traces.splice(0);
    assert.doesNotThrow(() => {
      for (let index = 0; index < 2_010; index += 1) telemetry('bounded-trace', { index });
    });
    assert.equal(traces.length, 2_000);
    assert.deepEqual(traces[0]?.args, { index: 10 });
    assert.deepEqual(traces.at(-1)?.args, { index: 2_009 });
  } finally {
    console.log = originalLog;
    if (originalStdoutSetting === undefined) delete process.env.DECISION_OS_TELEMETRY_STDOUT;
    else process.env.DECISION_OS_TELEMETRY_STDOUT = originalStdoutSetting;
    traces.splice(0);
  }
});
