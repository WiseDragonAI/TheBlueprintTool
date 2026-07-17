import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('task details expose the quick voice action only for master tasks and subtasks', () => {
  const markup = source('frontend/index.html');
  const thread = source('frontend/src/app/responsive/thread.js');
  const styles = source('frontend/assets/application.css');

  assert.match(markup, /quick-voice-comment-button[\s\S]*Record a voice comment and queue Codex/);
  assert.match(thread, /label === 'master-task' \|\| label === 'subtask'/);
  assert.match(thread, /quick-voice-comment-button'\)\.hidden = !labels\.some/);
  assert.match(styles, /\.quick-voice-comment-button\s*\{[\s\S]*position:\s*fixed;[\s\S]*right:\s*max\(18px, env\(safe-area-inset-right\)\);[\s\S]*bottom:\s*max\(18px, env\(safe-area-inset-bottom\)\)/);
});

test('quick voice stop queues Codex and returns to the canonical Queue route after acceptance', () => {
  const thread = source('frontend/src/app/responsive/thread.js');
  const application = source('frontend/src/app/responsive/application.js');

  assert.match(thread, /openMobileThread\(currentCard[\s\S]*await startVoiceRecording\(\)/);
  assert.match(thread, /stopVoiceRecording\(\{ queueCodex: quickVoiceCapture \|\| event\.shiftKey \}\)/);
  assert.match(thread, /await finishQueuedVoiceSubmission\(submitted\)/);
  assert.match(thread, /if \(!submitted\) return;[\s\S]*closeMobileThread\(\);[\s\S]*await onQuickVoiceSubmitted\(\)/);
  assert.match(application, /onQuickVoiceSubmitted: navigateVoiceSubmission/);
});

test('desktop Shift+X uses the accepted quick voice handoff while normal X stays on the card', () => {
  const thread = source('frontend/src/app/responsive/thread.js');
  const shortcut = thread.match(/export async function handleResponsiveThreadShortcut\(event\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(shortcut, /const queueCodex = event\.shiftKey;/);
  assert.match(shortcut, /stopVoiceRecording\(\{ queueCodex \}\)/);
  assert.match(shortcut, /if \(queueCodex\) await finishQueuedVoiceSubmission\(submitted\)/);
  assert.doesNotMatch(shortcut, /if \(!queueCodex\) await finishQueuedVoiceSubmission/);
});

test('accepted voice navigation uses a reduced-motion-safe view transition', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const styles = source('frontend/assets/application.css');

  assert.match(application, /async function navigateVoiceSubmission\(\)/);
  assert.match(application, /prefers-reduced-motion: reduce/);
  assert.match(application, /document\.startViewTransition\(\(\) => navigate\(destination, true\)\)/);
  assert.match(application, /await transition\.finished/);
  assert.match(styles, /html\[data-voice-handoff="true"\]::view-transition-old\(root\)/);
  assert.match(styles, /html\[data-voice-handoff="true"\]::view-transition-new\(root\)/);
  assert.match(styles, /@keyframes voice-handoff-out/);
  assert.match(styles, /@keyframes voice-handoff-in/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*data-voice-handoff="true"[\s\S]*animation: none/);
});
