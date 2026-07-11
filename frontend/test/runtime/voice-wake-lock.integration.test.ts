/**
 * WHAT: Verifies the screen wake-lock lifecycle used by voice capture.
 * WHY: A phone must stay awake only for the duration of an active recording.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  holdVoiceRecordingWakeLock,
  releaseVoiceRecordingWakeLock
} from '../../src/runtime/voice/effect/hold-voice-recording-wake-lock.js';

test('voice recording acquires and releases a screen wake lock', async () => {
  const previousNavigator = globalThis.navigator;
  let requested = '';
  let releases = 0;
  const sentinel = {
    released: false,
    async release() {
      this.released = true;
      releases += 1;
    }
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { wakeLock: { async request(type: string) { requested = type; return sentinel; } } }
  });

  try {
    await holdVoiceRecordingWakeLock();
    assert.equal(requested, 'screen');
    releaseVoiceRecordingWakeLock();
    await Promise.resolve();
    assert.equal(releases, 1);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator });
  }
});
