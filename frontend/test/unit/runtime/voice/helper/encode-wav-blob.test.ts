/**
 * WHAT: Unit test for WAV encoding of browser PCM voice samples.
 * WHY: Transcription upload should use a provider-supported container instead of fragile WebM output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWavBlob } from '../../../../../src/runtime/voice/helper/encode-wav-blob.js';

test('encode-wav-blob writes a mono PCM WAV header and samples', async () => {
  const blob = encodeWavBlob([new Float32Array([-1, 0, 1])], 48000);
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(blob.type, 'audio/wav');
  assert.equal(text(view, 0, 4), 'RIFF');
  assert.equal(text(view, 8, 4), 'WAVE');
  assert.equal(text(view, 12, 4), 'fmt ');
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(text(view, 36, 4), 'data');
  assert.equal(view.getUint32(40, true), 6);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(46, true), 0);
  assert.equal(view.getInt16(48, true), 32767);
});

function text(view: DataView, offset: number, length: number): string {
  return String.fromCharCode(...Array.from({ length }, (_, index) => view.getUint8(offset + index)));
}
