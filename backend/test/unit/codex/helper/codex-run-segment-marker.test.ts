import test from 'node:test';
import assert from 'node:assert/strict';
import { codexRunSegmentMarker, latestCodexSessionStartedAtMs } from '@backend/business/codex/helper/codex-run-segment-marker.js';

test('Codex session timing ignores continuations and resets for an explicit new session', () => {
  const marker = (startedAt: string, segment: 'start' | 'continue' | 'restart') => codexRunSegmentMarker({
    runId: 'run-a',
    startedAt,
    segment,
  });
  const originalSession = marker('2026-07-14T10:02:00.000Z', 'start')
    + marker('2026-07-14T10:12:00.000Z', 'continue');
  assert.equal(latestCodexSessionStartedAtMs({ log: originalSession, runId: 'run-a' }), Date.parse('2026-07-14T10:02:00.000Z'));

  const replacedSession = originalSession
    + marker('2026-07-14T10:22:00.000Z', 'restart')
    + marker('2026-07-14T10:32:00.000Z', 'continue');
  assert.equal(latestCodexSessionStartedAtMs({ log: replacedSession, runId: 'run-a' }), Date.parse('2026-07-14T10:22:00.000Z'));
});
