import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import {
  readVoiceTranscriptionStatusController,
  startVoiceUploadOrchestrationController
} from '@backend/business/transcription/controller/start-voice-upload-orchestration-controller.js';

function workspaceFixture(): { root: string; runtime: Record<string, unknown> } {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-voice-lifecycle-'));
  mkdirSync(join(root, '.decision-os'), { recursive: true });
  writeFileSync(join(root, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }));
  writeFileSync(join(root, '.decision-os', 'specs.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {} }));
  return { root, runtime: { decisionOsRoot: join(root, '.decision-os') } };
}

test('voice lifecycle persists ordered phases and exposes one targeted terminal note', async () => {
  const fixture = workspaceFixture();
  traces.length = 0;
  try {
    const result = await startVoiceUploadOrchestrationController({
      action_payload: {
        ledgerId: 'specs',
        threadId: 'thread-card-a',
        noteId: 'note-voice-status',
        audioBuffer: Buffer.from('voice'),
        mimeType: 'audio/webm',
        transcriptionText: 'Targeted transcript.',
        awaitCompletion: true
      },
      runtime_state: fixture.runtime
    });
    assert.equal(result.statusCode, 202);
    const status = readVoiceTranscriptionStatusController({
      action_payload: { ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-voice-status' },
      runtime_state: fixture.runtime
    });
    assert.equal(status.ok, true);
    assert.deepEqual(Object.keys(status.note as Record<string, unknown>).sort(), [
      'acceptedAt', 'audioPersistedAt', 'completedAt', 'error', 'id', 'message', 'providerSettledAt',
      'providerStartedAt', 'revision', 'status', 'transcriptionStartedAt', 'uploadReceivedAt', 'voiceFileRef'
    ].sort());
    const note = status.note as Record<string, unknown>;
    assert.equal(note.status, 'transcribed');
    assert.equal(note.message, 'Targeted transcript.');
    assert.equal(note.revision, 4);
    const timestamps = ['uploadReceivedAt', 'audioPersistedAt', 'acceptedAt', 'providerStartedAt', 'providerSettledAt', 'completedAt'].map((key) => Date.parse(String(note[key])));
    assert.equal(timestamps.every(Number.isFinite), true);
    assert.deepEqual([...timestamps].sort((a, b) => a - b), timestamps);
    const phases = traces.filter((trace) => trace.name === 'voice-transcription-lifecycle').map((trace) => String((trace.args as Record<string, unknown>).phase));
    assert.deepEqual(phases, ['upload-received', 'audio-persisted', 'accepted', 'provider-started', 'provider-settled', 'completed']);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('voice lifecycle persists a server-owned deadline failure and preserves retry audio', async () => {
  const fixture = workspaceFixture();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')), { once: true });
  })) as typeof fetch;
  try {
    await startVoiceUploadOrchestrationController({
      action_payload: {
        ledgerId: 'specs',
        threadId: 'thread-card-a',
        noteId: 'note-deadline',
        audioBuffer: Buffer.from('voice'),
        mimeType: 'audio/webm',
        openaiApiKey: 'test-key',
        transcriptionDeadlineMs: 5,
        awaitCompletion: true
      },
      runtime_state: fixture.runtime
    });
    const status = readVoiceTranscriptionStatusController({
      action_payload: { ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-deadline' },
      runtime_state: fixture.runtime
    });
    const note = status.note as Record<string, unknown>;
    assert.equal(note.status, 'transcription failed');
    assert.match(String(note.error), /timed out after 5ms/);
    assert.equal(note.revision, 3);
    assert.equal(typeof note.voiceFileRef, 'string');
    assert.match(readFileSync(String(note.voiceFileRef)).toString(), /voice/);
  } finally {
    globalThis.fetch = previousFetch;
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('voice status read rejects incomplete and unknown note scope', () => {
  const fixture = workspaceFixture();
  try {
    assert.equal(readVoiceTranscriptionStatusController({ action_payload: {}, runtime_state: fixture.runtime }).statusCode, 400);
    assert.equal(readVoiceTranscriptionStatusController({
      action_payload: { ledgerId: 'specs', threadId: 'thread-missing', noteId: 'note-missing' },
      runtime_state: fixture.runtime
    }).statusCode, 404);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
