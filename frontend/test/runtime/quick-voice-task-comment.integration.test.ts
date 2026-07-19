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

test('quick voice stop queues Codex and returns to the canonical Exec route after acceptance', () => {
  const thread = source('frontend/src/app/responsive/thread.js');
  const application = source('frontend/src/app/responsive/application.js');

  assert.match(thread, /openMobileThread\(currentCard[\s\S]*await startVoiceRecording\(\)/);
  assert.match(thread, /const selectedLaunchMode = wasQuickVoiceCapture \? 'run' : launchMode;/);
  assert.match(thread, /stopVoiceRecording\(\{ launchMode: selectedLaunchMode \}\)/);
  assert.match(thread, /await finishQueuedVoiceSubmission\(submitted\)/);
  assert.match(thread, /if \(!submitted\) return;[\s\S]*await onQuickVoiceSubmitted\(\)/);
  assert.doesNotMatch(thread.match(/async function finishQueuedVoiceSubmission\(submitted\) \{[\s\S]*?\n\}/)?.[0] ?? '', /closeMobileThread\(\)/);
  assert.match(application, /onQuickVoiceSubmitted: navigateVoiceSubmission/);
  assert.match(thread, /canvasState\.projectId = currentProjectId;/);
  assert.match(thread, /existingRunId = String\(button\.dataset\.codexRunId \|\| cardCodexThreadRunId\(currentCard\)\)/);
  assert.match(thread, /existingRunId[\s\S]*requestCardSkillRunContinue\(\{/);
  assert.match(thread, /threadSelectedRunIdByThreadId\[canvasState\.threadId\] = runId/);
});

test('desktop Shift+X navigates to Exec after durable local persistence', () => {
  const thread = source('frontend/src/app/responsive/thread.js');
  const shortcut = thread.match(/export async function handleResponsiveThreadShortcut\(event\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(shortcut, /const launchMode = event\.ctrlKey \? 'pipeline' : event\.shiftKey \? 'run' : 'send';/);
  assert.match(shortcut, /if \(launchMode === 'send'\) await stopVoiceRecording\(\{ launchMode \}\);/);
  assert.match(shortcut, /else void stopVoiceRecording\(\{[\s\S]*launchMode,[\s\S]*onPersisted: \(\) => void finishQueuedVoiceSubmission\(true\)/);
  assert.doesNotMatch(shortcut, /else await stopVoiceRecording|const submitted = await stopVoiceRecording/);
});

test('persisted voice navigation returns directly without an animated handoff', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const styles = source('frontend/assets/application.css');

  assert.match(application, /async function navigateVoiceSubmission\(\)/);
  assert.match(application, /return navigate\(controlRoomPath\('exec'\), true\)/);
  assert.doesNotMatch(application, /data\.voiceHandoff|startViewTransition\(\(\) => navigate\(destination, true\)\)/);
  assert.doesNotMatch(styles, /voice-handoff/);
});
