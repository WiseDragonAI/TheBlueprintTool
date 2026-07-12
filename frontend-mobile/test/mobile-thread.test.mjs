import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/mobile-thread.js', import.meta.url), 'utf8');

test('opening a mobile thread does not focus the draft and raise the software keyboard', () => {
  const openMobileThread = source.match(/export function openMobileThread\([\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(openMobileThread, /renderThreadPanel\(\);/);
  assert.doesNotMatch(openMobileThread, /\.focus\(\)/);
});

test('mobile thread routes jump-to-bottom into persistent bottom following', () => {
  assert.match(source, /import \{ pinThreadFeedToLastMessage \} from '\/canvas-src\/runtime\/thread\/effect\/pin-thread-feed-to-last-message\.js';/);
  assert.match(source, /action === 'jump-thread-bottom'\) pinThreadFeedToLastMessage\(\{ follow: true \}\)/);
});

test('mobile thread launch continues a terminal or orphaned Codex run', () => {
  assert.match(source, /cardCodexThreadRunId\(currentCard\)/);
  assert.match(source, /requestCardSkillRunStatus\(/);
  assert.match(source, /if \(summary\.active\) return/);
  assert.doesNotMatch(source, /summary\.status === 'unknown'/);
  assert.match(source, /requestCardSkillRunContinue\(\{/);
  assert.match(source, /runId: existingRunId/);
  assert.match(source, /resumeExternallyStartedCardSkillRun\(\{ ledgerId: currentLedgerId, cardId: String\(currentCard\.id\), runId: existingRunId \}\)/);
  assert.match(source, /function hydrateRunningThreadRun\(runId, startedAt\)/);
  assert.match(source, /canvasState\.threadRunSummaryByThreadId\[threadId\] = \{/);
  assert.match(source, /status: 'running'/);
  assert.match(source, /hydrateRunningThreadRun\(existingRunId, continuedAt\);[\s\S]*await refreshThreadLedger\(\)/);
  assert.match(source, /bindThreadCodexRunLog\([^;]+runId \}\);\n  hydrateRunningThreadRun\(runId, startedAt\);[\s\S]*await refreshThreadLedger\(\)/);
});
