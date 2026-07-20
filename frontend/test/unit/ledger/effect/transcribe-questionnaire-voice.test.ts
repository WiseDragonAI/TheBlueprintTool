import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../../../src/runtime/state.js';
import { transcribeQuestionnaireVoice } from '../../../../src/runtime/ledger/effect/transcribe-questionnaire-voice.js';

test('uses the non-thread transcription route and returns durable question audio metadata', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  state.projectId = 'project-a';
  state.replicaNodeId = '';
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ body: {
      ok: true,
      voiceFileRef: '/workspace/.decision-os/voice-uploads/voice-a.wav',
      text: 'This belongs to the active question.',
    } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await transcribeQuestionnaireVoice(new Blob(['voice'], { type: 'audio/wav' }));
    assert.equal(requests[0].url, '/p/project-a/api/transcribe');
    assert.equal(requests[0].init?.method, 'POST');
    assert.equal(result.ok, true);
    assert.equal(result.transcript, 'This belongs to the active question.');
    assert.equal(result.voiceFileRef, '/workspace/.decision-os/voice-uploads/voice-a.wav');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not issue a request when the recording is empty', async () => {
  const originalFetch = globalThis.fetch;
  let requested = false;
  globalThis.fetch = (async () => { requested = true; return new Response(); }) as typeof fetch;
  try {
    const result = await transcribeQuestionnaireVoice(null);
    assert.equal(result.ok, false);
    assert.equal(requested, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
