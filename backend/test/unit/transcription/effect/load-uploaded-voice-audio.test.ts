/**
 * WHAT: Unit test for loading preserved voice uploads.
 * WHY: Transcription retry must only read audio from the workspace upload cache.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { loadUploadedVoiceAudio } from '@backend/business/transcription/effect/load-uploaded-voice-audio.js';

test('load-uploaded-voice-audio reads a cached upload for retry', () => {
  traces.length = 0;
  const voiceUploadRoot = mkdtempSync(join(tmpdir(), 'corev2-voice-load-'));
  const voiceFileRef = join(voiceUploadRoot, 'voice.webm');
  const runtime_state: Record<string, unknown> = {};
  try {
    writeFileSync(voiceFileRef, Buffer.from('audio'));
    const result = loadUploadedVoiceAudio({ action_payload: { voiceFileRef, voiceUploadRoot }, runtime_state, data_model: {} });
    assert.equal(result.ok, true);
    assert.equal(result.voiceFileRef, voiceFileRef);
    assert.equal((result.audioBuffer as Buffer).toString('utf8'), 'audio');
    assert.equal(runtime_state.voiceUploadStatus, 'loaded');
    assert.ok(traces.some((trace) => trace.name === 'load-uploaded-voice-audio'));
  } finally {
    rmSync(voiceUploadRoot, { recursive: true, force: true });
  }
});

test('load-uploaded-voice-audio rejects files outside the upload cache', () => {
  const voiceUploadRoot = mkdtempSync(join(tmpdir(), 'corev2-voice-root-'));
  const otherRoot = mkdtempSync(join(tmpdir(), 'corev2-voice-other-'));
  const voiceFileRef = join(otherRoot, 'voice.webm');
  try {
    writeFileSync(voiceFileRef, Buffer.from('audio'));
    const result = loadUploadedVoiceAudio({ action_payload: { voiceFileRef, voiceUploadRoot }, runtime_state: {}, data_model: {} });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Voice upload is outside the workspace cache');
  } finally {
    rmSync(voiceUploadRoot, { recursive: true, force: true });
    rmSync(otherRoot, { recursive: true, force: true });
  }
});
