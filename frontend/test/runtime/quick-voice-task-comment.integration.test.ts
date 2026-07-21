import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('task details expose the quick voice action only for master cards and relationship-owned subtasks', () => {
  const markup = source('frontend/index.html');
  const thread = source('frontend/src/app/responsive/thread.js');
  const application = source('frontend/src/app/responsive/application.js');
  const styles = source('frontend/assets/application.css');

  assert.match(markup, /quick-voice-comment-button[\s\S]*aria-label="Record a voice comment"/);
  assert.doesNotMatch(markup, /quick-voice-comment-button[\s\S]*Record a voice comment and queue Codex/);
  assert.match(application, /String\(relationship\.to\) === String\(card\.id\) && relationship\.label === 'subtask'/);
  assert.match(application, /setMobileThreadCard\(card, \{ subtask \}\)/);
  assert.match(thread, /hidden = !labels\.includes\('master-task'\) && !subtask/);
  assert.doesNotMatch(thread, /labels[\s\S]*['"]subtask['"]/);
  assert.match(styles, /\.quick-voice-comment-button\s*\{[\s\S]*position:\s*fixed;[\s\S]*right:\s*max\(18px, env\(safe-area-inset-right\)\);[\s\S]*bottom:\s*max\(18px, env\(safe-area-inset-bottom\)\)/);
});

test('quick voice stop preserves explicit actions and hands run off after durable persistence', () => {
  const thread = source('frontend/src/app/responsive/thread.js');
  const application = source('frontend/src/app/responsive/application.js');

  assert.match(thread, /openMobileThread\(currentCard[\s\S]*await startVoiceRecording\(\)/);
  assert.match(thread, /action === 'voice-stop'\) await stopQuickVoiceComment\(button\.dataset\.launchMode \|\| 'send'\)/);
  assert.match(thread, /executeVoiceAction\(\{[\s\S]*launchMode: parseVoiceLaunchMode\(launchMode\)/);
  assert.doesNotMatch(thread, /quickVoiceCapture \? 'run' : launchMode/);
  assert.match(thread, /onDurableHandoff: \(\) => \{[\s\S]*void finishQueuedVoiceSubmission\(true\)/);
  assert.match(thread, /if \(launchMode === 'send'\) resetCapture\(\)/);
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
  const application = source('frontend/src/app/responsive/application.js');
  const shortcut = thread.match(/export async function handleResponsiveThreadShortcut\(event\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(shortcut, /const launchMode = voiceLaunchModeForModifiers\(event\);/);
  assert.match(shortcut, /await executeVoiceAction\(\{[\s\S]*launchMode,[\s\S]*onDurableHandoff: \(\) => void finishQueuedVoiceSubmission\(true\)/);
  assert.doesNotMatch(shortcut, /stopVoiceRecording/);
  assert.match(application, /executionStatus: 'waiting', codexStatus: 'waiting'/);
  assert.match(application, /optimisticExecutionIntents\.set\(taskIdentity\(task\), waiting\)/);
  assert.match(application, /nextControlRoom\.exec = \[\{ \.\.\.task, \.\.\.intent \}, \.\.\.\(nextControlRoom\.exec \?\? \[\]\)\]/);
});

test('persisted voice navigation returns directly without an animated handoff', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const styles = source('frontend/assets/application.css');

  assert.match(application, /async function navigateVoiceSubmission\(\)/);
  assert.match(application, /return navigate\(controlRoomPath\('exec'\), true\)/);
  assert.doesNotMatch(application, /data\.voiceHandoff|startViewTransition\(\(\) => navigate\(destination, true\)\)/);
  assert.doesNotMatch(styles, /voice-handoff/);
});
