/**
 * WHAT: Unit test for implemented function transcribe-voice-controller.
 * WHY: each generated function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { transcribeVoiceController } from '@backend/business/transcription/controller/transcribe-voice-controller.js';

test('transcribe-voice-controller executes implemented behavior and records telemetry', async () => {
  traces.length = 0;
  const runtime_state: Record<string, unknown> = {};
  const result = await transcribeVoiceController({
    action_payload: { ok: true, mode: 'dry-run', name: 'Implemented', color: '#5b7cfa', markdown: '# Title #label', url: '/ledgers/default' },
    runtime_state,
    data_model: { cards: [{ id: 'card-1' }], document: {} }
  });
  assert.ok(traces.length > 0);
  assert.ok(result === undefined || typeof result === 'object');
});

test('transcribe-voice-controller accepts voice upload even when transcription is unconfigured', async () => {
  traces.length = 0;
  const runtime_state: Record<string, unknown> = {};
  const result = await transcribeVoiceController({
    action_payload: { audioBuffer: Buffer.from('audio'), mimeType: 'audio/webm' },
    runtime_state,
    data_model: {}
  });
  assert.equal(result.ok, false);
  assert.equal(result.uploaded, true);
  assert.equal(result.configured, false);
  assert.equal(typeof result.voiceFileRef, 'string');
  const lastResponse = runtime_state.lastResponse as { status: number; body: { ok: boolean; uploaded: boolean; configured: boolean } };
  assert.equal(lastResponse.status, 202);
  assert.equal(lastResponse.body.ok, false);
  assert.equal(lastResponse.body.uploaded, true);
  assert.equal(lastResponse.body.configured, false);
});

test('transcribe-voice-controller preserves upload after successful transcription for retry', async () => {
  traces.length = 0;
  const voiceUploadRoot = mkdtempSync(join(tmpdir(), 'corev2-transcribe-clear-'));
  const runtime_state: Record<string, unknown> = {};
  try {
    const result = await transcribeVoiceController({
      action_payload: { audioBuffer: Buffer.from('audio'), mimeType: 'audio/webm', transcriptionText: 'done', voiceUploadRoot },
      runtime_state,
      data_model: {}
    });
    assert.equal(result.ok, true);
    assert.equal(result.uploaded, true);
    assert.equal(typeof result.voiceFileRef, 'string');
    assert.equal(runtime_state.voiceUploadStatus, 'uploaded');
    assert.equal(existsSync(String(result.voiceFileRef)), true);
    assert.equal(runtime_state.persistedTranscription, 'done');
  } finally {
    rmSync(voiceUploadRoot, { recursive: true, force: true });
  }
});

test('transcribe-voice-controller retries a preserved voice upload', async () => {
  traces.length = 0;
  const voiceUploadRoot = mkdtempSync(join(tmpdir(), 'corev2-transcribe-retry-'));
  const runtime_state: Record<string, unknown> = {};
  try {
    const first = await transcribeVoiceController({
      action_payload: { audioBuffer: Buffer.from('audio'), mimeType: 'audio/webm', voiceUploadRoot },
      runtime_state,
      data_model: {}
    });
    const retry = await transcribeVoiceController({
      action_payload: { voiceFileRef: first.voiceFileRef, transcriptionText: 'retry done', voiceUploadRoot },
      runtime_state,
      data_model: {}
    });
    assert.equal(retry.ok, true);
    assert.equal(retry.uploaded, true);
    assert.equal(retry.voiceFileRef, first.voiceFileRef);
    assert.equal(runtime_state.persistedTranscription, 'retry done');
  } finally {
    rmSync(voiceUploadRoot, { recursive: true, force: true });
  }
});
