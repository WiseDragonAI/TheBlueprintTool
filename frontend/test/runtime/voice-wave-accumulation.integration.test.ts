/**
 * WHAT: Runtime tests for accumulated voice waveform rendering.
 * WHY: The terminal graph should represent the full recording envelope, not a recent rolling window.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { downsampleWaveSamples } from '../../src/runtime/voice/helper/downsample-wave-samples.js';

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
