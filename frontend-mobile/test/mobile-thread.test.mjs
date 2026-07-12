import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/mobile-thread.js', import.meta.url), 'utf8');

test('mobile thread launch continues an owned terminal Codex run', () => {
  assert.match(source, /cardCodexThreadRunId\(currentCard\)/);
  assert.match(source, /requestCardSkillRunStatus\(/);
  assert.match(source, /if \(summary\.status === 'running'\) return/);
  assert.match(source, /requestCardSkillRunContinue\(\{/);
  assert.match(source, /runId: existingRunId/);
  assert.match(source, /resumeExternallyStartedCardSkillRun\(\{ ledgerId: currentLedgerId, cardId: String\(currentCard\.id\), runId: existingRunId \}\)/);
  assert.match(source, /function hydrateRunningThreadRun\(runId, startedAt\)/);
  assert.match(source, /canvasState\.threadRunSummaryByThreadId\[threadId\] = \{/);
  assert.match(source, /status: 'running'/);
  assert.match(source, /hydrateRunningThreadRun\(existingRunId, continuedAt\);[\s\S]*await refreshThreadLedger\(\)/);
  assert.match(source, /bindThreadCodexRunLog\([^;]+runId \}\);\n  hydrateRunningThreadRun\(runId, startedAt\);[\s\S]*await refreshThreadLedger\(\)/);
});
