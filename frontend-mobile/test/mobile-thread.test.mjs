import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/mobile-thread.js', import.meta.url), 'utf8');
const { expandMobileThreadComposer } = await import('../src/mobile-thread-composer.js');

test('mobile Text action expands and focuses the shared thread composer', () => {
  const classNames = new Set(['terminal-composer', 'is-mobile-text-collapsed']);
  let focused = false;
  const draft = { focus() { focused = true; } };
  const composer = {
    classList: { remove(value) { classNames.delete(value); } },
    querySelector(selector) { return selector === '.thread-draft' ? draft : null; }
  };
  const attributes = new Map();
  const button = {
    closest(selector) { return selector === '.terminal-composer' ? composer : null; },
    setAttribute(name, value) { attributes.set(name, value); }
  };

  assert.equal(expandMobileThreadComposer(button), true);
  assert.equal(classNames.has('is-mobile-text-collapsed'), false);
  assert.equal(attributes.get('aria-expanded'), 'true');
  assert.equal(focused, true);
  assert.match(source, /action === 'toggle-thread-text'\) expandMobileThreadComposer\(button\)/);
  assert.match(source, /action === 'submit-thread-draft'\) await appendTextNote\(\)/);
});

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
