import assert from 'node:assert/strict';
import test from 'node:test';
import { codexRunDurationLabel, liveCodexRunElapsedMs } from '../../../../src/runtime/codex/helper/live-codex-run-elapsed-ms.js';

test('live Codex elapsed time advances from startedAt while a run is active', () => {
  const timing = { status: 'running', startedAt: '2026-07-10T12:00:00.000Z', elapsedMs: 0 };
  assert.equal(liveCodexRunElapsedMs(timing, Date.parse('2026-07-10T12:00:05.250Z')), 5250);
  assert.equal(codexRunDurationLabel(liveCodexRunElapsedMs(timing, Date.parse('2026-07-10T12:00:05.250Z'))), '00:05');
});

test('terminal Codex elapsed time stays fixed at the server duration', () => {
  const timing = { status: 'complete', startedAt: '2026-07-10T12:00:00.000Z', elapsedMs: 5250 };
  assert.equal(liveCodexRunElapsedMs(timing, Date.parse('2026-07-10T12:10:00.000Z')), 5250);
  assert.equal(codexRunDurationLabel(3_605_000), '1:00:05');
});
