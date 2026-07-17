import test from 'node:test';
import assert from 'node:assert/strict';
import { codexRunExecutions, codexRunSegmentMarker, codexRunTurnStartedMarker, isCodexRunMarkerLine, latestCodexRunTurnStartedAtMs } from '@backend/business/codex/helper/codex-run-segment-marker.js';

test('Codex turn markers persist the latest observed turn start', () => {
  const log = codexRunTurnStartedMarker({ runId: 'run-a', startedAt: '2026-07-14T10:02:04.000Z', line: 2 })
    + codexRunTurnStartedMarker({ runId: 'run-a', startedAt: '2026-07-14T10:12:04.000Z', line: 14 });
  assert.equal(latestCodexRunTurnStartedAtMs({ log, runId: 'run-a' }), Date.parse('2026-07-14T10:12:04.000Z'));
  assert.equal(isCodexRunMarkerLine(log.split('\n')[0]), true);
});

test('projects immutable execution identities across one append-only session', () => {
  const runId = 'run-a';
  const log = codexRunSegmentMarker({ runId, executionId: 'execution-a', startedAt: '2026-07-14T10:00:00.000Z', segment: 'start', startLine: 0 })
    + codexRunTurnStartedMarker({ runId, executionId: 'execution-a', startedAt: '2026-07-14T10:00:02.000Z', line: 2 })
    + codexRunSegmentMarker({ runId, executionId: 'execution-b', startedAt: '2026-07-14T11:00:00.000Z', segment: 'continue', startLine: 8 })
    + codexRunTurnStartedMarker({ runId, executionId: 'execution-b', startedAt: '2026-07-14T11:00:03.000Z', line: 10 });

  assert.deepEqual(codexRunExecutions({ log, runId }).map((execution) => ({
    executionId: execution.executionId,
    segment: execution.segment,
    startLine: execution.startLine,
    turnStartLine: execution.turnStartLine,
  })), [
    { executionId: 'execution-a', segment: 'start', startLine: 0, turnStartLine: 2 },
    { executionId: 'execution-b', segment: 'continue', startLine: 8, turnStartLine: 10 },
  ]);
});
