import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('every run-capable frontend entry point uses the canonical voice action controller', () => {
  const responsive = source('frontend/src/app/responsive/thread.js');
  const keyboard = source('frontend/src/runtime/input/controller/handle-keyboard.ts');
  const actions = source('frontend/src/runtime/input/controller/handle-action-click.ts');

  assert.match(responsive, /import \{ executeVoiceAction \} from '.*execute-voice-action\.js';/);
  assert.match(responsive, /handleResponsiveThreadShortcut[\s\S]*await executeVoiceAction\(\{/);
  assert.match(responsive, /stopQuickVoiceComment[\s\S]*await executeVoiceAction\(\{/);
  assert.doesNotMatch(responsive, /stopVoiceRecording/);

  assert.match(keyboard, /import \{ executeVoiceAction \} from '.*execute-voice-action\.js';/);
  assert.match(keyboard, /state\.voice\.recording\) await executeVoiceAction\(\{/);
  assert.doesNotMatch(keyboard, /stopVoiceRecording/);

  assert.match(actions, /import \{ executeVoiceAction \} from '.*execute-voice-action\.js';/);
  assert.match(actions, /action === 'voice-toggle'[\s\S]*await executeVoiceAction\(\{/);
  assert.match(actions, /action === 'voice-stop'[\s\S]*await executeVoiceAction\(\{/);
  assert.doesNotMatch(actions, /stopVoiceRecording/);
});

test('launch mode has one frontend type and one modifier resolver', () => {
  const files = [
    'frontend/src/app/responsive/thread.js',
    'frontend/src/runtime/input/controller/handle-keyboard.ts',
    'frontend/src/runtime/input/controller/handle-action-click.ts',
    'frontend/src/runtime/voice/component/control-dock.ts',
    'frontend/src/runtime/voice/controller/execute-voice-action.ts',
    'frontend/src/runtime/voice/controller/stop-voice-recording.ts',
    'frontend/src/runtime/voice/effect/request-transcription.ts',
    'frontend/src/runtime/voice/effect/upload-voice-audio.ts',
  ];
  const combined = files.map(source).join('\n');

  assert.doesNotMatch(combined, /event\.ctrlKey \? 'pipeline' : event\.shiftKey/);
  assert.doesNotMatch(combined, /'send' \| 'run' \| 'pipeline'/);
  assert.match(source('frontend/src/runtime/voice/helper/voice-launch-mode.ts'), /export type VoiceLaunchMode = 'send' \| 'run' \| 'pipeline';/);
});
