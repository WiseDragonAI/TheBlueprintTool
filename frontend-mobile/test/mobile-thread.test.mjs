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
  assert.equal(source.match(/syncThreadCodexRunControls\(\{ threadId: canvasState\.threadId, running: true \}\)/g)?.length, 2);
});
