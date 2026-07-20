import test from 'node:test';
import assert from 'node:assert/strict';
import { submitVoiceRecording } from '../../../../src/runtime/voice/controller/submit-voice-recording.js';

test('mobile run hands off after local persistence without awaiting upload settlement', async () => {
  const lifecycle: string[] = [];
  let settleUpload: (submitted: boolean) => void = () => {};
  const upload = new Promise<boolean>((resolve) => {
    settleUpload = resolve;
  });

  await submitVoiceRecording({
    launchMode: 'run',
    stop: async ({ onPersisted }) => {
      lifecycle.push('stop');
      onPersisted?.();
      lifecycle.push('upload');
      return upload;
    },
    onDurableHandoff: () => lifecycle.push('handoff'),
    onRejected: () => lifecycle.push('rejected'),
  });

  assert.deepEqual(lifecycle, ['stop', 'handoff', 'upload']);
  settleUpload(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(lifecycle, ['stop', 'handoff', 'upload']);
});

test('mobile run stays on the task when local persistence fails', async () => {
  const lifecycle: string[] = [];

  await submitVoiceRecording({
    launchMode: 'run',
    stop: async () => false,
    onDurableHandoff: () => lifecycle.push('handoff'),
    onRejected: () => lifecycle.push('rejected'),
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(lifecycle, ['rejected']);
});

test('mobile send waits for upload settlement and does not hand off', async () => {
  const lifecycle: string[] = [];

  await submitVoiceRecording({
    launchMode: 'send',
    stop: async ({ onPersisted }) => {
      assert.equal(onPersisted, undefined);
      lifecycle.push('settled');
      return true;
    },
    onDurableHandoff: () => lifecycle.push('handoff'),
    onRejected: () => lifecycle.push('rejected'),
  });

  assert.deepEqual(lifecycle, ['settled']);
});
