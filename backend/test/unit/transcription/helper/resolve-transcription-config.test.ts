/**
 * WHAT: Unit test for implemented function resolve-transcription-config.
 * WHY: each generated function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '@backend/telemetry/harness.js';
import { resolveTranscriptionConfig } from '@backend/business/transcription/helper/resolve-transcription-config.js';

test('resolve-transcription-config executes implemented behavior and records telemetry', async () => {
  traces.length = 0;
  const runtime_state: Record<string, unknown> = {};
  const result = await resolveTranscriptionConfig({
    action_payload: { ok: true, mode: 'dry-run', name: 'Implemented', color: '#5b7cfa', markdown: '# Title #label', url: '/ledgers/default' },
    runtime_state,
    data_model: { cards: [{ id: 'card-1' }], document: {} }
  });
  assert.ok(traces.length > 0);
  assert.ok(result === undefined || typeof result === 'object');
});

test('resolve-transcription-config defaults to gpt-4o-mini-transcribe when OpenAI is configured', () => {
  traces.length = 0;
  const result = resolveTranscriptionConfig({
    action_payload: { openaiApiKey: 'test-key' },
    runtime_state: {},
    data_model: {}
  });
  assert.equal(result.ok, true);
  assert.equal(result.model, 'gpt-4o-mini-transcribe');
  assert.equal(result.provider, 'openai');
});

test('resolve-transcription-config reads OpenAI settings from runtime .blueprinttool settings', () => {
  traces.length = 0;
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = resolveTranscriptionConfig({
      action_payload: {},
      runtime_state: { blueprinttoolSettings: { openaiApiKey: 'settings-key', transcriptionModel: 'gpt-4o-mini-transcribe' } },
      data_model: {}
    });
    assert.equal(result.ok, true);
    assert.equal(result.apiKey, 'settings-key');
    assert.equal(result.model, 'gpt-4o-mini-transcribe');
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
