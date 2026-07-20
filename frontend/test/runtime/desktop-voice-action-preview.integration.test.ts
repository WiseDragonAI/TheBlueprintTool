import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { voiceActionIcon } from '../../src/runtime/voice/component/control-dock.js';
import { updateDesktopVoiceActionPreview } from '../../src/runtime/voice/effect/update-desktop-voice-action-preview.js';
import { voiceLaunchModeForModifiers } from '../../src/runtime/voice/helper/voice-launch-mode.js';
import { state } from '../../src/runtime/state.js';

const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('desktop voice preview uses the same modifier precedence as the X action', () => {
  assert.equal(voiceLaunchModeForModifiers({}), 'send');
  assert.equal(voiceLaunchModeForModifiers({ shiftKey: true }), 'run');
  assert.equal(voiceLaunchModeForModifiers({ ctrlKey: true }), 'pipeline');
  assert.equal(voiceLaunchModeForModifiers({ ctrlKey: true, shiftKey: true }), 'pipeline');
});

test('desktop modifier changes update the mounted Send action in real time', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const icon = { outerHTML: voiceActionIcon('send') };
  const label = { textContent: 'SEND' };
  const button = {
    dataset: { launchMode: 'send' },
    querySelector(selector: string) {
      if (selector === '.terminal-button__icon') return icon;
      if (selector === '.terminal-button__label') return label;
      return null;
    }
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => button } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
  state.voice.recording = true;
  try {
    updateDesktopVoiceActionPreview({ shiftKey: true });
    assert.equal(button.dataset.launchMode, 'run');
    assert.equal(label.textContent, 'RUN');
    assert.match(icon.outerHTML, /M5 12h14/);

    updateDesktopVoiceActionPreview({ ctrlKey: true, shiftKey: true });
    assert.equal(button.dataset.launchMode, 'pipeline');
    assert.equal(label.textContent, 'PIPELINE');
    assert.match(icon.outerHTML, /M5 6h5v5H5z/);

    updateDesktopVoiceActionPreview();
    assert.equal(button.dataset.launchMode, 'send');
    assert.equal(label.textContent, 'SEND');
    assert.match(icon.outerHTML, /M4 12 20 4/);
  } finally {
    state.voice.recording = false;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('desktop voice preview updates only the action icon, label, and launch mode', () => {
  const preview = source('frontend/src/runtime/voice/effect/update-desktop-voice-action-preview.ts');
  const dock = source('frontend/src/runtime/voice/component/control-dock.ts');
  const inputs = source('frontend/src/runtime/input/effect/bind-inputs.ts');

  assert.match(preview, /button\.querySelector\('\.terminal-button__icon'\)/);
  assert.match(preview, /button\.querySelector\('\.terminal-button__label'\)/);
  assert.match(preview, /button\.dataset\.launchMode = mode/);
  assert.doesNotMatch(preview, /terminal-button__key/);
  assert.match(dock, /voiceActionIcon\('send'\)/);
  assert.match(dock, /voiceActionIcon\('run'\)/);
  assert.match(dock, /voiceActionIcon\('pipeline'\)/);
  assert.match(inputs, /bindDesktopVoiceActionPreview\(\)/);
  assert.match(preview, /addEventListener\('keydown', updateDesktopVoiceActionPreview\)/);
  assert.match(preview, /addEventListener\('keyup', updateDesktopVoiceActionPreview\)/);
  assert.match(preview, /addEventListener\('blur', \(\) => updateDesktopVoiceActionPreview\(\)\)/);
});

test('voice action icon renderer preserves the existing mobile icon paths', () => {
  assert.match(voiceActionIcon('send'), /M4 12 20 4l-5 16/);
  assert.match(voiceActionIcon('run'), /M5 12h14M13 6l6 6-6 6/);
  assert.match(voiceActionIcon('pipeline'), /M5 6h5v5H5zM14 13h5v5h-5z/);
});
