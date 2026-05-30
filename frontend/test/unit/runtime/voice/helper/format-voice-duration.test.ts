/**
 * WHAT: Unit coverage for compact voice duration formatting.
 * WHY: the waveform timer must roll seconds into minutes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatVoiceDuration } from '../../../../../src/runtime/voice/helper/format-voice-duration.js';

test('format-voice-duration rolls total seconds into minutes', () => {
  assert.equal(formatVoiceDuration(0), '00:00');
  assert.equal(formatVoiceDuration(59_900), '00:59');
  assert.equal(formatVoiceDuration(62_000), '01:02');
  assert.equal(formatVoiceDuration(102_000), '01:42');
});
