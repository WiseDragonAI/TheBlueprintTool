import test from 'node:test';
import assert from 'node:assert/strict';
import { codexRunTurnStartedMarker, isCodexRunMarkerLine, latestCodexRunTurnStartedAtMs } from '@backend/business/codex/helper/codex-run-segment-marker.js';

test('Codex turn markers persist the latest observed turn start', () => {
  const log = codexRunTurnStartedMarker({ runId: 'run-a', startedAt: '2026-07-14T10:02:04.000Z', line: 2 })
    + codexRunTurnStartedMarker({ runId: 'run-a', startedAt: '2026-07-14T10:12:04.000Z', line: 14 });
  assert.equal(latestCodexRunTurnStartedAtMs({ log, runId: 'run-a' }), Date.parse('2026-07-14T10:12:04.000Z'));
  assert.equal(isCodexRunMarkerLine(log.split('\n')[0]), true);
});
