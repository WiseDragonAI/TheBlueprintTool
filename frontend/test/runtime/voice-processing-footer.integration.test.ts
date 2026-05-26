/**
 * WHAT: Runtime coverage for voice processing footer visibility.
 * WHY: upload/transcription progress must not keep the waveform recorder open after recording stops.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVoiceStatus } from '../../src/runtime/voice/effect/render-voice-status.js';
import { state } from '../../src/runtime/state.js';

test('transcribing voice status hides recorder and keeps text composer visible', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const status = { textContent: '' };
  const meter = { style: { height: '' } };
  const timer = { textContent: '' };
  const recorder = { hidden: false };
  const composer = { style: { display: '' } };
  const panel = {
    classList: {
      values: new Map<string, boolean>(),
      toggle(name: string, value?: boolean) {
        this.values.set(name, Boolean(value));
      }
    },
    querySelector(selector: string) {
      if (selector === '.wave-area-path' || selector === '.wave-core-path') return { setAttribute() {} };
      return null;
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.voice-status') return status;
      if (selector === '.meter-fill' || selector === '.voice-meter-value') return meter;
      if (selector === '.wave-timer') return timer;
      if (selector === '.voice-panel') return panel;
      if (selector === '.voice-recorder') return recorder;
      if (selector === '.terminal-composer') return composer;
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };

  try {
    state.voice = { recording: false, startedAt: 0, durationMs: 28000, level: 0.4, transcriptionStatus: 'transcribing' };
    renderVoiceStatus();
    assert.equal(recorder.hidden, true);
    assert.equal(status.textContent, 'transcribing');
    assert.equal(panel.classList.values.get('busy'), true);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  }
});
