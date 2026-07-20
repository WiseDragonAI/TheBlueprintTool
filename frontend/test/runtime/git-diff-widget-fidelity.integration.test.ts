import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('Git diff card widget uses shared controls without entering the thread voice lifecycle', () => {
  const widget = source('src/runtime/ledger/component/render-ledger-card-git-diff.ts');
  const recording = source('src/runtime/voice/controller/start-voice-recording.ts');

  assert.match(widget, /createPierreDiffContainer\(pierre\)/);
  assert.match(widget, /terminal-button--send terminal-button--action/);
  assert.doesNotMatch(widget, /git-diff-button/);
  assert.match(widget, /startGitReviewVoiceCapture/);
  assert.match(widget, /\/api\/git-review\/voice/);
  assert.doesNotMatch(widget, /startVoiceRecording|stopVoiceRecording|cancelVoiceRecording|state\.voice/);
  assert.doesNotMatch(widget, /class="voice-panel"|class="voice-status"/);
  assert.doesNotMatch(widget, /key:\s*'X'|key === 'x'|terminal-button__key">X/);
  assert.match(recording, /VoiceRecordingContext/);
  assert.match(recording, /surfaceRoot/);
});

test('Git review microphone ownership blocks the global X command without opening the thread', () => {
  const desktopKeyboard = source('src/runtime/input/controller/handle-keyboard.ts');
  const responsiveKeyboard = source('src/app/responsive/thread.js');

  assert.match(desktopKeyboard, /currentVoiceCaptureOwner\(\)\?\.startsWith\('git-review:'\)/);
  assert.match(responsiveKeyboard, /currentVoiceCaptureOwner\(\)\?\.startsWith\('git-review:'\)/);
});
