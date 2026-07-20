import test from 'node:test';
import assert from 'node:assert/strict';
import { executeVoiceAction } from '../../../../src/runtime/voice/controller/execute-voice-action.js';
import { parseVoiceLaunchMode, voiceLaunchModeForModifiers } from '../../../../src/runtime/voice/helper/voice-launch-mode.js';

const runEntryPoints = [
  'responsive keyboard',
  'responsive quick action',
  'canvas keyboard',
  'canvas voice toggle',
  'canvas action dock',
];

for (const entryPoint of runEntryPoints) {
  test(`${entryPoint} run hands off after local persistence without awaiting upload`, async () => {
    const lifecycle: string[] = [];
    let settleUpload: (submitted: boolean) => void = () => {};
    const upload = new Promise<boolean>((resolve) => { settleUpload = resolve; });

    await executeVoiceAction({
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
}

test('run rejects the surface handoff when local persistence fails', async () => {
  const lifecycle: string[] = [];

  await executeVoiceAction({
    launchMode: 'run',
    stop: async () => false,
    onDurableHandoff: () => lifecycle.push('handoff'),
    onRejected: () => lifecycle.push('rejected'),
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(lifecycle, ['rejected']);
});

test('send waits for upload settlement and never performs a durable handoff', async () => {
  const lifecycle: string[] = [];

  const submitted = await executeVoiceAction({
    launchMode: 'send',
    stop: async ({ onPersisted }) => {
      assert.equal(onPersisted, undefined);
      lifecycle.push('settled');
      return true;
    },
    onDurableHandoff: () => lifecycle.push('handoff'),
  });

  assert.equal(submitted, true);
  assert.deepEqual(lifecycle, ['settled']);
});

test('all voice surfaces share modifier precedence and strict data-mode parsing', () => {
  assert.equal(voiceLaunchModeForModifiers({}), 'send');
  assert.equal(voiceLaunchModeForModifiers({ shiftKey: true }), 'run');
  assert.equal(voiceLaunchModeForModifiers({ ctrlKey: true }), 'pipeline');
  assert.equal(voiceLaunchModeForModifiers({ ctrlKey: true, shiftKey: true }), 'pipeline');
  assert.equal(parseVoiceLaunchMode('run'), 'run');
  assert.equal(parseVoiceLaunchMode('pipeline'), 'pipeline');
  assert.equal(parseVoiceLaunchMode('invalid'), 'send');
});
