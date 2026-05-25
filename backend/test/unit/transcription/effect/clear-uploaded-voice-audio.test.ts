/**
 * WHAT: Unit test for clearing transient uploaded voice audio.
 * WHY: Completed transcriptions must not leave durable cached audio behind.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { clearUploadedVoiceAudio } from '@backend/business/transcription/effect/clear-uploaded-voice-audio.js';

test('clear-uploaded-voice-audio removes the transient upload and clears runtime state', () => {
  traces.length = 0;
  const voiceUploadRoot = mkdtempSync(join(tmpdir(), 'corev2-voice-clear-'));
  const voiceFileRef = join(voiceUploadRoot, 'voice.webm');
  const runtime_state: Record<string, unknown> = { voiceFileRef };
  try {
    writeFileSync(voiceFileRef, Buffer.from('audio'));
    const result = clearUploadedVoiceAudio({ action_payload: {}, runtime_state, data_model: {} });
    assert.equal(result.ok, true);
    assert.equal(existsSync(voiceFileRef), false);
    assert.equal(runtime_state.voiceFileRef, '');
    assert.equal(runtime_state.voiceUploadStatus, 'cleared');
    assert.ok(traces.some((trace) => trace.name === 'clear-uploaded-voice-audio'));
  } finally {
    rmSync(voiceUploadRoot, { recursive: true, force: true });
  }
});
