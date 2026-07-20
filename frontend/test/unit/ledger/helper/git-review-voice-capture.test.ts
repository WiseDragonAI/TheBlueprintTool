import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../../../src/runtime/state.js';
import { startGitReviewVoiceCapture } from '../../../../src/runtime/ledger/helper/git-review-voice-capture.js';
import { acquireVoiceCaptureOwnership, currentVoiceCaptureOwner } from '../../../../src/runtime/voice/helper/voice-capture-ownership.js';

test('Git review capture leaves the singleton thread voice state untouched', async () => {
  const originals = {
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    AudioContext: Object.getOwnPropertyDescriptor(globalThis, 'AudioContext'),
    MediaRecorder: Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder'),
    requestAnimationFrame: Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame'),
    cancelAnimationFrame: Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame'),
  };
  const threadVoiceState = { recording: false, transcriptionStatus: 'idle', marker: 'thread-owned' };
  state.voice = threadVoiceState;

  class FakeRecorder extends EventTarget {
    state = 'inactive';
    mimeType = 'audio/webm';
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      const data = new Event('dataavailable') as Event & { data?: Blob };
      data.data = new Blob(['audio'], { type: this.mimeType });
      this.dispatchEvent(data);
      this.dispatchEvent(new Event('stop'));
    }
  }
  const track = { stop() {} };
  class FakeAudioContext {
    state = 'running';
    createAnalyser() { return { fftSize: 128, getByteTimeDomainData(samples: Uint8Array) { samples.fill(128); } }; }
    createMediaStreamSource() { return { connect() {} }; }
    async resume() {}
    async close() {}
  }

  Object.defineProperties(globalThis, {
    navigator: { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } } },
    AudioContext: { configurable: true, value: FakeAudioContext },
    MediaRecorder: { configurable: true, value: FakeRecorder },
    requestAnimationFrame: { configurable: true, value: () => 1 },
    cancelAnimationFrame: { configurable: true, value: () => undefined },
  });

  try {
    const owner = 'git-review:card-a:file-a' as const;
    const capture = await startGitReviewVoiceCapture(owner, () => undefined);
    assert.equal(state.voice, threadVoiceState);
    assert.equal(currentVoiceCaptureOwner(), owner);
    assert.equal(acquireVoiceCaptureOwnership('thread'), false);
    const audio = await capture.stop();
    assert.equal(audio.size, 5);
    assert.equal(state.voice, threadVoiceState);
    assert.equal(currentVoiceCaptureOwner(), null);
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
});
