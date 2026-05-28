/**
 * WHAT: Runtime tests for accumulated voice waveform rendering.
 * WHY: The terminal graph should represent the full recording envelope, not a recent rolling window.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { downsampleWaveSamples } from '../../src/runtime/voice/helper/downsample-wave-samples.js';
import { calculateVoiceLevel } from '../../src/runtime/voice/helper/calculate-voice-level.js';
import { interpolateVoiceLevel, voiceValueFrameMs } from '../../src/runtime/voice/helper/interpolate-voice-level.js';
import { normalizeVoiceLevels } from '../../src/runtime/voice/helper/normalize-voice-levels.js';
import { buildWavePath } from '../../src/runtime/voice/helper/build-wave-path.js';

const root = new URL('../../../', import.meta.url);

test('voice waveform preserves full recording peaks when compressed', () => {
  const samples = [0.8, ...Array.from({ length: 400 }, () => 0.02), 0.6];
  const visible = downsampleWaveSamples(samples, 40);
  assert.equal(visible.length, 40);
  assert.ok(visible.includes(0.8));
  assert.ok(visible.includes(0.6));
});

test('voice waveform painter does not use a rolling shifted buffer', () => {
  const painter = readFileSync(new URL('frontend/src/runtime/voice/effect/paint-voice-wave-level.ts', root), 'utf8');
  const frame = readFileSync(new URL('frontend/src/runtime/voice/effect/update-voice-recording-frame.ts', root), 'utf8');
  assert.match(painter, /downsampleWaveSamples/);
  assert.doesNotMatch(painter, /\.shift\(\)/);
  assert.match(frame, /waveSamples\.push/);
});

test('voice values tick at 30 fps while render remains requestAnimationFrame driven', () => {
  const frame = readFileSync(new URL('frontend/src/runtime/voice/effect/update-voice-recording-frame.ts', root), 'utf8');
  const stop = readFileSync(new URL('frontend/src/runtime/voice/controller/stop-voice-recording.ts', root), 'utf8');
  assert.ok(Math.abs(voiceValueFrameMs - (1000 / 30)) < 0.000001);
  assert.match(frame, /voiceValueFrameMs/);
  assert.match(frame, /pendingVoicePeak/);
  assert.match(frame, /renderVoiceStatus\(\);\s*\n\s*state\.voice\.animationFrameId = requestAnimationFrame/);
  assert.match(stop, /pendingVoicePeak/);
  assert.match(stop, /waveSamples\.push\(pendingPeak\)/);
});

test('voice level calculation preserves quiet input without a threshold gate', () => {
  const quiet = calculateVoiceLevel(new Float32Array([0.004, -0.004, 0.004, -0.004]));
  const louder = calculateVoiceLevel(new Float32Array([0.08, -0.08, 0.08, -0.08]));
  assert.ok(quiet > 0);
  assert.ok(quiet < louder);
});

test('voice capture path disables browser noise gates and visual smoothing', () => {
  const start = readFileSync(new URL('frontend/src/runtime/voice/controller/start-voice-recording.ts', root), 'utf8');
  const controlsCss = readFileSync(new URL('frontend/assets/canvas/terminal-chat-controls.css', root), 'utf8');
  assert.match(start, /noiseSuppression:\s*false/);
  assert.match(start, /autoGainControl:\s*false/);
  assert.match(start, /smoothingTimeConstant\s*=\s*0/);
  assert.match(start, /createScriptProcessor\(1024/);
  assert.match(controlsCss, /wave-core-path\s*{[\s\S]*transition:\s*none/);
  assert.match(controlsCss, /meter-fill[\s\S]*transition:\s*none/);
});

test('voice visualization rescales the observed recording peak to 1.0', () => {
  const normalized = normalizeVoiceLevels([0.01, 0.03, 0.015], 0.015);
  assert.deepEqual(normalized.samples, [0.33333333333333337, 1, 0.5]);
  assert.equal(normalized.level, 0.5);
  assert.equal(normalized.peak, 0.03);
});

test('voice waveform peak fills 95 percent of the graph height', () => {
  assert.match(buildWavePath([1], 1), /L0 5\.0 L1000 5\.0/);
});

test('voice gauge interpolates between committed 30 fps value changes', () => {
  assert.ok(Math.abs(interpolateVoiceLevel({ from: 0.2, to: 1, startedAt: 1000, now: 1000 + (voiceValueFrameMs / 2) }) - 0.6) < 0.000001);
  assert.ok(Math.abs(interpolateVoiceLevel({ from: 0.2, to: 1, startedAt: 1000, now: 1000 + voiceValueFrameMs }) - 1) < 0.000001);
});
