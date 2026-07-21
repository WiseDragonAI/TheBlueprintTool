import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { transcribeGitReviewVoiceController } from '../../src/business/git-review/controller/transcribe-git-review-voice-controller.js';
import { applyLedgerMutation } from '../../src/business/ledger/helper/apply-ledger-mutation.js';
import { createHttpServer } from '../../src/business/server/helper/create-http-server.js';
import { migrateTaskCurrentState } from '../../src/business/task-state/helper/task-current-state-migration.js';

test('transcribes Git review audio without creating a thread note', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-git-review-voice-'));
  try {
    const decisionOsRoot = join(workspace, '.decision-os');
    const result = await transcribeGitReviewVoiceController({
      action_payload: {
        audioBuffer: Buffer.from('review audio'),
        mimeType: 'audio/webm',
        transcriptionText: 'Please rename this variable.',
        repository: '.',
        target: 'src/file.ts',
        file: 'src/file.ts',
        hunk: '@@ -1 +1 @@',
        patchHash: 'hash-a',
        selection: '{"start":1,"end":1}',
      },
      runtime_state: { decisionOsRoot },
    });

    assert.equal(result.ok, true);
    assert.equal((result.note as Record<string, unknown>).body, 'Please rename this variable.');
    assert.equal((result.note as Record<string, unknown>).status, 'transcribed');
    assert.equal(existsSync(join(decisionOsRoot, 'threads')), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('persists validated Git review notes on the card instead of its thread', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-git-review-card-'));
  try {
    const note = {
      id: 'review-a', repository: '.', target: 'src/file.ts', file: 'src/file.ts', hunk: '@@ -1 +1 @@', patchHash: 'hash-a',
      body: 'Please rename this variable.', voiceFileRef: '/tmp/voice.webm', status: 'transcribed' as const, createdAt: '2026-07-20T00:00:00.000Z',
    };
    const ledger: { cards: Array<Record<string, unknown>>; notes?: Record<string, Array<Record<string, unknown>>> } = { cards: [{ id: 'card-a' }] };
    const result = applyLedgerMutation({
      decisionOsRoot: join(workspace, '.decision-os'),
      ledgerPath: join(workspace, '.decision-os', 'tasks.json'),
      ledger,
      mutation: { action: 'patch-card', cardPatch: { id: 'card-a', gitReviewNotes: [note] } },
    });

    assert.equal(result.error, undefined);
    assert.deepEqual(ledger.cards[0].gitReviewNotes, [note]);
    assert.equal(ledger.notes, undefined);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('serves Git review transcription on its dedicated endpoint without touching thread storage', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-git-review-route-'));
  mkdirSync(join(workspace, '.decision-os'));
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({ tabs: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(workspace, '.decision-os', 'tasks.json'), JSON.stringify({ cards: [{ id: 'card-a' }], annotations: [], relationships: [], notes: {} }));
  writeFileSync(join(workspace, '.decision-os', 'project.json'), JSON.stringify({ id: 'git-review-project' }));
  await migrateTaskCurrentState({
    decisionOsRoot: join(workspace, '.decision-os'),
    projectId: 'git-review-project',
    tasksLedgerFile: join(workspace, '.decision-os', 'tasks.json'),
  });
  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const form = new FormData();
  form.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'review.webm');
  form.append('transcriptionText', 'Keep this note in the widget.');
  form.append('repository', '.');
  form.append('target', 'src/file.ts');
  form.append('file', 'src/file.ts');
  form.append('hunk', '@@ -1 +1 @@');
  form.append('patchHash', 'hash-route');
  const ledgerPath = join(workspace, '.decision-os', 'tasks.json');
  const ledgerBeforeRequest = readFileSync(ledgerPath, 'utf8');

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/git-review/voice`, { method: 'POST', body: form });
    const payload = await response.json() as { ok: boolean; note: Record<string, unknown> };
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.note.body, 'Keep this note in the widget.');
    assert.equal(readFileSync(ledgerPath, 'utf8'), ledgerBeforeRequest);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});
