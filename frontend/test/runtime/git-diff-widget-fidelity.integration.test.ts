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
  assert.match(widget, /paintVoiceWaveLevel\(voice, level, true, samples, level\)/);
  assert.match(widget, /registerGitReviewWidgetDisposal/);
  assert.match(widget, /voiceCapture\?\.cancel\(\)/);
  assert.match(widget, /requestController\.abort\(\)/);
  assert.match(widget, /\/api\/git-review\/voice/);
  assert.doesNotMatch(widget, /startVoiceRecording|stopVoiceRecording|cancelVoiceRecording|state\.voice/);
  assert.doesNotMatch(widget, /class="voice-panel"|class="voice-status"/);
  assert.doesNotMatch(widget, /key:\s*'X'|key === 'x'|terminal-button__key">X/);
  assert.match(recording, /VoiceRecordingContext/);
  assert.match(recording, /surfaceRoot/);
});

test('Git review waveform and capture identities are instance-owned', () => {
  const waveform = source('src/runtime/voice/component/wave-svg.ts');
  const ownership = source('src/runtime/voice/helper/voice-capture-ownership.ts');

  assert.match(waveform, /voice-wave-/);
  assert.doesNotMatch(waveform, /id="waveAreaGradient"|id="waveCoreGradient"/);
  assert.match(ownership, /VoiceCaptureLease/);
  assert.match(ownership, /if \(activeLease\) return null/);
  assert.match(ownership, /activeLease !== lease/);
});

test('thread voice rendering resolves every dynamic control from its selected voice panel', () => {
  const renderer = source('src/runtime/voice/effect/render-voice-status.ts');

  assert.match(renderer, /const panel = surface\.querySelector\('\.voice-panel'\)/);
  assert.match(renderer, /panel\?\.querySelector\('\.meter-fill'\)/);
  assert.match(renderer, /panel\?\.querySelector\('\.wave-timer'\)/);
  assert.doesNotMatch(renderer, /surface\.querySelector\('\.meter-fill'\)/);
});

test('Git review microphone ownership blocks the global X command without opening the thread', () => {
  const desktopKeyboard = source('src/runtime/input/controller/handle-keyboard.ts');
  const responsiveKeyboard = source('src/app/responsive/thread.js');

  assert.match(desktopKeyboard, /currentVoiceCaptureOwner\(\)\?\.startsWith\('git-review:'\)/);
  assert.match(responsiveKeyboard, /currentVoiceCaptureOwner\(\)\?\.startsWith\('git-review:'\)/);
});
