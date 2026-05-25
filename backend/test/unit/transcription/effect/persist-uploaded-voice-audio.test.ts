/**
 * WHAT: Unit test for transient voice upload persistence.
 * WHY: Optimistic uploads must store the file even before transcription can run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { persistUploadedVoiceAudio } from '@backend/business/transcription/effect/persist-uploaded-voice-audio.js';

test('persist-uploaded-voice-audio writes a transient upload and records runtime state', () => {
  traces.length = 0;
  const voiceUploadRoot = mkdtempSync(join(tmpdir(), 'corev2-voice-upload-'));
  const runtime_state: Record<string, unknown> = {};
  try {
    const result = persistUploadedVoiceAudio({
      action_payload: { audioBuffer: Buffer.from('audio'), mimeType: 'audio/webm', voiceUploadRoot },
      runtime_state,
      data_model: {}
    });
    assert.equal(result.ok, true);
    assert.equal(result.size, 5);
    assert.equal(existsSync(String(result.voiceFileRef)), true);
    assert.equal(runtime_state.voiceFileRef, result.voiceFileRef);
    assert.equal(runtime_state.voiceUploadStatus, 'uploaded');
    assert.ok(traces.some((trace) => trace.name === 'persist-uploaded-voice-audio'));
  } finally {
    rmSync(voiceUploadRoot, { recursive: true, force: true });
  }
});
